/**
 * Lets an API handler attach server-resolved, non-secret request attributes to the
 * structured request log. Only values resolved by the server (never raw caller input)
 * may be annotated; the implementation re-validates them against an allowlist pattern.
 */
export interface RequestAnnotator {
  annotateWorkspace(workspaceId: string): void;
}

export const REQUEST_ANNOTATOR = Symbol('REQUEST_ANNOTATOR');
