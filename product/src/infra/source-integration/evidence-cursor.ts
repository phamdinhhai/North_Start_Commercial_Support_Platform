import { SourceIntegrationError, type SourceEvidencePageOptions } from '../../ports/source-observation';
type Position = { time: string; id: string };
const invalid = (): never => { throw new SourceIntegrationError('INPUT_INVALID', 400); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// SQL produces UTC with six fractional digits. Never round through JavaScript Date.
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
export function encodeEvidenceCursor(workspaceId: string, leadId: string, position: Position): string {
  return Buffer.from(JSON.stringify({ v: 1, workspaceId, leadId, ...position })).toString('base64url');
}
export function evidencePageRequest(workspaceId: string, leadId: string, options: SourceEvidencePageOptions = {}): { limit: number; position: Position | null } {
  if (!options || typeof options !== 'object' || Object.keys(options).some(k => k !== 'limit' && k !== 'cursor')) return invalid();
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return invalid();
  if (options.cursor === undefined) return { limit, position: null };
  const token = options.cursor;
  if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) return invalid();
  try {
    const decoded = Buffer.from(token, 'base64url');
    if (decoded.toString('base64url') !== token) return invalid();
    const v = JSON.parse(decoded.toString('utf8')) as Record<string, unknown>;
    if (!v || Object.keys(v).sort().join() !== 'id,leadId,time,v,workspaceId' || v.v !== 1 || v.workspaceId !== workspaceId || v.leadId !== leadId ||
      typeof v.id !== 'string' || !uuid.test(v.id) || typeof v.time !== 'string' || !timestamp.test(v.time) || !Number.isFinite(Date.parse(v.time)) ||
      new Date(v.time).toISOString().slice(0, 19) !== v.time.slice(0, 19)) return invalid();
    return { limit, position: { time: v.time, id: v.id } };
  } catch { return invalid(); }
}
