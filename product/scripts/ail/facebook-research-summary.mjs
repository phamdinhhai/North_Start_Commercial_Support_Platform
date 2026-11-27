import { createHash } from 'node:crypto';

// Snapshot comparison ignores JSON property insertion order; this is not a raw-byte evidence hash.
export function conversationSnapshotFingerprint(conversations) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const sorted = [...conversations].sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  return createHash('sha256').update(JSON.stringify(canonical(sorted))).digest('hex');
}

// Reports temporal coincidence only: network activity during a step can belong to the app.
export function summarizeFacebookCapture(evidence, spec, facebookId) {
  const captured = evidence.normalized_result;
  const paths = new Map([
    ['/api/v1/pages', '/api/v1/pages'],
    [`/api/v1/pages/${facebookId}/settings`, '/api/v1/pages/:facebook-page/settings'],
    [`/api/v1/pages/${facebookId}/conversations`, '/api/v1/pages/:facebook-page/conversations'],
  ]);
  const steps = captured.steps.map((step) => ({ id: step.step_id, status: step.status }));
  const knownKeys = ['success', 'error_code', 'message', 'categorized', 'settings', 'files',
    'shop_id', 'warehouses', 'pinned_photos', 'recent_photos', 'conversations'];
  const responses = [];
  for (const response of captured.events.items) {
    if (response.kind !== 'response') continue;
    let address;
    try { address = new URL(response.url.url); } catch { continue; }
    const scopedPrefix = `/api/v1/pages/${facebookId}/conversations/`;
    let publicPath = paths.get(address.pathname);
    if (!publicPath && address.pathname.startsWith(scopedPrefix)) {
      const suffix = address.pathname.slice(scopedPrefix.length).split('/').slice(1).join('/');
      if (['', 'messages', 'toggle_tag', 'tags_update_histories'].includes(suffix)) publicPath = `/api/v1/pages/:facebook-page/conversations/:conversation${suffix ? '/' + suffix : ''}`;
    }
    if (!publicPath && /^\/pos-api\/api\/v1\/shops\/[0-9]+(?:\/crm\/automation)?$/.test(address.pathname)) {
      publicPath = address.pathname.includes('/crm/automation') ? '/pos-api/api/v1/shops/:shop/crm/automation' : '/pos-api/api/v1/shops/:shop';
    }
    if (address.origin !== 'https://pancake.vn' || !publicPath) continue;
    const content = captured.events.items.find((event) => event.kind === 'network-content' &&
      event.phase === 'response' && event.transaction_id === response.transaction_id);
    let body;
    if (content?.body?.state === 'captured') {
      try { body = JSON.parse(Buffer.from(content.body.content, 'base64').toString('utf8')); } catch {}
    }
    const action = spec.actions[response.step_index - 1];
    responses.push({ stepIndex: response.step_index, method: response.method, status: response.status,
      path: publicPath, bodyState: content?.body?.state ?? 'absent', queryKeys: [...address.searchParams.keys()],
      coincidesWithDeclaredEndpoint: action?.action === 'request' && action.path?.split('?')[0] === address.pathname && action.method === response.method,
      success: typeof body?.success === 'boolean' ? body.success : null,
      keys: knownKeys.filter((key) => body && Object.hasOwn(body, key)),
      conversationCount: Array.isArray(body?.conversations) ? body.conversations.length : null,
      tagCount: Array.isArray(body?.settings?.tags) ? body.settings.tags.length : null,
      messageCount: Array.isArray(body?.messages) ? body.messages.length : null,
      dataArrayCount: Array.isArray(body?.data) ? body.data.length : null,
      hasNextCursor: typeof body?.next_cursor === 'string' && body.next_cursor.length > 0,
      hasConcurrencyKey: !!body?.settings?.current_settings_key });
  }
  return { runId: spec.runId, evidenceId: evidence.evidence_id,
    result: steps.every((step) => step.status === 'completed') ? 'completed' : 'failed', steps,
    observedResponses: responses, droppedEvents: captured.events.dropped,
    completeness: captured.completeness.status,
    attribution: 'Temporal endpoint match is not proof of request origin or action causality.' };
}
