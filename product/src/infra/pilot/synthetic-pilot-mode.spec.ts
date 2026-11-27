import { describe, expect, it, vi } from 'vitest';
import { syntheticPilotOnly } from './synthetic-pilot-mode';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
import { InMemoryPilotStore } from './in-memory-pilot.store';
import { AuditStore } from '../audit/audit-store';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';

describe('local synthetic pilot admission', () => {
  it('defaults off and refuses malformed, nonlocal or unauthenticated fixture configuration', () => {
    expect(syntheticPilotOnly({})).toBe(false);
    for (const env of [
      { SYNTHETIC_PILOT_ONLY: 'yes' },
      { SYNTHETIC_PILOT_ONLY: 'true', DEPLOYMENT_MODE: 'production', AUTH_MODE: 'oidc' },
      { SYNTHETIC_PILOT_ONLY: 'true', DEPLOYMENT_MODE: 'test', NODE_ENV: 'production', AUTH_MODE: 'oidc' },
      { SYNTHETIC_PILOT_ONLY: 'true', DEPLOYMENT_MODE: 'pilot', AUTH_MODE: 'oidc' },
      { SYNTHETIC_PILOT_ONLY: 'true', DEPLOYMENT_MODE: 'test', AUTH_MODE: 'legacy' },
    ]) expect(() => syntheticPilotOnly(env)).toThrow();
    expect(syntheticPilotOnly({ SYNTHETIC_PILOT_ONLY: 'true', DEPLOYMENT_MODE: 'local', AUTH_MODE: 'oidc' })).toBe(true);
  });
  it('rejects false before any immutable payload or lead can be persisted, including retries', async () => {
    const store = new InMemoryPilotStore(new AuditStore()), adapter = new ManualAdapter();
    const save = vi.spyOn(store, 'save'), ingest = vi.spyOn(adapter, 'ingest');
    const loop = new PilotLoopService(store, adapter, true);
    const input = { workspaceId: 'synthetic-test', displayName: 'Invented lead', utterance: 'Invented text',
      speaker: 'customer' as const, connection: 'manual', externalRecordId: 'fixed', isSynthetic: false };
    await expect(loop.ingestScenario(input)).rejects.toMatchObject({ code: 'INPUT_INVALID', status: 400 });
    expect(save).not.toHaveBeenCalled(); expect(ingest).not.toHaveBeenCalled();
    const created = await loop.ingestScenario({ ...input, isSynthetic: true });
    expect(created.envelope?.isSynthetic).toBe(true);
    expect(await loop.ingestScenario({ ...input, isSynthetic: true })).toEqual(created);
    const count = save.mock.calls.length;
    await expect(loop.ingestScenario(input)).rejects.toMatchObject({ status: 400 });
    expect(save.mock.calls.length).toBe(count);
  });
});
