import { describe, expect, it, vi } from 'vitest';
import { DataLifecycleController } from './data-lifecycle.controller';
import type { AuthContext } from '../ports/auth';
const ctx: AuthContext = { workspaceId: 'trusted', userId: 'actor', role: 'admin', isDemo: false };
describe('lifecycle HTTP boundary', () => {
  it('denies anonymous and non-admin calls without storage', async () => {
    const store = { configure: vi.fn(), preview: vi.fn() };
    await expect(new DataLifecycleController({ resolve: () => null }, store).preview({}, 'audit', {})).rejects.toMatchObject({ status: 401 });
    await expect(new DataLifecycleController({ resolve: () => ({ ...ctx, role: 'sales' }) }, store).preview({}, 'audit', {})).rejects.toMatchObject({ status: 403 });
    expect(store.preview).not.toHaveBeenCalled();
  });
  it('rejects client clocks and masks storage failure', async () => {
    const store = { configure: vi.fn(), preview: vi.fn().mockRejectedValue(new Error('database secret')) };
    const controller = new DataLifecycleController({ resolve: () => ctx }, store);
    await expect(controller.preview({}, 'audit', { asOf: '2099-01-01' })).rejects.toMatchObject({ status: 400 });
    expect(store.preview).not.toHaveBeenCalled();
    await expect(controller.preview({}, 'audit', {})).rejects.toMatchObject({ status: 500, response: { code: 'INTERNAL' } });
    expect(store.preview).toHaveBeenCalledWith('trusted', 'actor', 'audit');
  });
});
