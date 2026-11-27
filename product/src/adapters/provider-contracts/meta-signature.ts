import { createHmac, timingSafeEqual } from 'node:crypto';

/** Meta documented X-Hub-Signature-256 over untouched bytes, before any JSON parse.
 * Offline cryptographic check only: no replay protection, rights, Lead access or principal issuance.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#validate-payloads
 */
export function verifyMetaSignature(rawBody: Uint8Array, signature: unknown, appSecret: Uint8Array, maxBytes = 1048576): boolean {
  if (!(rawBody instanceof Uint8Array) || !(appSecret instanceof Uint8Array) || appSecret.byteLength < 16 ||
      !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 1048576 || rawBody.byteLength > maxBytes ||
      typeof signature !== 'string' || !/^sha256=[a-fA-F0-9]{64}$/u.test(signature)) return false;
  const supplied = Buffer.from(signature.slice(7), 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
