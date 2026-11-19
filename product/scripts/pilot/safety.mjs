import { tmpdir } from 'node:os';
import { resolve, dirname, join, basename } from 'node:path';
import { lstatSync, readFileSync } from 'node:fs';
export const pgBin = 'C:/Program Files/PostgreSQL/17/bin';
export function validateManifest(file) {
  const absolute = resolve(file), home = dirname(absolute);
  if (dirname(home) !== resolve(tmpdir()) || !/^north-synthetic-pilot-[a-f0-9]{32}$/.test(basename(home)) || basename(absolute) !== 'manifest.json')
    throw new Error('Only an owned OS-temp pilot manifest is accepted');
  for (const target of [home, absolute]) if (lstatSync(target).isSymbolicLink()) throw new Error('Links refused');
  const m = JSON.parse(readFileSync(absolute, 'utf8'));
  if (m.kind !== 'LOCAL_SYNTHETIC_ONLY_V1' || !/^[a-f0-9]{32}$/.test(m.id) || basename(home) !== `north-synthetic-pilot-${m.id}` ||
      m.data !== join(home, 'data') || !/^pilot_[a-f0-9]{32}$/.test(m.database) || !/^pilot_[a-f0-9]{32}$/.test(m.role) ||
      !/^[a-f0-9]{64}$/.test(m.password) || !/^[a-f0-9]{64}$/.test(m.adminPassword) || !/^[a-f0-9]{64}$/.test(m.control) ||
      ![m.pgPort, m.appPort, m.idpPort, m.controlPort].every(p => Number.isInteger(p) && p > 1024 && p < 65536) ||
      new Set([m.pgPort, m.appPort, m.idpPort, m.controlPort]).size !== 4 || m.workspace !== `synthetic-${m.id}` ||
      !Array.isArray(m.digestKeys) || m.digestKeys.length !== 2 || m.digestKeys.some((k, i) => k.workspaceId !== `${m.workspace}${i ? '-foreign' : ''}` || k.activeKid !== 'local-v1' || k.keys?.length !== 1 || k.keys[0].kid !== 'local-v1' || !/^[A-Za-z0-9+/]{43}=$/.test(k.keys[0].secretBase64)) ||
      (m.backup && (dirname(m.backup) !== home || !/^backup-pilot_[a-f0-9]{32}\.dump$/.test(basename(m.backup)))))
    throw new Error('Invalid synthetic manifest');
  if (lstatSync(m.data).isSymbolicLink()) throw new Error('Linked cluster refused');
  if (m.backup && lstatSync(m.backup).isSymbolicLink()) throw new Error('Linked backup refused');
  return { ...m, home, file: absolute };
}
export function connection(m, admin = false, database = m.database) {
  if (database !== m.database && database !== 'postgres') throw new Error('Arbitrary database refused');
  return `postgresql://${admin ? 'postgres' : m.role}:${admin ? m.adminPassword : m.password}@127.0.0.1:${m.pgPort}/${database}`;
}
export function cleanEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
}
