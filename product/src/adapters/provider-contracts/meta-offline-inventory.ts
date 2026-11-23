/** Fabricated contract inventory, separate from normalization and authenticated intake.
 * No text/media downloading, assertions, identity correlation or authority assignment.
 */
export interface MetaOfflineEvent {
  readonly pageId: string;
  readonly kind: 'text' | 'echo' | 'attachment' | 'unsupported';
  readonly value: unknown;
}
export function inventoryMetaOffline(input: unknown, authorizedPages: ReadonlySet<string>): readonly MetaOfflineEvent[] {
  const object = (x: unknown): Record<string, unknown> => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('INVALID_META_CONTRACT');
    return x as Record<string, unknown>;
  };
  const body = object(input);
  if (body.object !== 'page' || !Array.isArray(body.entry) || body.entry.length > 100) throw new Error('INVALID_META_CONTRACT');
  const result: MetaOfflineEvent[] = [];
  for (const rawEntry of body.entry) {
    const entry = object(rawEntry);
    if (typeof entry.id !== 'string' || !authorizedPages.has(entry.id) || !Array.isArray(entry.messaging)) throw new Error('META_PAGE_NOT_BOUND');
    for (const rawEvent of entry.messaging) {
      if (result.length >= 1000) throw new Error('META_CONTRACT_LIMIT');
      const event = object(rawEvent);
      const message = event.message === undefined ? {} : object(event.message);
      const kind = message.is_echo === true ? 'echo' : Array.isArray(message.attachments) ? 'attachment' :
        typeof message.text === 'string' && typeof message.mid === 'string' ? 'text' : 'unsupported';
      result.push({ pageId: entry.id, kind, value: structuredClone(rawEvent) });
    }
  }
  return result;
}
