import { describe, expect, it } from 'vitest';
import { JsonLogger, resolveLogLevels } from './json-logger';

/**
 * Independent QA (R2, Subagent I). DEFECT R2-I-05 (defence in depth): the stack-frame filter in
 * redaction.ts keeps any later line shaped like `    at <...>` — the character class admits `@`, `.`
 * and `-`, so a multi-line Error message can smuggle an email/JWT into `stack`. No current call
 * site is known to put attacker-controlled newlines in an Error message. `it.fails` = expected behaviour.
 */
function capture() {
  const lines: string[] = [];
  const logger = new JsonLogger((line) => lines.push(line), resolveLogLevels('verbose'), () => new Date('2026-11-18T00:00:00.000Z'));
  return { logger, lines };
}

describe('R2 independent QA — multi-line error messages never reach the log', () => {
  it.fails('an Error whose message contains frame-shaped lines does not leak email or token', () => {
    const { logger, lines } = capture();
    logger.error(new Error('x\n    at alice@example.com\n    at eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig'));
    expect(lines.join('\n')).not.toMatch(/example\.com|eyJhbGci/);
  });

  it.fails('the Nest ExceptionsHandler shape (message, stack, context) does not leak email', () => {
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
});
