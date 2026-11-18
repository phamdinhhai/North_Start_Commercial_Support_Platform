import type { AuthContext, VerifiedContextLookup } from '../../ports/auth';

/**
 * Hands an asynchronously verified context to the synchronous `AuthContextResolver` port.
 *
 * Keyed by the server-owned request headers object (object identity, held weakly), so a client
 * cannot forge an entry: there is no header value, cookie or id to guess. If a framework ever
 * copies the headers object, lookup simply misses and the request is unauthenticated
 * (fail closed). Entries disappear with the request object.
 */
export class VerifiedContextRegistry implements VerifiedContextLookup {
  private readonly contexts = new WeakMap<object, AuthContext>();

  attach(headers: object, context: AuthContext): void {
    this.contexts.set(headers, Object.freeze({ ...context }));
  }

  lookup(headers: object): AuthContext | null {
    if (!headers || typeof headers !== 'object') return null;
    return this.contexts.get(headers) ?? null;
  }
}
