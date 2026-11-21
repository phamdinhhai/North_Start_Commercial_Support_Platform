import { PLATFORMS, validId } from './platform-registry.mjs';
export function backendOrigin(raw, fixture = false) {
  let url; try { url = new URL(raw); } catch { throw new Error('INVALID_BACKEND_ORIGIN'); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || fixture && url.protocol === 'http:' && url.hostname === '127.0.0.1')) throw new Error('INVALID_BACKEND_ORIGIN');
  return url.origin;
}
export function validateEnrollment(input, fixture = false, at = Date.now()) {
  const e = input?.enrollment, supplied = e?.scope;
  const provider = supplied?.provider ?? ({'pancake-conversations':'pancake','meta-ads':'meta-ads','hubspot-crm':'hubspot'}[supplied?.providerSurface]);
  const scope = supplied && {...supplied, provider};
  if (!e || !scope || !PLATFORMS[scope.provider] || !['workspaceId','connectionId','accountId'].every(key => validId(scope[key])) ||
    !validId(e.enrollmentId) || typeof e.token !== 'string' || e.token.length < 32 || e.token.length > 8192 || /\s/.test(e.token) ||
    !Number.isFinite(Date.parse(e.expiresAt)) || Date.parse(e.expiresAt) <= at) throw new Error('INVALID_ENROLLMENT');
  const target = scope.target ?? {};
  if (!Object.keys(target).length || Object.keys(target).some(key => !['pageId','conversationId','campaignId','adsetId','adId','contactId','companyId','dealId'].includes(key) || !validId(target[key]))) throw new Error('INVALID_ENROLLMENT');
  return {origin: backendOrigin(input.origin, fixture), enrollmentId: e.enrollmentId, token: e.token, expiresAt: e.expiresAt,
    scope: {workspaceId: scope.workspaceId, connectionId: scope.connectionId, provider: scope.provider, accountId: scope.accountId, target: {...target}}, fixture};
}
export function matchesEnrollment(context, enrollment) {
  if (!context || !enrollment || context.provider !== enrollment.scope.provider || context.native.accountId !== enrollment.scope.accountId) return false;
  return Object.entries(enrollment.scope.target).every(([key,value]) => context.native[key] === value);
}
export function sameBinding(left, right) {
  return left?.enrollmentId === right?.enrollmentId && left?.origin === right?.origin && JSON.stringify(left?.scope) === JSON.stringify(right?.scope);
}
