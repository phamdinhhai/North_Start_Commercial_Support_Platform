import { appendRecord, openGap, possibleGap, outboxBytes } from '../browser-companion/lifecycle.mjs';
import { matchesEnrollment, sameBinding } from './permission-policy.mjs';
export const initialState = () => ({version: 1, session: null, outbox: [], dropped: 0, continuity: 'UNKNOWN', nextSequence: 1, lastAck: null});
export function configure(state, enrollment) {
  if (state.outbox.length && !sameBinding(state.enrollment, enrollment)) throw new Error('PENDING_OUTBOX_BINDING');
  if (sameBinding(state.enrollment,enrollment) && ['blocked','unauthorized','expired'].includes(state.delivery)) throw new Error('FRESH_ENROLLMENT_REQUIRED');
  return {...state, enrollment, session: null, delivery: 'ready', ...(sameBinding(state.enrollment,enrollment) ? {} : {nextSequence:1,pending:null,lastAck:null})};
}
export function appendContext(state, context, at = new Date().toISOString(), captureId = crypto.randomUUID()) {
  if (!matchesEnrollment(context,state.enrollment)) throw new Error('TARGET_SCOPE_MISMATCH');
  const observation = {schemaVersion: 1, captureId, provider: context.provider, providerSurface: context.providerSurface,
    scope: {workspaceId: state.enrollment.scope.workspaceId, connectionId: state.enrollment.scope.connectionId, accountId: state.enrollment.scope.accountId},
    native: {...context.native}, method: 'browser-dom', authenticity: 'CLIENT_OBSERVED', completeness: 'UNKNOWN', observedAt: at,
    sourceRevision: 'north-start-hybrid-browser/0.1.0'};
  const appended = appendRecord(state,observation,at);
  return {...appended.state, session: appended.stop ? null : {...state.session, lastContext: context}, ...(appended.stop ? {lastStop:'outbox-full'} : {})};
}
export function reserve(state, at = Date.now()) {
  if (!state.enrollment?.token || ['blocked','unauthorized','expired','disconnected'].includes(state.delivery)) throw new Error('ENROLLMENT_REQUIRED');
  if (Date.parse(state.enrollment.expiresAt) <= at) return stop({...state,enrollment:{...state.enrollment,token:null},delivery:'expired'},'enrollment-expired');
  if (!state.outbox.length) return state;
  const observation = state.outbox[0];
  if (state.pending && state.pending.captureId !== observation.captureId) throw new Error('OUTBOX_CHANGED');
  if (!Number.isSafeInteger(state.nextSequence) || state.nextSequence < 1) throw new Error('SEQUENCE_EXHAUSTED');
  const pending = state.pending ?? {enrollmentId:state.enrollment.enrollmentId,captureId:observation.captureId,sequence:state.nextSequence,observation};
  if (new TextEncoder().encode(JSON.stringify(pending)).length > 8192) throw new Error('OBSERVATION_SIZE_LIMIT');
  return {...state,pending,delivery:'pending'};
}
export function acknowledge(state,status,ack) {
  if (!state.pending) throw new Error('NO_PENDING_OBSERVATION');
  if ([401,403].includes(status)) return stop({...state,enrollment:{...state.enrollment,token:null},delivery:'unauthorized'},'authorization-revoked');
  if (status === 409) return stop({...state,delivery:'blocked'},'receipt-conflict');
  const p=state.pending;
  if (status<200 || status>=300 || !ack || ack.enrollmentId!==state.enrollment.enrollmentId || ack.captureId!==p.captureId || ack.sequence!==p.sequence ||
    !['stored','duplicate'].includes(ack.disposition) || typeof ack.receiptId!=='string' || ack.receiptId.length<1 ||
    !Number.isSafeInteger(ack.checkpoint) || ack.checkpoint<p.sequence || ack.disposition==='stored' && ack.checkpoint!==p.sequence || ack.completeness!=='UNKNOWN') return {...state,delivery:'retry-required'};
  return {...state,outbox:state.outbox.slice(1),pending:null,nextSequence:ack.checkpoint+1,delivery:'ready',lastAck:{receiptId:ack.receiptId,checkpoint:ack.checkpoint,at:new Date().toISOString()}};
}
export function stop(state,reason) { return openGap({...state,session:null,lastStop:reason},reason); }
export function recover(state) { return state.session ? possibleGap({...state,session:null,lastStop:'worker-restarted'},'worker-restarted',state.lastObservedAt ?? state.session.startedAt,new Date().toISOString()) : state; }
export function health(state) {
  return {active:Boolean(state.session),provider:state.enrollment?.scope.provider ?? null,enrollment:state.enrollment ? state.delivery : 'not-enrolled',pending:state.outbox.length,
    outboxBytes:outboxBytes(state.outbox),lastAck:state.lastAck ?? null,lastStop:state.lastStop ?? null,completeness:'UNKNOWN',gaps:(state.gaps??[]).slice(-5),diagnosticActive:Boolean(state.diagnostic)};
}
