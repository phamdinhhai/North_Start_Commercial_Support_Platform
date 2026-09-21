import { describe, it, expect } from 'vitest';
import { WorkspaceStore, type WorkspaceScopedEntry } from './workspace-store';

interface TestEntry extends WorkspaceScopedEntry {
  name: string;
}

function makeEntry(id: string, workspaceId: string, name: string): TestEntry {
  return { id, workspaceId, createdAt: new Date().toISOString(), name };
}

describe('WorkspaceStore (C-12, I-09)', () => {
  const ws1 = 'ws-001';
  const ws2 = 'ws-002';

  describe('I-09: workspace-scoped access', () => {
    it('add + getById within same workspace', () => {
      const store = new WorkspaceStore<TestEntry>();
      const entry = makeEntry('e1', ws1, 'Alpha');
      store.add(entry);
      expect(store.getById('e1', ws1)?.name).toBe('Alpha');
    });

    it('getById returns undefined for cross-workspace access (I-09)', () => {
      const store = new WorkspaceStore<TestEntry>();
      store.add(makeEntry('e1', ws1, 'Alpha'));
      expect(store.getById('e1', ws2)).toBeUndefined();
    });

    it('getById returns undefined for non-existent ID', () => {
      const store = new WorkspaceStore<TestEntry>();
      expect(store.getById('missing', ws1)).toBeUndefined();
    });
  });

  describe('listByWorkspace', () => {
    it('lists only entries belonging to workspace', () => {
      const store = new WorkspaceStore<TestEntry>();
      store.add(makeEntry('e1', ws1, 'A'));
      store.add(makeEntry('e2', ws1, 'B'));
      store.add(makeEntry('e3', ws2, 'C'));
      expect(store.listByWorkspace(ws1)).toHaveLength(2);
      expect(store.listByWorkspace(ws2)).toHaveLength(1);
    });

    it('returns empty array for unknown workspace', () => {
      const store = new WorkspaceStore<TestEntry>();
      expect(store.listByWorkspace('ws-unknown')).toEqual([]);
    });
  });

  describe('query', () => {
    it('filters by workspace + predicate', () => {
      const store = new WorkspaceStore<TestEntry>();
      store.add(makeEntry('e1', ws1, 'Alpha'));
      store.add(makeEntry('e2', ws1, 'Beta'));
      store.add(makeEntry('e3', ws2, 'Alpha'));
      const result = store.query(ws1, (e) => e.name === 'Alpha');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e1');
    });
  });

  describe('edge cases', () => {
    it('throws on add without workspaceId', () => {
      const store = new WorkspaceStore<TestEntry>();
      expect(() => store.add({ id: 'x', workspaceId: '', createdAt: '', name: '' })).toThrow('workspaceId is required');
    });

    it('throws on duplicate ID', () => {
      const store = new WorkspaceStore<TestEntry>();
      store.add(makeEntry('e1', ws1, 'A'));
      expect(() => store.add(makeEntry('e1', ws1, 'B'))).toThrow('already exists');
    });

    it('countByWorkspace + total', () => {
      const store = new WorkspaceStore<TestEntry>();
      store.add(makeEntry('e1', ws1, 'A'));
      store.add(makeEntry('e2', ws2, 'B'));
      expect(store.countByWorkspace(ws1)).toBe(1);
      expect(store.total()).toBe(2);
    });

    it('clear empties everything', () => {
      const store = new WorkspaceStore<TestEntry>();
      store.add(makeEntry('e1', ws1, 'A'));
      store.clear();
      expect(store.total()).toBe(0);
    });
  });
});
