import { tmpdir } from 'node:os';
import { resolve, dirname, join, basename } from 'node:path';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
export const pgBin = 'C:/Program Files/PostgreSQL/17/bin';
export function validateManifest(file) {
  const absolute = resolve(file), home = dirname(absolute);
  if (dirname(home) !== resolve(tmpdir()) || !/^north-synthetic-pilot-[a-f0-9]{32}$/.test(basename(home)) || basename(absolute) !== 'manifest.json')
    throw new Error('Only an owned OS-temp pilot manifest is accepted');
  for (const target of [home, absolute]) if (lstatSync(target).isSymbolicLink()) throw new Error('Links refused');
  const m = JSON.parse(readFileSync(absolute, 'utf8'));
  if (m.kind !== 'LOCAL_SYNTHETIC_ONLY_V1' || !/^[a-f0-9]{32}$/.test(m.id) || basename(home) !== `north-synthetic-pilot-${m.id}` ||
      m.data !== join(home, 'data') || !/^pilot_[a-f0-9]{32}$/.test(m.database) || m.role !== `pilot_${m.id}` ||
      !/^[a-f0-9]{64}$/.test(m.password) || !/^[a-f0-9]{64}$/.test(m.adminPassword) || !/^[a-f0-9]{64}$/.test(m.control) ||
      ![m.pgPort, m.appPort, m.idpPort, m.controlPort].every(p => Number.isInteger(p) && p > 1024 && p < 65536) ||
      new Set([m.pgPort, m.appPort, m.idpPort, m.controlPort]).size !== 4 || m.workspace !== `synthetic-${m.id}` ||
      !Array.isArray(m.digestKeys) || m.digestKeys.length !== 2 || m.digestKeys.some((k, i) => k.workspaceId !== `${m.workspace}${i ? '-foreign' : ''}` || k.activeKid !== 'local-v1' || k.keys?.length !== 1 || k.keys[0].kid !== 'local-v1' || !/^[A-Za-z0-9+/]{43}=$/.test(k.keys[0].secretBase64)) ||
      (m.backup && (dirname(m.backup) !== home || !/^backup-pilot_[a-f0-9]{32}\.dump$/.test(basename(m.backup)))))
    throw new Error('Invalid synthetic manifest');
  if (lstatSync(m.data).isSymbolicLink()) throw new Error('Linked cluster refused');
  assertClusterFiles(m);
  if (m.backup && lstatSync(m.backup).isSymbolicLink()) throw new Error('Linked backup refused');
  return { ...m, home, file: absolute };
}
export function assertClusterFiles(m) {
  if (realpathSync(m.data) !== resolve(m.data)) throw new Error('Cluster path mismatch');
  const config = join(m.data, 'postgresql.auto.conf');
  if (lstatSync(config).isSymbolicLink() || readFileSync(config, 'utf8') !== `listen_addresses='127.0.0.1'\nport=${m.pgPort}\n`)
    throw new Error('Cluster configuration mismatch');
}
export async function assertOwnedServer(client, m) {
  const result = await client.query("SELECT current_setting('data_directory') AS data, current_setting('port') AS port, current_setting('listen_addresses') AS hosts, inet_server_addr()::text AS address");
  const row = result.rows[0];
  if (realpathSync(row.data) !== realpathSync(m.data) || Number(row.port) !== m.pgPort || row.hosts !== '127.0.0.1' || row.address !== '127.0.0.1/32')
    throw new Error('Owned PostgreSQL server mismatch');
}
export function connection(m, admin = false, database = m.database) {
  if (database !== m.database && database !== 'postgres') throw new Error('Arbitrary database refused');
  return `postgresql://${admin ? 'postgres' : m.role}:${admin ? m.adminPassword : m.password}@127.0.0.1:${m.pgPort}/${database}`;
}
export function cleanEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(k)));
}
