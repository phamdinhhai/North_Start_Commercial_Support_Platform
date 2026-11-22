import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Enrollment } from '../../ports/integration';
import { fail, isId, isObject, type IntakeConfig, type SigningKey } from './config';

/**
 * Enrollment capability token v2: `b64url(header).b64url(claims).b64url(HMAC-SHA256)`.
 * The MAC covers header and claims, so the `kid` cannot be swapped without the target key.
 * `claims.id` is the enrollment id and acts as the jti: it is bound server-side to a durable
 * enrollment row whose scope, expiry and revocation are re-checked under row lock.
 */
export const CAPABILITY = 'observation:append';
const TYP = 'AIL-ENROLLMENT';
const MAX_TOKEN = 4096;
export interface Claims extends Enrollment { version: 2; capability: typeof CAPABILITY; kid: string; iat: number }

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const mac = (secret: string, input: string) => createHmac('sha256', secret).update(input).digest('base64url');
const equal = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const unauthorized = (): never => fail('UNAUTHORIZED', 401);
const decode = (part: string): unknown => {
    if (!/^[A-Za-z0-9_-]+$/.test(part)) return unauthorized();
    try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); } catch { return unauthorized(); }
};

export function sign(enrollment: Enrollment, key: SigningKey & { secret: string }, now = Date.now()): string {
    const claims: Claims = { version: 2, id: enrollment.id, scope: enrollment.scope, expiresAt: enrollment.expiresAt, capability: CAPABILITY, kid: key.kid, iat: Math.floor(now / 1000) };
    const input = b64({ alg: 'HS256', typ: TYP, kid: key.kid }) + '.' + b64(claims);
    return input + '.' + mac(key.secret, input);
}

/** Uniform 401 for every failure so callers cannot distinguish unknown, retired or forged keys. */
export function verify(authorization: unknown, config: IntakeConfig, now = Date.now()): Claims {
    if (typeof authorization !== 'string' || authorization.length > MAX_TOKEN + 7 || !authorization.startsWith('Bearer '))
        return unauthorized();
    const parts = authorization.slice(7).split('.');
    if (parts.length !== 3) return unauthorized();
    const header = decode(parts[0]);
    if (!isObject(header) || Object.keys(header).sort().join() !== 'alg,kid,typ' || header.alg !== 'HS256' || header.typ !== TYP || typeof header.kid !== 'string')
        return unauthorized();
    const key = config.keys.find((k) => k.kid === header.kid);
    // Unknown kid and retired kid are both rejected before any MAC work with a guessed key.
    if (!key || key.state === 'retired' || !key.secret) return unauthorized();
    if (!equal(mac(key.secret, parts[0] + '.' + parts[1]), parts[2])) return unauthorized();
    const c = decode(parts[1]);
    if (!isObject(c) || Object.keys(c).sort().join() !== 'capability,expiresAt,iat,id,kid,scope,version' || c.version !== 2 || c.capability !== CAPABILITY
        || c.kid !== header.kid || !isId(c.id) || !Number.isSafeInteger(c.iat) || typeof c.expiresAt !== 'string')
        return unauthorized();
    const expiry = Date.parse(c.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) return unauthorized();
    // Claimed scope must still be on the server allowlist (removal ends intake for that scope).
    if (!config.scopes.some((s) => JSON.stringify(s) === JSON.stringify(c.scope))) return unauthorized();
    return c as unknown as Claims;
}
