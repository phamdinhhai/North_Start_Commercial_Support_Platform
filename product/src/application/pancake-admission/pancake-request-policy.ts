/** Offline, server-owned request gate. This neither authenticates credentials nor activates transport. */
export interface VerifiedPancakeTarget {
  accountId: string; pageId: string; conversationId: string; contactId: string;
  verificationEvidenceId: string;
}
export interface PancakeRouteAdmission {
  capability: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Exact URL without query or credentials, resolved by the reviewed harness. */
  url: string; contractEvidenceId: string; classification: 'OFFICIAL' | 'PRIVATE_OBSERVED';
  effect: 'READ' | 'MUTATION' | 'OUTGOING_MESSAGE';
}
export interface PancakeRequestIntent {
  capability: string; method: string; url: string; target: VerifiedPancakeTarget;
  /** Required for every mutation; references only, never raw customer snapshots. */
  recovery?: { preconditionEvidenceId: string; expectedEffect: string; readbackPlan: string; cleanupPlan: string };
  recipientPermissionEvidenceId?: string;
}
const deny = (): never => { throw new Error('PANCAKE_REQUEST_DENIED'); };
const targetKeys = ['accountId', 'pageId', 'conversationId', 'contactId', 'verificationEvidenceId'] as const;
function validReference(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\r\n]/u.test(value);
}
function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !['pancake.vn', 'pages.fm'].includes(url.hostname) || url.port) return deny();
    return url.href;
  } catch { return deny(); }
}
/** No discovery/list routes are supplied by default. Only independently reviewed exact targets are admitted. */
export class PancakeRequestPolicy {
  private readonly target: VerifiedPancakeTarget;
  private readonly routes: readonly PancakeRouteAdmission[];
  private attempts = 0;
  private lastAttempt: number | undefined;
  private stopped = false;
  private awaitingResponse = false;
  constructor(target: VerifiedPancakeTarget, routes: readonly PancakeRouteAdmission[],
    private readonly ceiling = 25, private readonly minDelayMs = 1000) {
    if (!target || !targetKeys.every(key => Object.hasOwn(target, key) && validReference(target[key])) ||
      Object.keys(target).length !== targetKeys.length ||
      !Number.isInteger(ceiling) || ceiling < 1 || ceiling > 25 || !Number.isFinite(minDelayMs) || minDelayMs < 1000 ||
      !Array.isArray(routes) || routes.length > 25) deny();
    this.target = {...target};
    this.routes = routes.map(route => {
      if (!validReference(route.capability) || !validReference(route.contractEvidenceId) ||
        !['GET', 'POST', 'PUT', 'DELETE'].includes(route.method) ||
        !['OFFICIAL', 'PRIVATE_OBSERVED'].includes(route.classification) ||
        !['READ', 'MUTATION', 'OUTGOING_MESSAGE'].includes(route.effect) ||
        (route.effect === 'READ') !== (route.method === 'GET')) deny();
      return {...route, url: safeUrl(route.url)};
    });
  }
  admit(intent: PancakeRequestIntent, now: number): { attempt: number; classification: PancakeRouteAdmission['classification'] } {
    if (this.stopped || this.awaitingResponse || !Number.isFinite(now) || this.attempts >= this.ceiling ||
      (this.lastAttempt !== undefined && now - this.lastAttempt < this.minDelayMs) ||
      !intent.target || Object.keys(this.target).some(key =>
        this.target[key as keyof VerifiedPancakeTarget] !== intent.target[key as keyof VerifiedPancakeTarget])) deny();
    const url = safeUrl(intent.url);
    const route = this.routes.find(row => row.capability === intent.capability && row.method === intent.method && row.url === url);
    if (!route) return deny();
    if (route.effect !== 'READ' && (!intent.recovery ||
      !['preconditionEvidenceId', 'expectedEffect', 'readbackPlan', 'cleanupPlan'].every(key =>
        validReference(intent.recovery![key as keyof NonNullable<PancakeRequestIntent['recovery']>])))) deny();
    if (route.effect === 'OUTGOING_MESSAGE' && !validReference(intent.recipientPermissionEvidenceId ?? '')) deny();
    this.attempts++;
    this.lastAttempt = now;
    this.awaitingResponse = true;
    return {attempt: this.attempts, classification: route.classification};
  }
  /** Must be called before another admission; redirects and out-of-scope data are terminal. */
  observe(result: {status: number; redirected?: boolean; scopeMismatch?: boolean}): void {
    if (!this.awaitingResponse || !Number.isInteger(result.status) || result.status < 100 || result.status > 599 ||
      (result.status >= 300 && result.status < 400) ||
      [401, 403, 429].includes(result.status) || result.redirected || result.scopeMismatch) this.stopped = true;
    this.awaitingResponse = false;
  }
  stop(): void { this.stopped = true; }
}
