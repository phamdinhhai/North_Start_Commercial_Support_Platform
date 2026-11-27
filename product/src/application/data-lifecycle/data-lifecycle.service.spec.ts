import { describe, expect, it, vi } from 'vitest';
import { DataLifecycleService } from './data-lifecycle.service';
import type { AuthContext } from '../../ports/auth';

const admin: AuthContext = { workspaceId: 'trusted', userId: 'actor', role: 'admin', isDemo: false };
const input = { dataClass: 'accepted_evidence', retentionSeconds: 60, approvalRef: 'REVIEW-TEST', expectedRevision: 0 };
describe('lifecycle planning authorization and input boundary', () => {
  const store = { configure: vi.fn(), preview: vi.fn() };
  const service = new DataLifecycleService(store);
  it.each(['manager', 'sales', 'viewer'] as const)('denies %s before storage', async role => {
    await expect(service.configure({ ...admin, role }, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.preview({ ...admin, role }, 'audit')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(store.configure).not.toHaveBeenCalled(); expect(store.preview).not.toHaveBeenCalled();
  });
  it('denies demo admin', async () => {
    await expect(service.configure({ ...admin, isDemo: true }, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it.each([0, -1, 1.2, NaN, Infinity, 2147483648, '60'])('rejects invalid retention %s', async retentionSeconds => {
    await expect(service.configure(admin, { ...input, retentionSeconds })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it.each([{ workspaceId: 'foreign' }, { asOf: '2099-01-01' }, { approvalRef: 'private body text' }, { dataClass: 'raw_research' }, { expectedRevision: -1 }])('rejects injected or invalid input %j', async override => {
    await expect(service.configure(admin, { ...input, ...override })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('uses trusted workspace and actor', async () => {
    await service.configure(admin, input);
    expect(store.configure).toHaveBeenLastCalledWith('trusted', 'actor', input);
  });
});
