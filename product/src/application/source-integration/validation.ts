import { SourceIntegrationError, type SourceObservation } from '../../ports/source-observation';
const object = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v);
const time = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,19) === v.slice(0,19);
const keys = (v: Record<string,unknown>, expected: string) => Object.keys(v).sort().join() === expected;
export function validateSourceObservation(v: unknown): SourceObservation {
  const fail = (): never => {throw new SourceIntegrationError('INPUT_INVALID',400);};
  if (!object(v) || !keys(v,'accountId,completeness,displayName,lifecycle,native,observedAt,occurredAt,provider,rawPayload,receiptId,route,schemaVersion,sourceAuthority,synthetic,verification')) return fail();
  if (v.schemaVersion !== 1 || v.synthetic !== true || v.sourceAuthority !== 'synthetic_fixture' || v.verification !== 'UNVERIFIED' ||
    !['UNKNOWN','partial'].includes(v.completeness as string) || !['pancake','meta-page'].includes(v.provider as string) ||
    v.route !== `${v.provider}-synthetic` || !id(v.accountId) || !id(v.receiptId) || !id(v.displayName) || !time(v.observedAt) ||
    (v.occurredAt !== null && !time(v.occurredAt)) || !['upsert-observed','deletion-labelled'].includes(v.lifecycle as string)) return fail();
  const n=v.native,r=v.rawPayload;
  if (!object(n) || !keys(n,'conversationId,eventId,messageId,pageId,revision,system') || ![null,'meta','pancake'].includes(n.system as null|string) ||
    ['pageId','conversationId','messageId','eventId','revision'].some(k=> n[k] !== null && !id(n[k]))) return fail();
  if (!object(r) || !keys(r,'original,speaker,utterance') || !object(r.original) || typeof r.utterance !== 'string' || r.utterance.length > 16384 ||
    !['customer','staff','unknown'].includes(r.speaker as string)) return fail();
  try { if (Buffer.byteLength(JSON.stringify(v),'utf8') > 65536) return fail(); } catch { return fail(); }
  return structuredClone(v) as unknown as SourceObservation;
}
