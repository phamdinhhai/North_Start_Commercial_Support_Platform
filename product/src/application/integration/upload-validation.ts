import type { IntegrationScope, Upload } from '../../ports/integration';
import { fail, isId as id, isObject as object } from './config';

/**
 * Strict observation keys. ADR-009: no content-derived digest is accepted from the browser; an observation
 * carrying `payloadHash` (or any other extra key) fails the exact-key check with 400 INPUT_INVALID.
 */
export const OBSERVATION_UPLOAD_KEYS: readonly string[] = Object.freeze(['scope', 'captureId', 'sourceRevision', 'externalEventId', 'externalObjectId', 'eventType', 'method', 'evidenceType', 'authenticity', 'completeness', 'occurredAt', 'observedAt']);

export function validateUpload(body: unknown, scope: IntegrationScope): Upload {
    if (!object(body) || Object.keys(body).sort().join() !== 'captureId,observation,pageId,sequence' || !id(body.captureId) || !Number.isSafeInteger(body.sequence) || (body.sequence as number) < 1 || body.pageId !== scope.pageId || !object(body.observation))
        return fail('INPUT_INVALID');
    const o = body.observation;
    const keys = OBSERVATION_UPLOAD_KEYS;
    if (Object.keys(o).sort().join() !== [...keys].sort().join() || !object(o.scope) || Object.keys(o.scope).sort().join() !== 'accountId,connectionId,providerSurface,workspaceId')
        return fail('INPUT_INVALID');
    for (const k of ['workspaceId', 'connectionId', 'accountId', 'providerSurface'] as const)
        if (o.scope[k] !== scope[k])
            return fail('SCOPE_MISMATCH', 403);
    if (o.captureId !== body.captureId || !id(o.sourceRevision) || !id(o.eventType) || o.externalEventId !== null || !(o.externalObjectId === null || id(o.externalObjectId)) || o.method !== 'browser-websocket' || o.evidenceType !== 'client-observed' || o.authenticity !== 'UNKNOWN' || o.completeness !== 'UNKNOWN' || o.occurredAt !== null || typeof o.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(o.observedAt) || !Number.isFinite(Date.parse(o.observedAt)))
        return fail('INPUT_INVALID');
    // Canonical key order makes property-order-only retries identical. Scope is server-derived.
    const observation: Record<string, unknown> = {};
    for (const key of keys)
        observation[key] = key === 'scope' ? { workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: scope.providerSurface } : o[key];
    return { captureId: body.captureId, sequence: body.sequence as number, pageId: scope.pageId, observation };
}
