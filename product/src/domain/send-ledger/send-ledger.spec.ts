import {describe, expect, it} from 'vitest';
import {SendLedger} from './send-ledger';

describe('send WAL ledger', () => {
  it('reserves before dispatch and records outcomes append-only', () => { const l = new SendLedger(); l.plan('r'); l.reserve('r'); l.dispatchStarted('r'); const x = l.outcome('r', 'RESPONSE_CONFIRMED', 'provider-id:p'); expect(x.state).toBe('RESPONSE_CONFIRMED'); expect(x.events.map(e => e.event)).toEqual(['PLANNED','RESERVED','DISPATCH_STARTED','RESPONSE_CONFIRMED']); });
  it('turns a dispatch crash into manual review, never retry', () => { const l = new SendLedger([{requestId:'r',event:'PLANNED',at:'2026-01-01T00:00:00Z'},{requestId:'r',event:'RESERVED',at:'2026-01-01T00:00:01Z'},{requestId:'r',event:'DISPATCH_STARTED',at:'2026-01-01T00:00:02Z'}]); expect(l.recover('r').state).toBe('MANUAL_REVIEW_REQUIRED'); expect(() => l.dispatchStarted('r')).toThrow('INVALID_SEND_TRANSITION'); });
  it('deduplicates concurrent duplicate request appends', () => { const l = new SendLedger(); const a = l.plan('same'); const b = l.plan('same'); expect(b.events).toHaveLength(1); expect(a).toEqual(b); });
  it('requires explicit evidence to close and distinguishes provider rejection', () => { const l = new SendLedger(); l.plan('r'); l.reserve('r'); l.dispatchStarted('r'); l.outcome('r','PROVIDER_REJECTED','code:400'); expect(l.append({requestId:'r',event:'CLOSED_WITH_EVIDENCE',at:'2026-01-01T00:00:04Z',evidence:'provider code 400'}).state).toBe('CLOSED_WITH_EVIDENCE'); });
});

it('denies duplicate dispatch and evidence-free closure', () => {
  const l = new SendLedger(); l.plan('r'); l.reserve('r'); l.dispatchStarted('r');
  expect(() => l.dispatchStarted('r')).toThrow('INVALID_SEND_TRANSITION');
  l.outcome('r', 'AMBIGUOUS');
  l.append({requestId:'r', event:'MANUAL_REVIEW_REQUIRED', at:'2026-01-01T00:00:00Z'});
  expect(() => l.append({requestId:'r', event:'CLOSED_WITH_EVIDENCE', at:'2026-01-01T00:00:01Z'})).toThrow('INVALID_SEND_EVENT');
});
