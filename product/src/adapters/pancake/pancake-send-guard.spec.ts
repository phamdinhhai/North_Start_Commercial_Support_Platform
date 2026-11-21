import {describe, expect, it} from 'vitest';
import {PancakeSendGuard} from './pancake-send-guard';

describe('Pancake single-send guard', () => {
  it('reserves one exact target and prevents a second send', () => {
    const guard = new PancakeSendGuard();
    expect(guard.reserve('run-001', 'server-target-001')).toMatchObject({state: 'reserved'});
    expect(() => guard.reserve('run-002', 'server-target-001')).toThrow('PANCAKE_SEND_GUARD_DENIED');
  });
  it.each(['accepted', 'rejected', 'ambiguous'] as const)('makes %s terminal', result => {
    const guard = new PancakeSendGuard(); guard.reserve('run-001', 'server-target-001');
    expect(guard.observe('run-001', result, 'server-target-001').state).toBe(result);
    expect(() => guard.observe('run-001', result, 'server-target-001')).toThrow('PANCAKE_SEND_GUARD_DENIED');
  });
  it('requires the same server-owned target at observation', () => {
    const guard = new PancakeSendGuard(); guard.reserve('run-001', 'server-target-001');
    expect(() => guard.observe('run-001', 'accepted', 'other-target')).toThrow('PANCAKE_SEND_GUARD_DENIED');
  });
  it('does not allow malformed references', () => {
    expect(() => new PancakeSendGuard().reserve('', 'target')).toThrow();
    expect(() => new PancakeSendGuard().reserve('run', 'target\n')).toThrow();
  });
});
