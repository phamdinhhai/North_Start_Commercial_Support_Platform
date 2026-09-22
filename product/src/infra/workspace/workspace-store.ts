/**
 * Workspace-scoped in-memory store (C-12, R-01 — workspace isolation).
 *
 * Mỗi store entry gắn với workspaceId — query scoped, cross-workspace reject.
 * NOTE: workspace isolation (R-01) ≠ I-09 (lead-scoped access). I-09 enforced separately
 * in domain layer where Sales access is scoped to assigned lead, not entire workspace inbox.
 * // OPEN: PM-1 — I-09 lead-scoped chưa chốt chi tiết
 *
 * In-memory PH1, được replace bởi durable persistence trong PH3+.
 */

export interface WorkspaceScopedEntry {
  readonly workspaceId: string;
  readonly id: string;
  readonly createdAt: string;
}

export type EntryPredicate<T extends WorkspaceScopedEntry> = (entry: T) => boolean;

/**
 * Generic workspace-scoped store — mọi query filter theo workspaceId (I-09).
 * Không có cross-workspace query method — enforced ở store boundary.
 */
export class WorkspaceStore<T extends WorkspaceScopedEntry> {
  private readonly entries = new Map<string, T>(); // key = id

  /** Insert entry — enforce workspaceId present. */
  add(entry: T): T {
    if (!entry.workspaceId) {
      throw new Error('workspaceId is required');
    }
    if (this.entries.has(entry.id)) {
      throw new Error(`Entry ${entry.id} already exists`);
    }
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Get entry by ID — still requires workspaceId to enforce scope. */
  getById(id: string, workspaceId: string): T | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (entry.workspaceId !== workspaceId) return undefined; // I-09: cross-workspace reject
    return entry;
  }

  /** Query all entries within a workspace — scoped (I-09). */
  listByWorkspace(workspaceId: string): readonly T[] {
    return [...this.entries.values()].filter((e) => e.workspaceId === workspaceId);
  }

  /** Query entries matching workspace + custom predicate. */
  query(workspaceId: string, predicate: EntryPredicate<T>): readonly T[] {
    return this.listByWorkspace(workspaceId).filter(predicate);
  }

  /** Count entries per workspace. */
  countByWorkspace(workspaceId: string): number {
    return this.listByWorkspace(workspaceId).length;
  }

  /** Total entries (for tests/debug). */
  total(): number {
    return this.entries.size;
  }

  /** Clear all entries — test teardown only. */
  clear(): void {
    this.entries.clear();
  }
}
