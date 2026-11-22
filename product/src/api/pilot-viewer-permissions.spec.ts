import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { AuthContext } from '../ports/auth';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { PilotLoopController } from './pilot-loop.controller';

const leadId = '00000000-0000-4000-8000-000000000001';
const operations = [
  ['intake', 'ingestScenario', { displayName: 'Synthetic', utterance: 'Call', speaker: 'customer', connection: 'manual', externalRecordId: 'fixture' }],
  ['handoff', 'handoffToSales', { context: 'Context', proposedAction: 'Call', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'recipient' }],
  ['accept', 'salesAccept', { workId: 'work', reason: 'Accept' }],
  ['advance', 'advance', { to: 'Contacting', reason: 'Call' }],
  ['complete', 'completeWork', { workId: 'work', evidence: 'observed', evidenceRef: 'source' }],
  ['reschedule', 'rescheduleWork', { workId: 'work', newDueAt: '2026-11-20T00:00:00Z', reason: 'Later' }],
  ['unobserved', 'markExternalUnobserved', { workId: 'work' }],
  ['outcome', 'recordOutcome', { value: 'Unknown', reason: 'Pending' }],
] as const;

function fixture(role: string, isDemo = false) {
  const methods = Object.fromEntries(operations.map(([, service]) => [service, vi.fn().mockRejectedValue(new HttpException('mutation reached', 418))]));
  const get = vi.fn().mockResolvedValue({ lead: { id: leadId, workspaceId: 'workspace' }, ownerUserId: 'actor', workItems: [], outcomes: [] });
  const access = vi.fn().mockReturnValue(true);
  const context = { workspaceId: 'workspace', userId: 'actor', role, isDemo } as AuthContext;
  const controller = new PilotLoopController({ resolve: () => context }, { canAccessLead: access }, { ...methods, get } as unknown as PilotLoopService);
  return { controller, methods, get, access };
}

// Invoke the heterogeneous public controller signatures with runtime HTTP payloads.
function invoke(controller: PilotLoopController, name: typeof operations[number][0], body: unknown, valid = true) {
  if (name === 'intake') return controller.intake({}, body as never);
  return controller[name]({}, valid ? leadId : 'invalid', body as never);
}

describe('ADR-006 pilot mutation capability boundary', () => {
  for (const [name, service, body] of operations) {
    describe(name, () => {
      it.each([
        ['viewer', false], ['viewer', true], ['unknown', false], ['admin', true], ['manager', true], ['sales', true],
      ])('denies %s (demo=%s) before validation, lookup or mutation', async (role, isDemo) => {
        for (const valid of [true, false]) {
          const { controller, methods, get, access } = fixture(role as string, isDemo as boolean);
          await expect(invoke(controller, name, valid ? body : {}, valid)).rejects.toMatchObject({ status: 403 });
          expect(get).not.toHaveBeenCalled();
          expect(access).not.toHaveBeenCalled();
          for (const method of Object.values(methods)) expect(method).not.toHaveBeenCalled();
        }
      });
      it.each(['admin', 'manager', 'sales'])('allows %s through the capability boundary', async (role) => {
        const { controller, methods } = fixture(role);
        await expect(invoke(controller, name, body)).rejects.toMatchObject({ status: 418 });
        expect(methods[service]).toHaveBeenCalledOnce();
      });
      if (name !== 'intake') {
        it.each(['admin', 'manager', 'sales'])('preserves lead access denial for %s', async (role) => {
          const { controller, methods, access } = fixture(role);
          access.mockReturnValue(false);
          await expect(invoke(controller, name, body)).rejects.toMatchObject({ status: 403 });
          expect(methods[service]).not.toHaveBeenCalled();
        });
      }
    });
  }
});
