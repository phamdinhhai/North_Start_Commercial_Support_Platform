import { describe, it, expect } from 'vitest';
import { Script } from 'node:vm';
import { OPERATOR_CLIENT_HTML } from './operator-client';
import { OPERATOR_SCRIPT } from './operator-script';

describe('operator asset packaging', () => {
  it('packages syntactically valid browser code without runtime imports', () => {
    expect(() => new Script(OPERATOR_SCRIPT)).not.toThrow();
    expect(OPERATOR_CLIENT_HTML).toContain('<script>' + OPERATOR_SCRIPT + '</script>');
  });
});
