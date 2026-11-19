import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const schema = JSON.parse(readFileSync(new URL('../../../docs/reports/r4.7-r4.9-product-validation/observation.schema.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
/** Local categorical preparation validator. Never logs submitted values or writes observations. */
export function validateObservation(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  if (Object.keys(row).some(k => !Object.hasOwn(schema.properties, k)) || schema.required.some(k => !Object.hasOwn(row, k))) return false;
  for (const [key, rule] of Object.entries(schema.properties)) {
    const value = row[key];
    if (rule.enum) { if (!rule.enum.includes(value)) return false; continue; }
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (value === null && types.includes('null')) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || (types.includes('integer') && !Number.isInteger(value)) || value < rule.minimum || value > rule.maximum) return false;
  }
  if (row.result === 'completed-unaided' && (row.unaidedSeconds === null || row.assistedSeconds !== null || row.navigationInterventions + row.conceptInterventions + row.recoveryInterventions + row.environmentInterventions !== 0)) return false;
  if (row.result === 'completed-assisted' && row.assistedSeconds === null) return false;
  return true;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const value = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length || !rows.every(validateObservation)) throw new Error();
    console.log('VALID categorical observation file; no values printed');
  } catch { console.error('INVALID observation file; values withheld'); process.exitCode = 1; }
}
