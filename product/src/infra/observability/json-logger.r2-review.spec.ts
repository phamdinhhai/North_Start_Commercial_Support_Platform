import { describe, expect, it } from 'vitest';
import { JsonLogger, resolveLogLevels } from './json-logger';

/**
 * Independent QA (R2, Subagent I). DEFECT R2-I-05 (defence in depth): the stack-frame filter in
 * redaction.ts keeps any later line shaped like `    at <...>` — the character class admits `@`, `.`
 * and `-`, so a multi-line Error message can smuggle an email/JWT into `stack`. No current call
 * site is known to put attacker-controlled newlines in an Error message. Fixed: frames are parsed only after the located message; tests now assert the fix.
 */
function capture() {
  const lines: string[] = [];
  const logger = new JsonLogger((line) => lines.push(line), resolveLogLevels('verbose'), () => new Date('2026-11-18T00:00:00.000Z'));
  return { logger, lines };
}

describe('R2 independent QA — multi-line error messages never reach the log', () => {
  it('an Error whose message contains frame-shaped lines does not leak email or token', () => {
    const { logger, lines } = capture();
    logger.error(new Error('x\n    at alice@example.com\n    at eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig'));
    expect(lines.join('\n')).not.toMatch(/example\.com|eyJhbGci/);
  });

  it('the Nest ExceptionsHandler shape (message, stack, context) does not leak email', () => {
    const { logger, lines } = capture();
    const e = new Error('bad\n    at bob@example.com');
    logger.error(e.message, e.stack, 'ExceptionsHandler');
    expect(lines.join('\n')).not.toMatch(/example\.com/);
  });

  it('control: single-line messages with secrets are redacted', () => {
    const { logger, lines } = capture();
    logger.error(new Error('token eyJhbGciOiJIUzI1NiJ9 for carol@example.com'));
    expect(lines.join('\n')).not.toMatch(/example\.com|eyJhbGci/);
  });

  // Fix-round negative cases: frame-shaped message lines with phone, bearer, paths with PII.
  const SMUGGLED = [
    '    at 0912345678 (x.js:1:1)',
    '    at +84 912 345 678',
    '    at fn (C:/Users/dave@example.com/app.js:1:2)',
    '    at Bearer abcdefghijklmnopqrstuvwxyz0123456789 (y.js:2:3)',
    '    at handler (/srv/app/eyJhbGciOiJIUzI1NiJ9.js:3:4)',
    '    at handler (/srv/app.js:1:1) Authorization: Bearer secret-value',
  ];
  const LEAK = /0912345678|912 345 678|dave@|example\.com|abcdefghijklmnop|eyJhbGci|secret-value|Bearer/i;

  it.each(SMUGGLED)('Error message line %j never becomes a frame', (smuggled) => {
    const { logger, lines } = capture();
    logger.error(new Error(`boom\n${smuggled}`));
    const e = new Error(`boom\n${smuggled}`);
    logger.error(e.message, e.stack, 'ExceptionsHandler');
    expect(lines.join('\n')).not.toMatch(LEAK);
  });

  it('message with an empty first line and frame-shaped tail does not leak', () => {
    const { logger, lines } = capture();
    logger.error(new Error('\n    at erin@example.com (a.js:1:1)'));
    expect(lines.join('\n')).not.toMatch(/example\.com/);
  });

  it('a stack whose message cannot be located yields no frames (fail closed)', () => {
    const { logger, lines } = capture();
    logger.error('unrelated message', 'Error: other\n    at fn (/srv/app.js:1:1)', 'ExceptionsHandler');
    expect(JSON.parse(lines[0])).not.toHaveProperty('stack');
  });

  it('a stack frame that itself carries address/token/phone shapes is dropped', () => {
    const { logger, lines } = capture();
    const e = new Error('m');
    e.stack = 'Error: m\n    at ok (/srv/app.js:1:1)\n    at fn (/srv/frank@example.com/x.js:1:1)\n    at fn (/srv/0912345678/x.js:1:1)\n    at fn (/srv/eyJhbGciOiJIUzI1/x.js:1:1)';
    logger.error(e);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.stack).toEqual(['at ok (/srv/app.js:1:1)']);
  });

  it('still keeps genuine V8 frames (incl. npm scopes, node internals, async, Windows paths)', () => {
    const { logger, lines } = capture();
    const e = new Error('m');
    e.stack = [
      'Error: m',
      '    at Injector.instantiateClass (D:\\app\\node_modules\\@nestjs\\core\\injector\\injector.js:443:55)',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
      '    at async Promise.all (index 7)',
      '    at async D:\\app\\node_modules\\@nestjs\\core\\injector\\instance-loader.js:56:13',
      '    at InstanceWrapper.useFactory [as metatype] (file:///srv/app/dist/m.js:51:92)',
      '    at new Foo (/srv/app/foo.js:1:1)',
    ].join('\n');
    logger.error(e);
    expect(JSON.parse(lines[0]).stack).toHaveLength(6);
    const real = new Error('real');
    logger.error(real);
    expect((JSON.parse(lines[1]).stack as string[]).length).toBeGreaterThan(0);
  });
});
