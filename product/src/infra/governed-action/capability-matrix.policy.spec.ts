import { describe, expect, it, vi } from 'vitest';
import { createCapabilityCatalog, riskTierOf, type CapabilityDefinition } from '../../domain/governed-action/capability-catalog';
import type { ActionActor, CommercialEventFacts, RiskClass } from '../../domain/governed-action/governed-action.types';
import { SYNTHETIC_CAPABILITY_DEFINITIONS } from '../../domain/governed-action/testing/synthetic-capabilities.fixture';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import type { ActionPolicyContext, LeadAccessPort } from '../../ports/governed-action';
import { RbacService, type Resource } from '../rbac/rbac.service';
import { AuthContextActorResolver, principalFromAuthContext } from './actor-resolution';
import { CapabilityMatrixActionPolicy } from './capability-matrix.policy';
import { RbacLeadAccessAdapter, StaticWorkspaceRoleLookup } from './lead-access';
import { createSyntheticActionPorts } from './synthetic-runtime';
import { WorkspaceKillSwitch } from './workspace-kill-switch';

/** ADR-006 (resolves PM-1): production capability matrix, actor resolution and the lead-scope hook. */
const WS = 'ws-a';
const LEAD = '7f1c2a9e-4b6d-4c1a-9f3e-2d5b8a7c6e10';
const OTHER_LEAD = '0b6f6b0e-3d0e-4a59-8f53-0f2a4f6c1d22';
const human = (id: string, workspaceId = WS): ActionActor => ({ kind: 'human', id, workspaceId });
const admin = human('u-admin');
const admin2 = human('u-admin-2');
const manager = human('u-manager');
const sales = human('u-sales');
const viewer = human('u-viewer');
const stranger = human('u-stranger');
const ai: ActionActor = { kind: 'ai', id: 'svc:copilot', workspaceId: WS };
const svc: ActionActor = { kind: 'service', id: 'svc:sync', workspaceId: WS };
const roles = new StaticWorkspaceRoleLookup([
  { workspaceId: WS, userId: 'u-admin', role: 'admin' }, { workspaceId: WS, userId: 'u-admin-2', role: 'admin' },
  { workspaceId: WS, userId: 'u-manager', role: 'manager' }, { workspaceId: WS, userId: 'u-sales', role: 'sales' },
  { workspaceId: WS, userId: 'u-viewer', role: 'viewer' },
]);
/** Lead store double: LEAD is assigned to u-sales; u-viewer is an active recipient. OTHER_LEAD belongs to nobody. */
const leadsTable: Record<string, Resource> = {
  [LEAD]: { id: LEAD, workspaceId: WS, assignedTo: 'u-sales', recipients: ['u-viewer'] },
  [OTHER_LEAD]: { id: OTHER_LEAD, workspaceId: WS, assignedTo: 'u-other' },
};
const leads = new RbacLeadAccessAdapter(async (_ws, leadId) => leadsTable[leadId], new RbacService());
const constraints = { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 15 * 60_000 };
const policy = new CapabilityMatrixActionPolicy({ roles, leads, constraints });
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const ctx = (riskClass: RiskClass, extra: Partial<ActionPolicyContext> = {}): ActionPolicyContext =>
  ({ workspaceId: WS, capabilityId: 'cap', riskClass, target, ...extra });
const allowed = async (p: Promise<{ allowed: boolean }>) => (await p).allowed;

describe('ADR-006 capability matrix — base roles', () => {
  const who = { admin, manager, sales, viewer } as const;
  type Row = readonly [string, (a: ActionActor) => Promise<{ allowed: boolean }>, Record<keyof typeof who, boolean>];
  const rows: Row[] = [
    ['propose (no lead)', (a) => policy.mayPropose(a, ctx('LOW')), { admin: true, manager: true, sales: false, viewer: false }],
    ['propose (assigned lead)', (a) => policy.mayPropose(a, ctx('HIGH', { leadId: LEAD })), { admin: true, manager: true, sales: true, viewer: false }],
    ['propose (unassigned lead)', (a) => policy.mayPropose(a, ctx('LOW', { leadId: OTHER_LEAD })), { admin: true, manager: true, sales: false, viewer: false }],
    ['authorize LOW', (a) => policy.mayApprove(a, ctx('LOW')), { admin: true, manager: true, sales: false, viewer: false }],
    ['authorize MEDIUM (treated as high)', (a) => policy.mayApprove(a, ctx('MEDIUM')), { admin: true, manager: false, sales: false, viewer: false }],
    ['authorize HIGH', (a) => policy.mayApprove(a, ctx('HIGH', { leadId: LEAD })), { admin: true, manager: false, sales: false, viewer: false }],
    ['authorize CRITICAL', (a) => policy.mayApprove(a, ctx('CRITICAL')), { admin: true, manager: false, sales: false, viewer: false }],
    ['execute/verify LOW', (a) => policy.mayTriggerExecution(a, ctx('LOW')), { admin: true, manager: true, sales: false, viewer: false }],
    ['execute/verify HIGH', (a) => policy.mayTriggerExecution(a, ctx('HIGH')), { admin: true, manager: false, sales: false, viewer: false }],
    ['read (no lead)', (a) => policy.mayRead(a, ctx('LOW'), 'get'), { admin: true, manager: true, sales: false, viewer: false }],
    ['read (lead in scope)', (a) => policy.mayRead(a, ctx('HIGH', { leadId: LEAD }), 'history'), { admin: true, manager: true, sales: true, viewer: true }],
    ['read (lead out of scope)', (a) => policy.mayRead(a, ctx('LOW', { leadId: OTHER_LEAD }), 'refusals'), { admin: true, manager: true, sales: false, viewer: false }],
    ['housekeeping', (a) => policy.mayHousekeep(a, ctx('HIGH'), 'expire'), { admin: true, manager: true, sales: false, viewer: false }],
    ['kill switch', (a) => policy.mayOperateKillSwitch(a, { workspaceId: WS }), { admin: true, manager: false, sales: false, viewer: false }],
    ['lead access (assigned/recipient)', (a) => policy.mayAccessLead(a, { ...ctx('LOW'), leadId: LEAD }), { admin: true, manager: true, sales: true, viewer: true }],
    ['lead access (other lead)', (a) => policy.mayAccessLead(a, { ...ctx('LOW'), leadId: OTHER_LEAD }), { admin: true, manager: true, sales: false, viewer: false }],
  ];
  it.each(rows)('%s', async (_label, decide, expected) => {
    const actual = Object.fromEntries(await Promise.all(Object.entries(who).map(async ([k, a]) => [k, await allowed(decide(a))])));
    expect(actual).toEqual(expected);
  });

  it('never issues a service grant, and denies unknown members, foreign workspaces and failing role lookups', async () => {
    for (const d of [await policy.mayTriggerExecution(admin, ctx('LOW')), await policy.mayApprove(admin, ctx('LOW'))]) {
      expect(d).toEqual({ allowed: true });
    }
    expect(await allowed(policy.mayPropose(stranger, ctx('LOW')))).toBe(false);
    expect(await allowed(policy.mayApprove(human('u-admin', 'ws-b'), ctx('LOW')))).toBe(false);
    const broken = new CapabilityMatrixActionPolicy({ roles: { baseRoleOf: async () => { throw new Error('down'); } }, leads, constraints });
    expect(await allowed(broken.mayApprove(admin, ctx('LOW')))).toBe(false);
    const leadDown = new CapabilityMatrixActionPolicy({ roles, leads: { canAccessLead: async () => { throw new Error('down'); } }, constraints });
    expect(await allowed(leadDown.mayAccessLead(admin, { ...ctx('LOW'), leadId: LEAD }))).toBe(false);
    expect(await policy.constraintsFor(ctx('LOW'))).toEqual(constraints);
  });
});

describe('ADR-006 capability matrix — AI and service principals', () => {
  it('AI may only draft (and handle its own drafts); service principals get nothing', async () => {
    const own = { proposer: { kind: 'ai' as const, id: ai.id } };
    const others = { proposer: { kind: 'human' as const, id: 'u-sales' } };
    expect(await allowed(policy.mayPropose(ai, ctx('HIGH', { leadId: LEAD })))).toBe(true);
    expect(await allowed(policy.mayPropose(ai, ctx('HIGH', { leadId: LEAD, ...own })))).toBe(true);
    expect(await allowed(policy.mayPropose(ai, ctx('HIGH', { leadId: LEAD, ...others })))).toBe(false);
    expect(await allowed(policy.mayAccessLead(ai, { ...ctx('LOW'), leadId: LEAD }))).toBe(true);
    expect(await allowed(policy.mayAccessLead(ai, { ...ctx('LOW', others), leadId: LEAD }))).toBe(false);
    for (const a of [ai, svc]) {
      expect(await allowed(policy.mayApprove(a, ctx('LOW')))).toBe(false);
      expect(await allowed(policy.mayTriggerExecution(a, ctx('LOW')))).toBe(false);
      expect(await allowed(policy.mayRead(a, ctx('LOW'), 'get'))).toBe(false);
      expect(await allowed(policy.mayHousekeep(a, ctx('LOW'), 'recover'))).toBe(false);
      expect(await allowed(policy.mayOperateKillSwitch(a, { workspaceId: WS }))).toBe(false);
    }
    expect(await allowed(policy.mayPropose(svc, ctx('LOW')))).toBe(false);
    expect(await allowed(policy.mayAccessLead(svc, { ...ctx('LOW'), leadId: LEAD }))).toBe(false);
  });
});

describe('ADR-006 risk class is catalog data', () => {
  it('money/budget/order/payment/outbound messaging/conversion upload must be HIGH or CRITICAL; only LOW is the low tier', () => {
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((r) => riskTierOf(r as RiskClass))).toEqual(['low', 'high', 'high', 'high']);
    const base = SYNTHETIC_CAPABILITY_DEFINITIONS.find((d) => d.id === 'ads.offline_conversion.upload')!;
    expect(base).toMatchObject({ riskClass: 'HIGH', impact: ['conversion_upload'] });
    for (const impact of ['money', 'budget', 'order', 'payment', 'outbound_customer_message', 'conversion_upload'] as const) {
      const def: CapabilityDefinition = { ...base, id: `x.${impact}`, impact: [impact], riskClass: 'LOW' };
      expect(() => createCapabilityCatalog([def]), impact).toThrow(/high-impact/);
      expect(() => createCapabilityCatalog([{ ...def, riskClass: 'MEDIUM' }])).toThrow(/high-impact/);
    }
    expect(() => createCapabilityCatalog([{ ...base, id: 'x.unknown', riskClass: 'BOGUS' as RiskClass }])).toThrow(/risk class/);
    for (const d of SYNTHETIC_CAPABILITY_DEFINITIONS) expect(d.impact.length > 0 || d.riskClass === 'LOW').toBe(true);
  });
});

describe('ADR-006 actor resolution (A-m2 kept)', () => {
  const resolver = new AuthContextActorResolver({ roles, servicePrincipals: [
    { workspaceId: WS, id: 'svc:copilot', kind: 'ai' }, { workspaceId: WS, id: 'svc:sync', kind: 'service' },
    { workspaceId: WS, id: 'u-admin-2', kind: 'ai' },
  ] });
  it('members resolve as human from server-side membership; registered principals as ai/service; claims are ignored', async () => {
    expect(await resolver.resolve({ id: 'u-sales', workspaceId: WS })).toEqual({ kind: 'human', id: 'u-sales', workspaceId: WS });
    expect(await resolver.resolve({ id: 'u-sales', workspaceId: WS, kind: 'service' } as unknown as ActionActor)).toEqual({ kind: 'human', id: 'u-sales', workspaceId: WS });
    expect(await resolver.resolve({ id: 'svc:copilot', workspaceId: WS, kind: 'human' } as unknown as ActionActor)).toEqual(ai);
    expect(await resolver.resolve({ id: 'svc:sync', workspaceId: WS })).toEqual(svc);
    expect(await resolver.resolve({ id: 'svc:copilot', workspaceId: 'ws-b' })).toBeUndefined();
    expect(await resolver.resolve({ id: 'u-stranger', workspaceId: WS })).toBeUndefined();
    expect(await resolver.resolve({ id: 'u-admin-2', workspaceId: WS })).toBeUndefined(); // ambiguous ⇒ refused
    const broken = new AuthContextActorResolver({ roles: { baseRoleOf: async () => { throw new Error('down'); } }, servicePrincipals: [] });
    expect(await broken.resolve({ id: 'u-sales', workspaceId: WS })).toBeUndefined();
  });
  it('rejects a malformed registry and never turns a demo context into a principal', () => {
    expect(() => new AuthContextActorResolver({ roles, servicePrincipals: [{ workspaceId: WS, id: 'x', kind: 'human' as 'ai' }] })).toThrow(/kind/);
    expect(() => new AuthContextActorResolver({ roles, servicePrincipals: [{ workspaceId: WS, id: 'x', kind: 'ai' }, { workspaceId: WS, id: 'x', kind: 'service' }] })).toThrow(/duplicate/);
    expect(principalFromAuthContext({ workspaceId: WS, userId: 'u-admin', role: 'admin', isDemo: false })).toEqual({ id: 'u-admin', workspaceId: WS });
    expect(principalFromAuthContext({ workspaceId: 'demo:x', userId: 'd', role: 'viewer', isDemo: true })).toBeUndefined();
    expect(principalFromAuthContext({ workspaceId: '', userId: 'u', role: 'admin', isDemo: false })).toBeUndefined();
  });
});

describe('ADR-006 lead-scope hook backed by RbacService.canAccessLead', () => {
  it('wraps an injected lead loader + lead policy; missing, foreign or failing lookups deny', async () => {
    const s = (userId: string, baseRole: 'admin' | 'manager' | 'sales' | 'viewer') => ({ workspaceId: WS, userId, baseRole });
    expect(await leads.canAccessLead(s('u-sales', 'sales'), LEAD)).toBe(true);
    expect(await leads.canAccessLead(s('u-sales', 'sales'), OTHER_LEAD)).toBe(false);
    expect(await leads.canAccessLead(s('u-viewer', 'viewer'), LEAD)).toBe(true);
    expect(await leads.canAccessLead(s('u-manager', 'manager'), OTHER_LEAD)).toBe(true);
    expect(await leads.canAccessLead(s('u-admin', 'admin'), '11111111-1111-4111-8111-111111111111')).toBe(false);
    const foreign = new RbacLeadAccessAdapter(async () => ({ id: LEAD, workspaceId: 'ws-b' }), new RbacService());
    expect(await foreign.canAccessLead(s('u-admin', 'admin'), LEAD)).toBe(false);
    const throwing = new RbacLeadAccessAdapter(async () => { throw new Error('down'); }, new RbacService());
    expect(await throwing.canAccessLead(s('u-admin', 'admin'), LEAD)).toBe(false);
    const check = vi.fn(() => true);
    await new RbacLeadAccessAdapter(async () => leadsTable[LEAD], { canAccessLead: check }).canAccessLead(s('u-sales', 'sales'), LEAD.toUpperCase());
    expect(check).toHaveBeenCalledWith({ workspaceId: WS, userId: 'u-sales', role: 'sales', isDemo: false }, leadsTable[LEAD]);
  });
});

describe('ADR-006 end-to-end through GovernedActionService', () => {
  const CE = 'c0ffee00-0000-4000-8000-000000000001';
  const ce: CommercialEventFacts = { id: CE, workspaceId: WS, leadId: LEAD, acquisitionMode: 'inferred', assertionStatus: 'draft', evidencePointers: ['envelope:1'] };
  const BUDGET = 'ads.campaign.budget.update';
  const TAG = 'pancake.conversation.tag.update';
  const conversation = { provider: 'synthetic-pancake', accountId: 'page-1', resourceType: 'conversation', resourceId: 'conv-1' };
  const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });
  function harness() {
    const ports = createSyntheticActionPorts({
      enabled: [{ workspaceId: WS, capabilityId: BUDGET }, { workspaceId: WS, capabilityId: TAG }], clock: () => new Date('2026-11-18T09:00:00Z'),
      policy: { constraints, proposers: [], approvers: [], executors: [] }, commercialEvents: [ce],
    });
    ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
    const killSwitch = new WorkspaceKillSwitch();
    const actors = new AuthContextActorResolver({ roles, servicePrincipals: [{ workspaceId: WS, id: ai.id, kind: 'ai' }] });
    const service = new GovernedActionService({ ...ports, policy, actors, killSwitch, killSwitchControl: killSwitch,
      clock: { now: () => new Date('2026-11-18T09:00:00Z') }, executionTimeoutMs: 50, readbackTimeoutMs: 50 });
    const approve = async (by: ActionActor, id: string) => {
      const p = await service.preview(admin, id);
      return service.authorize(by, id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok' });
    };
    return { service, approve, killSwitch };
  }
  const code = (p: Promise<unknown>) => p.then(() => 'RESOLVED', (e: { code?: string }) => e.code ?? String(e));

  it('sales drafts on its own lead; manager authorizes low risk only; admin authorizes and executes high risk; SoD holds', async () => {
    const h = harness();
    const rk = () => `rk-${Math.random()}`;
    expect(await code(h.service.propose(sales, { requestKey: rk(), capabilityId: BUDGET, target, arguments: budget('110000'), rationale: 'r' }))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(await code(h.service.propose(sales, { requestKey: rk(), capabilityId: BUDGET, target, arguments: budget('110000'), rationale: 'r', leadId: OTHER_LEAD }))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(await code(h.service.propose(viewer, { requestKey: rk(), capabilityId: BUDGET, target, arguments: budget('110000'), rationale: 'r', leadId: LEAD }))).toBe('ACTOR_NOT_AUTHORIZED');
    const high = await h.service.propose(sales, { requestKey: rk(), capabilityId: BUDGET, target, arguments: budget('110000'), rationale: 'r', leadId: LEAD });
    const low = await h.service.propose(sales, { requestKey: rk(), capabilityId: TAG, target: conversation, arguments: { tagRef: 'hot', operation: 'ADD' }, rationale: 'r', leadId: LEAD });
    expect(await code(h.approve(manager, high.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect((await h.approve(manager, low.id)).state).toBe('AUTHORIZED');
    expect(await code(h.approve(sales, high.id))).toBe('SELF_APPROVAL_DENIED');
    expect(await code(h.approve(viewer, high.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect((await h.approve(admin, high.id)).state).toBe('AUTHORIZED');
    expect(await code(h.service.execute(manager, high.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect((await h.service.execute(admin, high.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(await code(h.service.get(viewer, high.id))).toBe('RESOLVED');

    const own = await h.service.propose(admin, { requestKey: rk(), capabilityId: BUDGET, target, arguments: budget('105000'), rationale: 'r' });
    expect(await code(h.approve(admin, own.id))).toBe('SELF_APPROVAL_DENIED');
    expect((await h.approve(admin2, own.id)).state).toBe('AUTHORIZED');
    expect(await code(h.service.get(viewer, own.id))).toBe('ACTOR_NOT_AUTHORIZED');
  });

  it('AI principals from the server-side registry draft with a CE and can never authorize', async () => {
    const h = harness();
    const draft = await h.service.propose(ai, { requestKey: 'rk-ai', capabilityId: BUDGET, target, arguments: budget('110000'), rationale: 'ai', leadId: LEAD, commercialEventRef: CE });
    expect(draft.proposer).toEqual({ kind: 'ai', id: ai.id });
    expect(await code(h.approve(ai, draft.id))).toBe('AI_CANNOT_AUTHORIZE');
    expect((await h.approve(admin, draft.id)).state).toBe('AUTHORIZED');
  });

  it('the kill switch is admin only and stops execution in its workspace', async () => {
    const h = harness();
    const p = await h.service.propose(sales, { requestKey: 'rk-k', capabilityId: BUDGET, target, arguments: budget('110000'), rationale: 'r', leadId: LEAD });
    await h.approve(admin, p.id);
    expect(await code(h.service.operateKillSwitch(manager, { engaged: true, reason: 'stop' }))).toBe('ACTOR_NOT_AUTHORIZED');
    await h.service.operateKillSwitch(admin, { engaged: true, capabilityId: BUDGET, reason: 'incident' });
    expect(await code(h.service.execute(admin, p.id))).toBe('KILL_SWITCH_ENGAGED');
    await h.service.operateKillSwitch(admin, { engaged: false, capabilityId: BUDGET, reason: 'resolved' });
    expect((await h.service.execute(admin, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(h.killSwitch.operations(WS).map((o) => [o.engaged, o.capabilityId, o.actor.id])).toEqual([[true, BUDGET, 'u-admin'], [false, BUDGET, 'u-admin']]);
    expect(h.killSwitch.operations('ws-b')).toEqual([]);
  });
});
