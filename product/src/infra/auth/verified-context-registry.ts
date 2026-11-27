import type { AuthContext, VerifiedContextLookup } from '../../ports/auth';

/**
 * Module-private, request-scoped brand. Only server code holding the request's own headers
 * object (or a server-side shallow copy of it) carries it: HTTP header names are strings, so a
 * client can never send a Symbol-keyed entry, and JSON/body parsing never produces one.
 */
const VERIFIED_BRAND: unique symbol = Symbol('north.verifiedContext');

type Branded = { [VERIFIED_BRAND]?: unknown };

/**
 * Hands an asynchronously verified context to the synchronous `AuthContextResolver` port.
 *
 * A-M5: the context used to be keyed by the identity of the headers object, so any controller
 * that resolved from a copy (`{ ...headers }`, Fastify's `Object.assign` header merge) silently
 * lost it and every OIDC call answered 401. The context is now bound to an opaque per-request
 * brand stored under a module-private, ENUMERABLE symbol on the request's headers object:
 * - shallow server-side copies keep the brand, so lookup no longer depends on object identity;
 * - a client cannot forge it (no header value, cookie or id to guess; symbols never cross HTTP);
 * - the brand value is an empty frozen object; the context itself lives only in a WeakMap
 *   keyed by that brand, so logging/serialising headers exposes nothing and entries are
 *   collected with the request;
 * - a request is branded at most once (non-configurable, non-writable): re-attaching throws.
 */
export class VerifiedContextRegistry implements VerifiedContextLookup {
  private readonly contexts = new WeakMap<object, AuthContext>();

  attach(headers: object, context: AuthContext): void {
    if (Object.prototype.hasOwnProperty.call(headers, VERIFIED_BRAND)) throw new Error('verified context already attached');
    const brand = Object.freeze(Object.create(null) as object);
    Object.defineProperty(headers, VERIFIED_BRAND, { value: brand, enumerable: true, configurable: false, writable: false });
    this.contexts.set(brand, Object.freeze({ ...context }));
  }

  lookup(headers: object): AuthContext | null {
    if (!headers || typeof headers !== 'object') return null;
    const brand = (headers as Branded)[VERIFIED_BRAND];
    if (!brand || typeof brand !== 'object') return null;
    return this.contexts.get(brand) ?? null;
  }
}
