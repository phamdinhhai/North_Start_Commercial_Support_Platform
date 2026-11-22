import type { ContentDigest, ContentDigester, DigestPurpose } from './content-digester';

export interface VersionedContentDigest {
  readonly algorithm_version: 'hmac-sha256-v1';
  readonly kid: string;
  readonly value: string;
}

export function versionedDigest(digester: ContentDigester, workspaceId: string, purpose: DigestPurpose, content: string): VersionedContentDigest {
  const { kid, value } = digester.digest(workspaceId, purpose, content);
  return { algorithm_version: 'hmac-sha256-v1', kid, value };
}

export function digestAsContent(value: VersionedContentDigest): ContentDigest {
  return { alg: 'HMAC-SHA256', kid: value.kid, value: value.value };
}

/** Text fields retain their schema while making algorithm and key explicit. Legacy hex stays readable. */
export function encodeDigest(digest: VersionedContentDigest): string {
  return `${digest.algorithm_version}:${digest.kid}:${digest.value}`;
}

export function decodeDigest(token: string): VersionedContentDigest | undefined {
  const match = /^hmac-sha256-v1:([A-Za-z0-9._-]{1,64}):([a-f0-9]{64})$/.exec(token);
  return match ? { algorithm_version: 'hmac-sha256-v1', kid: match[1], value: match[2] } : undefined;
}
