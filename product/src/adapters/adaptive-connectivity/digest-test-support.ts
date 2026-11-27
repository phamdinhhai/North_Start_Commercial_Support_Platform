// Test-only: a keyring that mints a fresh random 32-byte key per workspace at runtime. No key literal exists anywhere.
import { randomBytes } from 'node:crypto';
import { createHmacContentDigester, InMemoryWorkspaceKeyring, type ContentDigester, type WorkspaceDigestKey } from './content-digester';

export class RuntimeTestKeyring extends InMemoryWorkspaceKeyring {
  override activeKey(workspaceId: string): WorkspaceDigestKey {
    if (!this.key(workspaceId, `${workspaceId.slice(0, 40)}.k1`)) this.rotate(workspaceId, `${workspaceId.slice(0, 40)}.k1`, randomBytes(32));
    return super.activeKey(workspaceId);
  }
}

export function testDigester(keyring: InMemoryWorkspaceKeyring = new RuntimeTestKeyring()): ContentDigester {
  return createHmacContentDigester(keyring);
}
