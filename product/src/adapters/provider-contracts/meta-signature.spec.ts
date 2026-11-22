import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from './meta-signature';

describe('Meta documented SHA256 raw-byte signature offline', () => {
  it('accepts valid runtime-generated secret and rejects byte changes and reserialization', () => {
    const secret = randomBytes(32), body = Buffer.from('{ "fabricated": "\\u0061" }');
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
    expect(verifyMetaSignature(Buffer.from(JSON.stringify(JSON.parse(body.toString()))), signature, secret)).toBe(false);
    expect(verifyMetaSignature(body, signature, randomBytes(32))).toBe(false);
    expect(verifyMetaSignature(Buffer.concat([body, Buffer.from(' ')]), signature, secret)).toBe(false);
  });
  it('rejects missing, malformed, old algorithm, arrays, wrong length and oversized bodies before parsing', () => {
    const secret = randomBytes(32), body = Buffer.from('not JSON');
    for (const header of [undefined, null, ['sha256='], 'sha1=abc', 'sha256=aa', `sha256=${'z'.repeat(64)}`]) expect(verifyMetaSignature(body, header, secret)).toBe(false);
    expect(verifyMetaSignature(body, `sha256=${'a'.repeat(64)}`, secret, 1)).toBe(false);
    expect(verifyMetaSignature(body, '', secret, Infinity)).toBe(false);
    expect(verifyMetaSignature(body, '', Buffer.alloc(0))).toBe(false);
  });
});
