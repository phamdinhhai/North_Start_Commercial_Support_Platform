import { isBaseRole } from '../../domain/governed-action/capability-matrix';
import type { ActionActor, ActionPrincipal } from '../../domain/governed-action/governed-action.types';
import type { AuthContext } from '../../ports/auth';
import type { ActorResolver, WorkspaceRoleLookup } from '../../ports/governed-action';

/** A non-human principal configured server-side (never self-declared by a caller). */
export interface ServicePrincipalRegistration {
  readonly workspaceId: string;
  readonly id: string;
  readonly kind: 'ai' | 'service';
}

export interface AuthContextActorResolverDeps {
  /** Base role from server-side membership (ADR-006), consulted on every resolve (revocation applies next request). */
  readonly roles: WorkspaceRoleLookup;
  readonly servicePrincipals: readonly ServicePrincipalRegistration[];
}

const key = (workspaceId: string, id: string) => `${workspaceId}\u0000${id}`;

/**
 * ADR-006 production ActorResolver (A-m2 kept: the caller's claimed kind is ignored).
 * - A principal in the server-side registry resolves to its registered kind (`ai` / `service`).
 * - Otherwise an active workspace member (any base role) resolves to `human`.
 * - A principal that is BOTH registered and a member is ambiguous and is refused; unknown
 *   principals and lookup failures are refused (fail closed).
 */
export class AuthContextActorResolver implements ActorResolver {
  private readonly registry = new Map<string, ServicePrincipalRegistration['kind']>();

  constructor(private readonly deps: AuthContextActorResolverDeps) {
    for (const p of deps.servicePrincipals) {
      if (!p?.workspaceId || !p.id) throw new Error('service principal needs workspaceId and id');
      if (p.kind !== 'ai' && p.kind !== 'service') throw new Error(`service principal ${p.id}: kind must be ai or service`);
      if (this.registry.has(key(p.workspaceId, p.id))) throw new Error(`duplicate service principal ${p.id}`);
      this.registry.set(key(p.workspaceId, p.id), p.kind);
    }
  }

  async resolve(principal: ActionPrincipal): Promise<ActionActor | undefined> {
    const id = principal?.id;
    const workspaceId = principal?.workspaceId;
    if (typeof id !== 'string' || !id || typeof workspaceId !== 'string' || !workspaceId) return undefined;
    let role: unknown;
    try {
      role = await this.deps.roles.baseRoleOf(workspaceId, id);
    } catch {
      return undefined;
    }
    const registered = this.registry.get(key(workspaceId, id));
    const member = isBaseRole(role);
    if (registered && member) return undefined; // ambiguous identity ⇒ refuse
    if (registered) return { kind: registered, id, workspaceId };
    return member ? { kind: 'human', id, workspaceId } : undefined;
  }
}

/**
 * Turn a server-resolved AuthContext into an action principal: identity + workspace only (the
 * role is re-read from membership by the policy). Demo contexts never act.
 */
export function principalFromAuthContext(ctx: AuthContext | null | undefined): ActionPrincipal | undefined {
  if (!ctx || ctx.isDemo || typeof ctx.userId !== 'string' || !ctx.userId.trim() ||
      typeof ctx.workspaceId !== 'string' || !ctx.workspaceId.trim()) return undefined;
  return { id: ctx.userId, workspaceId: ctx.workspaceId };
}
