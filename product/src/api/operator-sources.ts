/** Synthetic-only source observations. All values are rendered as text, never HTML. */
export const OPERATOR_SOURCES_SCRIPT = String.raw`
window.mountSyntheticSources = ({container, request, openLead, createConnection, importFixture}) => {
  let active = true, generation = 0;
  const node = (tag, text) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n;};
  const title = node('h2', 'Synthetic source lab'), note = node('p', 'Invented fixtures only. No provider connection or live synchronization. Same native object can share a lead; matching text cannot. New imports are unassigned unless you explicitly claim responsibility.'),
    create = node('button', 'Create synthetic connection'), refresh = node('button', 'Refresh source connections'), status = node('p'), list = node('div');
  create.type = refresh.type = 'button'; status.setAttribute('role', 'status');
  container.replaceChildren(title, note, create, refresh, status, list);
  create.onclick = () => createConnection();
  async function load() {
    const ticket = ++generation; refresh.disabled = true; list.replaceChildren(); status.textContent = 'Loading source connections...';
    try {
      const result = await request('/v1/source-integrations/connections');
      if (!active || ticket !== generation) return;
      status.textContent = 'Bounded list: up to 100 connections. Completeness UNKNOWN. SYNTHETIC_ONLY is not CONNECTED.';
      for (const c of result.items) {
        const card = node('article'); card.dataset.connectionId = c.id;
        card.append(node('p', c.provider + ' | Transport page: ' + c.pageId + ' | ' + c.status + ' | ' + c.health));
        card.append(node('p', 'Provider authorization: NOT VERIFIED. Capability: fabricated message import only. Local receipts: ' +
          (c.delivery?.receiptCount ?? 'UNKNOWN') + '; quarantined: ' + (c.delivery?.quarantineCount ?? 'UNKNOWN') +
          '; last local receipt: ' + (c.delivery?.lastReceiptAt || 'UNKNOWN - none recorded') +
          '. Sync attempt/checkpoint/lag/gaps: UNKNOWN - no network synchronization runs.'));
        if (c.status === 'active') {
          const ingest = node('button', 'Import fabricated ' + c.provider + ' observation'), revoke = node('button', 'Revoke synthetic connection');
          ingest.type = revoke.type = 'button'; ingest.onclick = () => importFixture(c); revoke.onclick = async () => {
            if (!confirm('Revoke this synthetic connection? New intake will be refused; accepted history remains.')) return;
            try { await request('/v1/source-integrations/connections/' + c.id + '/revoke', {method:'POST', body:'{}'}); await load(); }
            catch { if (active) status.textContent = 'Unable to revoke. Refresh and check your current access.'; }
          };
          card.append(ingest, revoke);
        }
        list.append(card);
      }
      if (!result.items.length) list.append(node('p', 'No synthetic source connections in this workspace.'));
    } catch { if (active && ticket === generation) status.textContent = 'Source access unavailable. Sign in with current admin access and refresh.'; }
    finally { if (active && ticket === generation) refresh.disabled = false; }
  }
  refresh.onclick = load; load();
  return () => {active = false; generation++; container.replaceChildren();};
};
window.renderSourceEvidence = (container, data) => {
  container.replaceChildren();
  const heading = document.createElement('h3'); heading.textContent = 'Source observations: synthetic, UNVERIFIED; completeness UNKNOWN'; container.append(heading);
  for (const item of data.items) {
    const block = document.createElement('pre');
    const o = item.observation, e = item.envelope;
    block.textContent = 'Provider: ' + o.provider + '\nRoute: ' + o.route + '\nTransport account: ' + o.accountId +
      '\nNative source: ' + (o.native.system || 'UNKNOWN') + '\nNative page: ' + (o.native.pageId || 'UNKNOWN') +
      '\nNative message: ' + (o.native.messageId || 'UNKNOWN') + '\nConversation: ' + (o.native.conversationId || 'UNKNOWN') +
      '\nNative event: ' + (o.native.eventId || 'UNKNOWN - not supplied') + '\nObserved: ' + o.observedAt +
      '\nOccurred: ' + (o.occurredAt || 'UNKNOWN') + '\nReceived: ' + e.ingestedAt +
      '\nFreshness: capture timestamps only; no sync SLA verified' + '\nCompleteness: UNKNOWN - no full history established' +
      '\nAuthority: synthetic_fixture / UNVERIFIED' + '\nLifecycle label: ' + o.lifecycle + ' (history observation; not current provider truth)' +
      '\nReconciliation: ' + item.receipt.disposition + '\nEvidence: ' + e.envelopeId + '\nOriginal captured text: ' + e.rawPayload.utterance;
    container.append(block);
  }
  if (!data.items.length) {const p = document.createElement('p'); p.textContent = 'No admitted source observation for this lead. Source linkage UNKNOWN.'; container.append(p);}
  if (data.possiblyTruncated) {const p = document.createElement('p'); p.textContent = 'Only the first 100 observations are shown; history may be truncated.'; container.append(p);}
};
`;
