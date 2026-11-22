import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { AuthContext } from '../../ports/auth';
import { DataLifecycleError } from '../../ports/data-lifecycle';

interface Entry { workspace: string; expiresAt: number; nonce: Buffer; tag: Buffer; ciphertext: Buffer }
export interface SyntheticVaultAudit {
  append(event: { action: 'CREATED' | 'READ' | 'PURGED'; workspaceId: string; actorId: string; id: string }): Promise<void>;
}
/** TEST FIXTURE ONLY. No supplied payload/capture input, durable storage or production factory.
 * Demonstrates actual ciphertext deletion separately from immutable accepted evidence (ADR-009).
 */
export class SyntheticResearchVault {
  private readonly entries = new Map<string, Entry>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly mode: string, private readonly keyForWorkspace: (workspace: string) => Buffer,
    private readonly audit: SyntheticVaultAudit, private readonly now: () => number = Date.now) {}
  private authorize(ctx: AuthContext) {
    if (!['local', 'test'].includes(this.mode) || ctx.role !== 'admin' || ctx.isDemo) throw new DataLifecycleError('FORBIDDEN', 403);
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
  createFixture(ctx: AuthContext, ttlSeconds: number): Promise<string> {
    this.authorize(ctx);
    // ADR-009 maximum; this is a technical fixture bound, not an invented business schedule.
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 604800) throw new DataLifecycleError('INVALID_INPUT', 400);
    return this.serial(async () => {
      const id = randomUUID(), expiresAt = this.now() + ttlSeconds * 1000, nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.keyForWorkspace(ctx.workspaceId), nonce);
      cipher.setAAD(Buffer.from(`${ctx.workspaceId}:${id}:${expiresAt}`));
      const ciphertext = Buffer.concat([cipher.update('SYNTHETIC RESEARCH FIXTURE ONLY', 'utf8'), cipher.final()]);
      await this.audit.append({ action: 'CREATED', workspaceId: ctx.workspaceId, actorId: ctx.userId, id });
      this.entries.set(id, { workspace: ctx.workspaceId, expiresAt, nonce, tag: cipher.getAuthTag(), ciphertext });
      return id;
    });
  }
  readFixture(ctx: AuthContext, id: string): Promise<string | undefined> {
    this.authorize(ctx);
    return this.serial(async () => {
      const entry = this.entries.get(id);
      if (!entry || entry.workspace !== ctx.workspaceId || entry.expiresAt <= this.now()) return undefined;
      const cipher = createDecipheriv('aes-256-gcm', this.keyForWorkspace(ctx.workspaceId), entry.nonce);
      cipher.setAAD(Buffer.from(`${ctx.workspaceId}:${id}:${entry.expiresAt}`)); cipher.setAuthTag(entry.tag);
      const plaintext = Buffer.concat([cipher.update(entry.ciphertext), cipher.final()]);
      try {
        await this.audit.append({ action: 'READ', workspaceId: ctx.workspaceId, actorId: ctx.userId, id });
        return plaintext.toString('utf8');
      } finally { plaintext.fill(0); }
    });
  }
  purgeExpired(ctx: AuthContext): Promise<number> {
    this.authorize(ctx);
    return this.serial(async () => {
      let count = 0;
      for (const [id, entry] of this.entries) {
        if (entry.workspace !== ctx.workspaceId || entry.expiresAt > this.now()) continue;
        await this.audit.append({ action: 'PURGED', workspaceId: ctx.workspaceId, actorId: ctx.userId, id });
        entry.ciphertext.fill(0); this.entries.delete(id); count++;
      }
      return count;
    });
  }
}
