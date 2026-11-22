import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SyntheticResearchVault } from './synthetic-research-vault';
import type { AuthContext } from '../../ports/auth';
const ctx: AuthContext = { workspaceId: 'synthetic', userId: 'admin', role: 'admin', isDemo: false };
describe('isolated synthetic research vault fixture (never capture)', () => {
  it('encrypts, isolates, expires access and purges with audit recovery', async () => {
    let now = 1000; const key = randomBytes(32); const append = vi.fn().mockResolvedValue(undefined);
    const vault = new SyntheticResearchVault('test', () => key, { append }, () => now);
    const id = await vault.createFixture(ctx, 1);
    expect(await vault.readFixture({ ...ctx, workspaceId: 'foreign' }, id)).toBeUndefined();
    expect(await vault.readFixture(ctx, id)).toBe('SYNTHETIC RESEARCH FIXTURE ONLY');
    const stored = (vault as unknown as { entries: Map<string, { ciphertext: Buffer }> }).entries.get(id)!;
    expect(stored.ciphertext.toString('utf8')).not.toContain('SYNTHETIC RESEARCH FIXTURE ONLY');
    now = 2000;
    expect(await vault.readFixture(ctx, id)).toBeUndefined();
    append.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(vault.purgeExpired(ctx)).rejects.toThrow('audit unavailable');
    expect(await vault.purgeExpired(ctx)).toBe(1);
    expect(await vault.purgeExpired(ctx)).toBe(0);
    expect(await vault.readFixture(ctx, id)).toBeUndefined();
  });
  it('authenticates ciphertext keys and refuses reads when audit fails', async () => {
    let key = randomBytes(32); const append = vi.fn().mockResolvedValue(undefined);
    const vault = new SyntheticResearchVault('test', () => key, { append });
    const id = await vault.createFixture(ctx, 1);
    append.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(vault.readFixture(ctx, id)).rejects.toThrow('audit unavailable');
    key = randomBytes(32);
    await expect(vault.readFixture(ctx, id)).rejects.toThrow();
  });
  it('serializes concurrent purges without duplicate erasure audit', async () => {
    let now = 0; const append = vi.fn().mockResolvedValue(undefined), key = randomBytes(32);
    const vault = new SyntheticResearchVault('test', () => key, { append }, () => now);
    await vault.createFixture(ctx, 1); now = 1000;
    expect(await Promise.all([vault.purgeExpired(ctx), vault.purgeExpired(ctx)])).toEqual([1, 0]);
    expect(append.mock.calls.filter(call => call[0].action === 'PURGED')).toHaveLength(1);
  });
  it('denies real environments and unauthorized users before key or audit access', () => {
    const keys = vi.fn(), append = vi.fn();
    const vault = new SyntheticResearchVault('production', keys, { append });
    expect(() => vault.createFixture(ctx, 1)).toThrow('FORBIDDEN');
    const local = new SyntheticResearchVault('local', keys, { append });
    expect(() => local.readFixture({ ...ctx, role: 'manager' }, 'id')).toThrow('FORBIDDEN');
    expect(() => local.createFixture(ctx, 604801)).toThrow('INVALID_INPUT');
    expect(keys).not.toHaveBeenCalled(); expect(append).not.toHaveBeenCalled();
  });
});
