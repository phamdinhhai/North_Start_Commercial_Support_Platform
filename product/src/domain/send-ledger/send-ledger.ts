/**
 * Technical fixture state machine; not a canonical CommercialEvent, Lead state or Owner approval.
 * The ledger is authoritative for intent and outcomes; provider idempotency is a
 * separate capability and must never be inferred from a request key.
 */
export type SendState = 'PLANNED' | 'RESERVED' | 'DISPATCH_STARTED' | 'RESPONSE_CONFIRMED' | 'PROVIDER_REJECTED' | 'AMBIGUOUS' | 'MANUAL_REVIEW_REQUIRED' | 'CLOSED_WITH_EVIDENCE';
export type SendEventType = 'PLANNED' | 'RESERVED' | 'DISPATCH_STARTED' | 'RESPONSE_CONFIRMED' | 'PROVIDER_REJECTED' | 'AMBIGUOUS' | 'MANUAL_REVIEW_REQUIRED' | 'CLOSED_WITH_EVIDENCE';
export interface SendEvent { readonly requestId: string; readonly event: SendEventType; readonly at: string; readonly evidence?: string; }
export interface SendRecord { readonly requestId: string; readonly state: SendState; readonly events: readonly SendEvent[]; }

const transitions: Readonly<Record<SendState, readonly SendState[]>> = {
  PLANNED: ['RESERVED'], RESERVED: ['DISPATCH_STARTED','MANUAL_REVIEW_REQUIRED'], DISPATCH_STARTED: ['RESPONSE_CONFIRMED', 'PROVIDER_REJECTED', 'AMBIGUOUS', 'MANUAL_REVIEW_REQUIRED'],
  RESPONSE_CONFIRMED: ['CLOSED_WITH_EVIDENCE'], PROVIDER_REJECTED: ['CLOSED_WITH_EVIDENCE'], AMBIGUOUS: ['MANUAL_REVIEW_REQUIRED'], MANUAL_REVIEW_REQUIRED: ['CLOSED_WITH_EVIDENCE'], CLOSED_WITH_EVIDENCE: [],
};
const valid = (v: string) => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\r\n]/u.test(v);
const now = () => new Date().toISOString();

export class SendLedger {
  private readonly records = new Map<string, SendRecord>();
  constructor(events: readonly SendEvent[] = []) { for (const event of events) this.append(event); }
  append(event: SendEvent): SendRecord {
    if (!event || !valid(event.requestId) || !valid(event.at) || !Number.isFinite(Date.parse(event.at)) || !(event.event in transitions) || (event.evidence !== undefined && !valid(event.evidence)) || (event.event === 'CLOSED_WITH_EVIDENCE' && !event.evidence)) throw new Error('INVALID_SEND_EVENT');
    const current = this.records.get(event.requestId);
    if (!current) {
      if (event.event !== 'PLANNED') throw new Error('INVALID_SEND_TRANSITION');
      const record = { requestId: event.requestId, state: event.event, events: Object.freeze([Object.freeze({...event})]) } as SendRecord;
      this.records.set(event.requestId, Object.freeze(record)); return record;
    }
    if (event.event === current.state && event.event === 'PLANNED') return current; // duplicate intent never grants dispatch
    if (!transitions[current.state].includes(event.event)) throw new Error('INVALID_SEND_TRANSITION');
    const record = Object.freeze({ requestId: current.requestId, state: event.event, events: Object.freeze([...current.events, Object.freeze({...event})]) });
    this.records.set(event.requestId, record); return record;
  }
  plan(requestId: string): SendRecord { return this.append({requestId, event: 'PLANNED', at: now()}); }
  reserve(requestId: string): SendRecord { return this.append({requestId, event: 'RESERVED', at: now()}); }
  dispatchStarted(requestId: string): SendRecord { return this.append({requestId, event: 'DISPATCH_STARTED', at: now()}); }
  outcome(requestId: string, event: Extract<SendEventType, 'RESPONSE_CONFIRMED'|'PROVIDER_REJECTED'|'AMBIGUOUS'>, evidence?: string): SendRecord { return this.append({requestId, event, at: now(), evidence}); }
  recover(requestId: string): SendRecord {
    const record = this.get(requestId); if (record.state !== 'DISPATCH_STARTED' && record.state !== 'RESERVED') return record;
    return this.append({requestId, event: 'MANUAL_REVIEW_REQUIRED', at: now(), evidence: 'interrupted-operation; separate review required before any provider request'});
  }
  get(requestId: string): SendRecord { const record = this.records.get(requestId); if (!record) throw new Error('SEND_NOT_FOUND'); return record; }
  snapshot(): readonly SendRecord[] { return [...this.records.values()]; }
}

