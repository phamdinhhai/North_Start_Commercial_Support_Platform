import { describe, expect, it } from 'vitest';
import { JsonLogger, resolveLogLevels } from './json-logger';
import { REDACTED_TEXT, pickAllowed, stackFrames } from './redaction';
import { createRequestContext, runWithRequestContext, AlsRequestAnnotator } from './request-context';

const SECRETS = {
  authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret-token-value',
  cookie: 'session=very-secret-cookie',
  token: 'tok_live_SECRET123',
  body: '{"message":"xin chao, toi muon mua"}',
  email: 'nguyen.van.a@example.com',
  phone: '+84 912 345 678',
};
const FORBIDDEN = [/Bearer/i, /secret/i, /cookie/i, /tok_live/, /nguyen\.van\.a/, /example\.com/, /912 345 678/, /xin chao/, /authorization/i];

function capture(levels = resolveLogLevels('verbose')) {
  const lines: string[] = [];
  const logger = new JsonLogger((line) => lines.push(line), levels, () => new Date('2026-11-18T00:00:00.000Z'));
  return { logger, lines, parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

function assertClean(lines: string[]): void {
  for (const line of lines) for (const pattern of FORBIDDEN) expect(line).not.toMatch(pattern);
}

describe('JsonLogger allowlist redaction', () => {
  it('drops every non-allowlisted key from structured objects, including credentials and PII', () => {
    const { logger, lines, parsed } = capture();
    logger.log({ event: 'test.event', status: 200, route: '/v1/pilot/leads/:id', ...SECRETS, headers: { ...SECRETS }, query: SECRETS }, 'PilotLoopController');
    logger.event('log', { event: 'http.request', status: 201, ...SECRETS });
    assertClean(lines);
    expect(parsed()[0]).toEqual({ level: 'log', ts: '2026-11-18T00:00:00.000Z', context: 'PilotLoopController', event: 'test.event', status: 200, route: '/v1/pilot/leads/:id' });
    expect(Object.keys(parsed()[1]).sort()).toEqual(['event', 'level', 'status', 'ts']);
  });

  it('redacts free text from untrusted contexts and records only its size', () => {
    const { logger, lines, parsed } = capture();
    const text = `lead ${SECRETS.email} phone ${SECRETS.phone} auth ${SECRETS.authorization}`;
    logger.log(text, 'PilotLoopService');
    logger.warn(text);
    logger.error(text, `Error: ${text}\n    at handler (/app/dist/x.js:1:2)`, 'ExceptionsHandler');
    assertClean(lines);
    const [a, b, c] = parsed();
    expect(a).toMatchObject({ msg: REDACTED_TEXT, msgBytes: Buffer.byteLength(text) });
    expect(b).toMatchObject({ level: 'warn', msg: REDACTED_TEXT });
    expect(c).toMatchObject({ level: 'error', context: 'ExceptionsHandler', msg: REDACTED_TEXT, stack: ['at handler (/app/dist/x.js:1:2)'] });
  });

  it('keeps reviewed framework messages but strips control characters (no log injection)', () => {
    const { logger, parsed } = capture();
    logger.log('Mapped {/v1/integration/health, GET} route', 'RouterExplorer');
    logger.log(`line one${String.fromCharCode(10)}{"level":"fatal"}`, 'NestApplication');
    expect(parsed()[0].msg).toBe('Mapped {/v1/integration/health, GET} route');
    expect(parsed()[1].msg).toBe('line one {"level":"fatal"}');
    expect(parsed()).toHaveLength(2);
  });

  it('logs only the class name of Error objects, never their message', () => {
    const { logger, lines, parsed } = capture();
    const error = new TypeError(`cannot parse ${SECRETS.email}`);
    logger.error(error);
    assertClean(lines);
    expect(parsed()[0]).toMatchObject({ level: 'error', msg: REDACTED_TEXT, errorName: 'TypeError' });
    expect((parsed()[0].stack as string[]).every((frame) => frame.startsWith('at '))).toBe(true);
  });

  it('validates allowlisted values: invalid ids, raw URLs with queries and unknown methods are rejected', () => {
    expect(pickAllowed({ requestId: 'not-a-uuid', route: '/v1/leads?email=a@b.c', status: 99, workspaceId: '0912345678', method: 'TRACE' }))
      .toEqual({ method: 'OTHER' });
    expect(pickAllowed({ durationMs: 1.23456, requests: { 'GET /v1/x 200': 2, 'a@b.c': 1, 'GET /v1/y 200': -1 } }))
      .toEqual({ durationMs: 1.235, requests: { 'GET /v1/x 200': 2 } });
    expect(pickAllowed(null)).toEqual({});
    expect(stackFrames(undefined, 'x')).toBeUndefined();
  });

  it('adds requestId and the annotated server-resolved workspaceId inside a request context', () => {
    const { logger, parsed } = capture();
    const ctx = createRequestContext(undefined);
    runWithRequestContext(ctx, () => {
      new AlsRequestAnnotator().annotateWorkspace('ws-alpha');
      logger.log({ event: 'inside' });
    });
    logger.log({ event: 'outside' });
    expect(parsed()[0]).toMatchObject({ requestId: ctx.requestId, workspaceId: 'ws-alpha', event: 'inside' });
    expect(parsed()[1]).not.toHaveProperty('requestId');
    expect(parsed()[1]).not.toHaveProperty('workspaceId');
  });

  it('never annotates a free-form workspace identifier', () => {
    const ctx = createRequestContext(undefined);
    runWithRequestContext(ctx, () => new AlsRequestAnnotator().annotateWorkspace(SECRETS.email));
    expect(ctx.workspaceId).toBeUndefined();
    new AlsRequestAnnotator().annotateWorkspace('ws-outside'); // no context: no-op
  });

  it('honours LOG_LEVEL thresholds and silent mode', () => {
    expect([...resolveLogLevels(undefined)]).toEqual(['fatal', 'error', 'warn', 'log']);
    expect([...resolveLogLevels('warn')]).toEqual(['fatal', 'error', 'warn']);
    expect([...resolveLogLevels('bogus')]).toEqual(['fatal', 'error', 'warn', 'log']);
    const { logger, lines } = capture(resolveLogLevels('silent'));
    logger.fatal('x'); logger.event('error', { event: 'x' });
    expect(lines).toHaveLength(0);
    logger.setLogLevels(['debug']);
    logger.debug({ event: 'dbg' }); logger.verbose({ event: 'v' });
    expect(lines).toHaveLength(1);
  });

  it('never throws when the sink fails', () => {
    const logger = new JsonLogger(() => { throw new Error('disk full'); });
    expect(() => logger.log({ event: 'x' })).not.toThrow();
  });
});
