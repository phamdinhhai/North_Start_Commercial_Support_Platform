import { describe, expect, it } from 'vitest';
import { validateAcceptBody, validateAdvanceBody, validateCompleteBody, validateHandoffBody, validateIntakeBody, validateOutcomeBody, validateRescheduleBody, validateUnobservedBody } from './pilot-validation';

/**
 * P1-4 (boundary half) — main.ts has NO global ValidationPipe and the controller typed its
 * bodies structurally only, so `evidence: "anything"`, a missing required string, or a
 * non-ISO dueAt used to be persisted or produced a raw 500. Boundary validation must reject
 * with 400 + machine-readable field issues BEFORE any domain call.
 */
const intakeOk = { displayName: 'Phụ huynh A', utterance: 'Gửi em học phí nhé', speaker: 'customer', connection: 'c', externalRecordId: 'r' };

describe('pilot boundary validation — 400 before the domain is touched', () => {
  it('accepts well-formed payloads', () => {
    expect(validateIntakeBody(intakeOk)).toEqual([]);
    expect(
      validateHandoffBody({ context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'sales-b' }),
    ).toEqual([]);
    expect(validateCompleteBody({ workId: 'w', evidence: 'declared' })).toEqual([]);
    expect(validateRescheduleBody({ workId: 'w', newDueAt: '2026-10-12T16:00:00+07:00', reason: 'dời' })).toEqual([]);
    expect(validateOutcomeBody({ value: 'Won' })).toEqual([]);
  });

  it('rejects an evidence value outside the enum (the old bug: persisted or 500)', () => {
    const issues = validateCompleteBody({ workId: 'w', evidence: 'definitely-done' });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: 'evidence', code: 'ENUM_INVALID' });
  });

  it('rejects missing required strings and empty/whitespace-only values', () => {
    expect(validateIntakeBody({ ...intakeOk, utterance: '   ' })).toEqual([{ field: 'utterance', code: 'REQUIRED', message: expect.any(String) }]);
    expect(validateHandoffBody({ context: '', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'sales-b' })[0]).toMatchObject({
      field: 'context',
    });
    expect(validateCompleteBody({ workId: '', evidence: 'declared' })[0]).toMatchObject({ field: 'workId' });
    expect(validateRescheduleBody({ workId: 'w', newDueAt: '2026-10-12T16:00:00+07:00' })[0]).toMatchObject({ field: 'reason' });
  });

  it('rejects an unparseable dueAt instead of storing an invalid date (TEXT column tolerated it)', () => {
    expect(validateRescheduleBody({ workId: 'w', newDueAt: 'thứ Hai tuần sau', reason: 'dời' })[0]).toMatchObject({ field: 'newDueAt', code: 'DATE_INVALID' });
    expect(validateHandoffBody({ context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'b', dueAt: 'not-a-date' })[0]).toMatchObject({
      field: 'dueAt',
      code: 'DATE_INVALID',
    });
    // an explicit unknown sentinel for occurredAt stays legal (Q4: never backfill)
    expect(validateCompleteBody({ workId: 'w', evidence: 'declared', occurredAt: 'unknown' })).toEqual([]);
    expect(validateCompleteBody({ workId: 'w', evidence: 'declared', occurredAt: 'hôm kia' })[0]).toMatchObject({ field: 'occurredAt', code: 'DATE_INVALID' });
  });

  it('rejects non-object bodies and unknown speaker/party/origin/value enums', () => {
    const issues = validateIntakeBody('nope');
    expect(issues[0]).toMatchObject({ field: 'body', code: 'OBJECT_REQUIRED' });
    expect(validateIntakeBody({ ...intakeOk, speaker: 'alien' })[0]).toMatchObject({ field: 'speaker' });
    expect(
      validateHandoffBody({ context: 'c', proposedAction: 'a', responsibleParty: 'self', origin: 'explicit-request', recipientUserId: 'b' })[0],
    ).toMatchObject({ field: 'responsibleParty' });
    expect(
      validateHandoffBody({ context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'because-i-said-so', recipientUserId: 'b' })[0],
    ).toMatchObject({ field: 'origin' });
    expect(validateOutcomeBody({ value: 'Maybe' })[0]).toMatchObject({ field: 'value' });
  });

  it('reports every violation at once (a form needs the full list, not one at a time)', () => {
    const issues = validateHandoffBody({ context: '', proposedAction: '', responsibleParty: 'wrong', origin: 'wrong', recipientUserId: '' });
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(['context', 'proposedAction', 'responsibleParty', 'origin', 'recipientUserId']));
    expect(issues.length).toBeGreaterThanOrEqual(5);
  });
});

describe('pilot boundary validation — non-object bodies on every endpoint', () => {
  it('arrays, strings and null are rejected as bodies (not coerced into field errors)', () => {
    for (const bad of ['nope', ['a'], null, undefined, 42]) {
      for (const fn of [validateIntakeBody, validateHandoffBody, validateAcceptBody, validateAdvanceBody, validateCompleteBody, validateRescheduleBody, validateUnobservedBody, validateOutcomeBody]) {
        expect(fn(bad)).toEqual([{ field: 'body', code: 'OBJECT_REQUIRED', message: 'request body must be a JSON object' }]);
      }
    }
  });

  it('optional fields are only checked when present (blank reason/evidenceRef rejected, absent accepted)', () => {
    expect(validateCompleteBody({ workId: 'w', evidence: 'declared' })).toEqual([]);
    expect(validateCompleteBody({ workId: 'w', evidence: 'declared', reason: '  ' })).toEqual([{ field: 'reason', code: 'REQUIRED', message: expect.any(String) }]);
    expect(validateHandoffBody({ context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'b', evidenceRef: '' })).toHaveLength(1);
    expect(validateOutcomeBody({ value: 'Lost', reason: 'ok' })).toEqual([]);
    expect(validateUnobservedBody({ workId: 'w' })).toEqual([]);
    expect(validateAdvanceBody({ to: 'Contacting', reason: 'đã gọi' })).toEqual([]);
  });
});
