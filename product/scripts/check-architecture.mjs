import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OWNERSHIP = Object.freeze({
  domain: 'domain', application: 'application', ports: 'ports',
  adapters: 'adapters', infra: 'infra', api: 'api',
  modules: 'legacy-application', health: 'legacy-api',
});
const COMPOSITION_ROOTS = new Set([
  'app.module.ts', 'main.ts', 'scripts/migrate.ts',
  'scripts/pilot-loop.module.ts', 'scripts/health.module.ts',
]);
const OUTER = ['api', 'infra', 'application', 'adapters', 'legacy-application', 'legacy-api', 'composition-root'];
const RULES = Object.freeze({
  domain: { forbiddenLayers: [...OUTER, 'ports'], forbiddenPackages: ['@nestjs', 'pg'] },
  application: { forbiddenLayers: OUTER.filter((layer) => layer !== 'application'), forbiddenPackages: ['@nestjs', 'pg'] },
  ports: { forbiddenLayers: OUTER, forbiddenPackages: ['@nestjs', 'pg'] },
  adapters: { forbiddenLayers: OUTER.filter((layer) => layer !== 'adapters'), forbiddenPackages: ['@nestjs', 'pg'] },
  infra: { forbiddenLayers: OUTER.filter((layer) => layer !== 'infra'), forbiddenPackages: [] },
  api: { forbiddenLayers: ['infra', 'adapters', 'legacy-application', 'legacy-api', 'composition-root'], forbiddenPackages: ['pg'] },
  'legacy-application': { forbiddenLayers: ['api', 'infra', 'adapters', 'legacy-api', 'composition-root'], forbiddenPackages: ['@nestjs', 'pg'] },
  'legacy-api': { forbiddenLayers: ['infra', 'adapters', 'legacy-application', 'composition-root'], forbiddenPackages: ['pg'] },
});

const normalizedPath = (path) => path.split(sep).join('/');
function layerFor(sourceRoot, file) {
  const path = normalizedPath(relative(sourceRoot, file));
  return COMPOSITION_ROOTS.has(path) ? 'composition-root' : OWNERSHIP[path.split('/')[0]] ?? null;
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile() && extname(entry.name) === '.ts' && !entry.name.endsWith('.spec.ts')) files.push(path);
  }
  return files.sort();
}

function importsOf(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  const add = (node) => { if (node && ts.isStringLiteralLike(node)) imports.push(node.text); };
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return imports;
}

function importTarget(sourceRoot, file, specifier) {
  if (specifier.startsWith('@nestjs/')) return { layer: '@nestjs' };
  if (specifier === 'pg' || specifier.startsWith('pg/')) return { layer: 'pg' };
  const target = specifier.startsWith('.') ? resolve(dirname(file), specifier)
    : specifier.startsWith('@/') ? resolve(sourceRoot, specifier.slice(2)) : null;
  if (!target) return { layer: null };
  const withoutExtension = target.replace(/\.(?:ts|js)$/, '');
  return { layer: layerFor(sourceRoot, `${withoutExtension}.ts`) ?? 'unowned', path: withoutExtension };
}

export async function checkArchitecture(sourceRoot = resolve(ROOT, 'src')) {
  const violations = [];
  const report = (file, code, message, specifier) => violations.push({
    file: `src/${normalizedPath(relative(sourceRoot, file))}`, code, message,
    ...(specifier ? { specifier } : {}),
  });
  for (const file of await filesUnder(sourceRoot)) {
    const layer = layerFor(sourceRoot, file);
    if (!layer) {
      report(file, 'ARCH-LOC-001', 'source file is outside an owned layer or explicit composition root');
      continue;
    }
    if (layer.startsWith('legacy-')) report(file, 'ARCH-LOC-002', 'legacy source location must migrate to its owning layer');
    const rules = RULES[layer];
    if (!rules) continue;
    for (const specifier of importsOf(await readFile(file, 'utf8'), file)) {
      const target = importTarget(sourceRoot, file, specifier);
      if (target.layer === 'unowned') {
        report(file, 'ARCH-DEP-003', 'internal import targets an unowned source location', specifier);
      } else if (rules.forbiddenPackages.includes(target.layer)) {
        report(file, 'ARCH-DEP-002', `${layer} cannot import ${target.layer}`, specifier);
      } else if (rules.forbiddenLayers.includes(target.layer)) {
        report(file, 'ARCH-DEP-001', `${layer} cannot import ${target.layer}`, specifier);
      }
      if ((layer === 'api' || layer === 'legacy-api') && target.path?.endsWith('.controller')) {
        report(file, 'ARCH-API-001', 'API must call application services, not another controller', specifier);
      }
    }
  }
  return violations;
}

async function main() {
  const violations = await checkArchitecture();
  console.log(`Architecture check: ${violations.length === 0 ? 'PASS' : 'FAIL'} (${violations.length} findings)`);
  for (const item of violations) console.log(`${item.code} ${item.file}${item.specifier ? ` -> ${item.specifier}` : ''}: ${item.message}`);
  if (violations.length && !process.argv.includes('--report')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
