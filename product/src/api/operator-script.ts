export const OPERATOR_SCRIPT = String.raw`
(() => {
    'use strict';
    const $ = id => document.getElementById(id), v = id => $(id)?.value.trim() || '', esc = x => String(x ?? 'UNKNOWN').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let session = {}, selected = null, epoch = 0, listEpoch = 0, cursor = null, busy = false, command = null, recovery = null, dirty = false;
    const msg = (id, text, error = false) => { $(id).textContent = text; $(id).className = 'notice' + (error ? ' error' : ''); };
    const clear = () => { epoch++; listEpoch++; selected = null; cursor = null; $('context').replaceChildren(); $('queue').replaceChildren(); $('next').hidden = true; if ($('command-dialog').open)
        $('command-dialog').close(); $('command-fields').replaceChildren(); command = null; dirty = false; };
    const err = e => e.status === 401 ? 'Session expired. Sign in again.' : e.status === 403 ? 'Permission denied for this lead or action.' : e.status === 409 ? 'Conflict (' + (e.body?.code || '409') + '). Reload before retrying.' : (e.body?.code ? e.body.code + ': ' : '') + e.message;
    async function request(url, options = {}) { const headers = { 'content-type': 'application/json' }; if (session.devTokensAllowed && !session.authenticated && v('token'))
        headers.authorization = v('token').startsWith('Bearer ') ? v('token') : 'Bearer ' + v('token'); if (session.authenticated)
        headers['X-CSRF-Token'] = session.csrfToken; const r = await fetch(url, { credentials: 'same-origin', ...options, headers }); let b = {}; try {
        b = await r.json();
    }
    catch { } if (!r.ok) {
        const e = new Error(b.message || 'Request failed (' + r.status + ')');
        e.status = r.status;
        e.body = b;
        if (r.status === 401) {
            if (command?.id && session.authenticated && dirty) recovery = { command, fields: Array.from($('command-fields').children), context: session.context };
            clear();
            session.authenticated = false;
            $('recheck-session').hidden = !recovery;
            $('signin').target = '_blank';
            $('signin').rel = 'noopener';
            msg('dialog-status', '');
            $("identity").textContent = "";
            $("token").value = "";
            $('signin').hidden = !session.loginAvailable;
            msg('session-status', err(e) + (recovery ? ' Draft held only in this tab. Sign in in a new tab, then recheck session here.' : ' Re-enter unsaved changes after sign-in.'), true);
        }
        if (r.status === 403) { recovery = null; clear(); $('recheck-session').hidden = true; msg('context-status', 'Access denied. Lead context and unsaved draft cleared.', true); }
        throw e;
    } return b; }
    async function init() { try {
        session = await request('/v1/auth/session');
        if (session.syntheticOnly) { $('classification').value = 'synthetic'; msg('practice-status', 'Synthetic practice: invented data only'); }
        $('development').hidden = !session.devTokensAllowed;
        $('signin').hidden = session.authenticated || !session.loginAvailable;
        $('logout').hidden = !session.authenticated;
        $('identity').textContent = session.authenticated ? [session.context.userId, session.context.role, session.context.workspaceId].join('  -  ') : '';
        msg('session-status', session.authenticated ? 'Signed in.' : session.loginAvailable ? 'Sign in to open your workspace.' : session.devTokensAllowed ? 'Development access enabled.' : 'Browser sign-in unavailable.');
        if (session.authenticated)
            await load();
    }
    catch (e) {
        msg('session-status', err(e), true);
    } }
    async function telemetry(eventType, id) { if (!eventType || !id)
        return; try {
        await post('learning', { leadId: id, eventType, releaseVersion: '0.1.0' });
    }
    catch { } }
    const post = (path, body) => request('/v1/pilot/' + path, { method: 'POST', body: JSON.stringify(body) });
    async function load() { if (busy)
        return; const generation = ++listEpoch; msg('queue-status', 'Loading - '); try {
        const q = new URLSearchParams({ limit: v('limit'), classification: v('classification') }), mode = v('view');
        if (cursor)
            q.set(mode === 'leads' ? 'after' : 'cursor', cursor);
        const page = await request('/v1/pilot/' + mode + '?' + q);
        if (generation !== listEpoch)
            return;
        $('queue').replaceChildren();
        cursor = page.nextCursor || null;
        $('next').hidden = !cursor;
        for (const i of page.items) {
            const b = document.createElement('button');
            b.className = 'queue-item';
            b.dataset.workId = i.id || '';
            b.textContent = (i.isSynthetic === true ? '[SYNTHETIC] ' : i.isSynthetic === false ? '[REAL] ' : '[CLASSIFICATION UNKNOWN] ') + (i.displayName || i.lead?.displayName || 'UNKNOWN') + '  -  ' + i.status + (i.action ? '  -  ' + i.action : '');
            b.onclick = () => openLead(i.leadId || i.id);
            $('queue').append(b);
        }
        msg('queue-status', page.items.length + ' accessible ' + mode + ' loaded.');
    }
    catch (e) {
        if (generation === listEpoch)
            msg('queue-status', err(e), true);
    } }
    async function openLead(id) { if (busy)
        return; const generation = ++epoch; selected = null; $('context').replaceChildren(); msg('context-status', 'Loading lead - '); try {
        const d = await request('/v1/pilot/leads/' + encodeURIComponent(id));
        if (generation !== epoch)
            return;
        selected = { id, d, version: d.version };
        render();
        telemetry('lead_opened', id);
        await contactHistory(id, generation);
    }
    catch (e) {
        if (generation === epoch)
            msg('context-status', err(e), true);
    } }
    function field(id, label, type = 'text', required = true, initial = '') { const l = document.createElement('label'); l.htmlFor = id; l.textContent = label; const n = document.createElement(type === 'textarea' ? 'textarea' : 'input'); n.id = id; if (type !== 'textarea')
        n.type = type; n.required = required; if (type === 'checkbox')
        n.checked = Boolean(initial);
    else
        n.value = initial; n.maxLength = type === 'textarea' ? 16000 : 2000; $('command-fields').append(l, n); return n; }
    function choices(id, label, items) { const l = document.createElement('label'); l.htmlFor = id; l.textContent = label; const n = document.createElement('select'); n.id = id; for (const [value, text] of items) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = text;
        n.append(o);
    } $('command-fields').append(l, n); }
    function dialog(title, setup, run) { if (busy)
        return; $('submit-command').dataset.stale = ''; $('submit-command').disabled = false; $('dialog-title').textContent = title; $('command-fields').replaceChildren(); msg('dialog-status', ''); dirty = false; command = { run, epoch, id: selected?.id, version: selected?.version, key: crypto.randomUUID() }; setup(); if (session.syntheticOnly && $('synthetic')) { $('synthetic').checked = true; $('synthetic').disabled = true; } $('command-dialog').showModal(); $('command-fields').querySelector('input,textarea,select')?.focus(); }
    async function submit(e) { e.preventDefault(); if (busy || !command)
        return; const c = command; if (c.epoch !== epoch)
        return; busy = true; document.querySelectorAll('button').forEach(n => n.disabled = true); msg('dialog-status', 'Recording - '); try {
        const result = await c.run({ expectedVersion: c.version, idempotencyKey: c.key });
        dirty = false;
        $('command-dialog').close();
        busy = false;
        const id = result?.leadId || c.id;
        if (id)
            await openLead(id);
        cursor = null;
        await load();
        msg('context-status', 'Action recorded. Projection refreshed.');
    }
    catch (e) {
        msg('dialog-status', err(e), true);
        telemetry('workflow_error', c.id);
        if (e.status === 409) {
            $('submit-command').dataset.stale = 'true';
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = 'Reload current lead';
            b.onclick = async () => {
                busy = false;
                await openLead(c.id);
                if (!selected || !command) return;
                command = { ...c, epoch, version: selected.version, key: crypto.randomUUID() };
                $('submit-command').dataset.stale = '';
                $('submit-command').disabled = false;
                msg('dialog-status', 'Current lead refreshed. Draft retained. Review the current context before explicitly recording again.');
            };
            $('dialog-status').append(b);
        }
    }
    finally {
        busy = false;
        document.querySelectorAll('button').forEach(n => n.disabled = n.id === 'submit-command' && n.dataset.stale === 'true');
    } }
    async function mutate(path, body, meta, event) { const id = selected.id, r = await post('leads/' + encodeURIComponent(id) + path, { ...body, ...meta }); telemetry(event, id); return r; }
    const due = id => v(id) ? { dueAt: new Date(v(id)).toISOString() } : {};
    function button(root, id, label, handler) { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = label; b.onclick = handler; root.append(b); }
    function basic(title, path, event, fields, payload) { dialog(title, () => fields.forEach(f => field(...f)), meta => mutate(path, payload(), meta, event)); }
    function render() {
        const d = selected.d, root = $('context');
        msg('context-status', 'Recorded projection. Business truth and attribution UNKNOWN.');
        root.innerHTML = '<h3>' + esc(d.lead.displayName) + '</h3><p>Stable Lead ID: ' + esc(selected.id) + '</p><p class="badge">' + (d.isSynthetic === true ? 'SYNTHETIC' : d.isSynthetic === false ? 'REAL' : 'CLASSIFICATION UNKNOWN') + '</p><p>Status: ' + esc(d.lead.status) + '  -  Version: ' + esc(d.version) + '</p><p>Owner: ' + esc(d.lead.owner) + '  -  Recipient: ' + esc(d.lead.handoffRecipient) + '</p><h3>Current context</h3><pre>' + esc(d.currentContext?.text || d.currentContext || d.handoff?.context) + '</pre><div id="lead-actions"></div><section id="commercial-truth" aria-label="Source lineage and attribution"></section><section id="contact-history" aria-label="Contact attempt history"></section><div id="work-items"></div><div id="outcomes"></div><div id="read-view" role="region" aria-label="Evidence and audit"></div>';
        const a = $('lead-actions');
        button(a, 'reload-lead', 'Reload lead', () => openLead(selected.id));
        button(a, 'edit-context', 'Edit context', () => basic('Append context revision', '/context', 'context_edited', [['context-text', 'Context', 'textarea', true, d.currentContext?.text || ''], ['reason', 'Reason', 'textarea']], () => ({ text: v('context-text'), reason: v('reason') })));
        button(a, 'evidence', 'View original evidence', () => read('evidence', 'evidence_viewed'));
        button(a, 'audit', 'View detailed audit', () => read('timeline'));
        if (session.context?.role === 'admin') button(a, 'export-lead', 'Export lead data', async () => {
            const id = selected.id, generation = epoch;
            try {
                const data = await request('/v1/pilot/lifecycle/leads/' + encodeURIComponent(id) + '/export');
                if (generation !== epoch) return;
                const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                const link = document.createElement('a'); link.href = url; link.download = 'lead-export.json'; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 0);
                msg('context-status', 'Audited export downloaded. This does not delete retained data.');
            } catch (error) { if (generation === epoch) msg('context-status', err(error), true); }
        });
        button(a, 'handoff', 'Handoff to Sales', handoff);
        button(a, 'create-action', 'Create next action', () => basic('Create independent action', '/next-actions', 'action_created', [['action', 'Action', 'textarea'], ['due', 'Due time', 'datetime-local', false], ['reason', 'Reason', 'textarea']], () => ({ action: v('action'), reason: v('reason'), ...due('due') })));
        for (const stage of ['Contacting', 'Follow-up'])
            button(a, 'stage-' + stage, 'Move to ' + stage, () => basic('Move to ' + stage, '/commands/advance', null, [['reason', 'Reason', 'textarea']], () => ({ to: stage, reason: v('reason') })));
        button(a, 'outcome', 'Record outcome claim', () => outcome());
        button(a, 'feedback', 'Send feedback', feedback);
        button(a, 'record-contact', 'Record contact attempt', contactAttempt);
        button(a, 'contact-attempts', 'View contact attempt history', () => contactHistory(selected.id, epoch));
        for (const w of d.workItems || []) {
            const s = document.createElement('section');
            s.innerHTML = '<h3>' + esc(w.action) + '</h3><pre>' + esc(JSON.stringify(w, null, 2)) + '</pre>';
            $('work-items').append(s);
            button(s, 'accept-' + w.id, 'Accept handoff', () => basic('Accept handoff', '/commands/accept', 'handoff_accepted', [['reason', 'Acceptance reason', 'textarea']], () => ({ workId: w.id, reason: v('reason') })));
            button(s, 'complete-' + w.id, 'Complete action', () => completion(w));
            button(s, 'reschedule-' + w.id, 'Reschedule', () => basic('Reschedule action', '/next-actions/' + encodeURIComponent(w.id) + '/reschedule', 'action_rescheduled', [['due', 'New due time', 'datetime-local'], ['reason', 'Reason', 'textarea']], () => ({ newDueAt: new Date(v('due')).toISOString(), reason: v('reason') })));
            button(s, 'reopen-' + w.id, 'Reopen as successor', () => basic('Reopen action', '/next-actions/' + encodeURIComponent(w.id) + '/reopen', 'action_reopened', [['due', 'Due time', 'datetime-local', false], ['reason', 'Reason', 'textarea']], () => ({ ...due('due'), reason: v('reason') })));
        }
        for (const o of d.outcomes || []) {
            const s = document.createElement('section');
            s.innerHTML = '<h3>Outcome claim</h3><pre>' + esc(JSON.stringify(o, null, 2)) + '</pre>';
            $('outcomes').append(s);
            button(s, 'correct-' + o.id, 'Correct outcome', () => outcome(o.id));
        }
    }
    async function contactHistory(id, generation, after) {
        try {
            const data = await request('/v1/pilot/leads/' + encodeURIComponent(id) + '/contact-attempts?limit=50' + (after ? '&after=' + encodeURIComponent(after) : ''));
            if (generation !== epoch) return;
            const truth = $('commercial-truth'); truth.replaceChildren();
            for (const [key, label] of [['conversationSource', 'Conversation Source'], ['acquisitionLineage', 'Acquisition Lineage'], ['revenueAttribution', 'Revenue Attribution']]) {
                const p = document.createElement('p'), t = data.truth[key];
                p.textContent = label + ': ' + (t.status === 'unknown' ? 'UNKNOWN' : t.value) + ' ? ' + t.reason; truth.append(p);
            }
            const root = $('contact-history'); root.replaceChildren();
            const h = document.createElement('h3'); h.textContent = 'Contact attempt history (human claims)'; root.append(h);
            if (!data.items.length) { const p = document.createElement('p'); p.textContent = 'No contact attempts recorded.'; root.append(p); }
            for (const a of data.items) {
                const p = document.createElement('pre');
                p.textContent = 'Occurred: ' + (a.occurredAt === 'unknown' ? 'UNKNOWN ? not supplied by operator' : a.occurredAt) + '\nChannel: ' + a.channel + '\nActor: ' + a.actor + '\nRecorded: ' + a.recordedAt + '\nClaimed result: ' + a.claimedResult + '\nEvidence: ' + (a.evidenceRef || 'UNKNOWN ? no evidence linked') + '\nFollow-up implication (claim; no action scheduled): ' + a.followUpImplication + '\nReason: ' + a.reason;
                root.append(p);
            }
            if (data.nextCursor) button(root, 'contact-next', 'Next contact attempts', () => contactHistory(id, generation, data.nextCursor));
        } catch (e) { if (generation === epoch) { $('commercial-truth').textContent = 'Conversation Source / Acquisition Lineage / Revenue Attribution unavailable: ' + err(e); $('contact-history').textContent = 'Contact history unavailable: ' + err(e); } }
    }
    function contactAttempt() {
        dialog('Record manual contact claim', () => {
            field('contact-occurred', 'Contact occurred at (optional; otherwise UNKNOWN)', 'datetime-local', false);
            choices('contact-channel', 'Contact channel', [['phone', 'Phone'], ['message', 'Message'], ['email', 'Email'], ['other', 'Other']]);
            choices('contact-result', 'Claimed contact result', [['unknown', 'Unknown'], ['reached', 'Reached (claim)'], ['no-answer', 'No answer (claim)'], ['left-message', 'Left message (claim)']]);
            field('contact-evidence', 'Contact evidence reference (optional)', 'text', false);
            field('contact-follow-up', 'Follow-up implication (does not schedule an action)', 'textarea');
            field('reason', 'Contact claim reason', 'textarea');
        }, meta => mutate('/contact-attempts', { occurredAt: v('contact-occurred') ? new Date(v('contact-occurred')).toISOString() : 'unknown', channel: v('contact-channel'), claimedResult: v('contact-result'), followUpImplication: v('contact-follow-up'), reason: v('reason'), ...(v('contact-evidence') ? { evidenceRef: v('contact-evidence') } : {}) }, meta, 'contact_attempt_recorded'));
    }
    async function handoff() { const generation = epoch; try {
        telemetry('handoff_started', selected.id);
        const directory = await request('/v1/pilot/assignees');
        if (generation !== epoch)
            return;
        dialog('Handoff to Sales', () => { choices('recipient', 'Recipient', directory.items.map(i => [i.userId, i.userId + ' (' + i.role + ')'])); field('handoff-context', 'Handoff context', 'textarea'); field('action', 'Proposed action', 'textarea'); field('reason', 'Handoff reason', 'textarea'); field('due', 'Due time', 'datetime-local', false); field('evidence-ref', 'Evidence reference (optional)', 'text', false); }, meta => mutate('/commands/handoff', { reason: v('reason'), context: v('handoff-context'), proposedAction: v('action'), recipientUserId: v('recipient'), responsibleParty: 'internal', origin: 'explicit-request', ...due('due'), ...(v('evidence-ref') ? { evidenceRef: v('evidence-ref') } : {}) }, meta, 'handoff_created'));
    }
    catch (e) {
        msg('context-status', err(e), true);
    } }
    function completion(w) { dialog('Complete action with evidence', () => { choices('complete-mode', 'Completion evidence basis', [['declared', 'Declared human claim'], ['observed', 'Observed system proof']]); field('declaration-input', 'Human declaration', 'textarea', false); field('declaration-confirm', 'I confirm this is my human declaration', 'checkbox', false); field('evidence-ref-input', 'Observed system action-proof pointer', 'text', false); }, meta => { const mode = v('complete-mode'), declaration = v('declaration-input'), confirmed = $('declaration-confirm').checked, evidenceRef = v('evidence-ref-input'); if (mode === 'declared' && (!declaration || !confirmed))
        throw new Error('Enter a human declaration and explicitly confirm it.'); if (mode === 'observed' && !evidenceRef)
        throw new Error('Observed completion requires a system evidence pointer.'); return mutate('/next-actions/' + encodeURIComponent(w.id) + '/complete', mode === 'declared' ? { evidence: mode, declaration, confirmed } : { evidence: mode, evidenceRef }, meta, 'action_completed'); }); }
    function outcome(id) { dialog(id ? 'Correct outcome (append revision)' : 'Record outcome claim', () => { choices('outcome-value', 'Outcome', [['Unknown', 'Unknown'], ['Won', 'Won (claim; not revenue)'], ['Lost', 'Lost']]); field('reason', 'Reason', 'textarea'); }, meta => mutate(id ? '/outcomes/' + encodeURIComponent(id) + '/correct' : '/commands/outcome', { value: v('outcome-value'), reason: v('reason') }, meta, id ? 'outcome_corrected' : 'outcome_recorded')); }
    async function read(kind, event) { const generation = epoch; msg('context-status', 'Loading ' + kind + ' - '); try {
        const data = await request('/v1/pilot/leads/' + encodeURIComponent(selected.id) + '/' + kind);
        if (generation !== epoch)
            return;
        const root = $('read-view');
        root.replaceChildren();
        const h = document.createElement('h3');
        h.textContent = kind === 'evidence' ? 'Original accepted evidence' : 'Detailed append-only timeline';
        root.append(h);
        if (kind === 'evidence') {
            if (!data.items.length) {
                const p = document.createElement('p');
                p.textContent = 'Evidence unavailable: no accepted source evidence visible.';
                root.append(p);
            }
            for (const e of data.items) {
                const p = document.createElement('pre');
                p.textContent = JSON.stringify({ ...e, rawPayload: undefined }, null, 2);
                const raw = document.createElement('pre');
                raw.textContent = e.rawPayload ? 'Speaker: ' + (e.rawPayload.speaker || 'UNKNOWN') + '\nUtterance: ' + (e.rawPayload.utterance ?? 'Unavailable / redacted') : 'Raw evidence unavailable / redacted';
                root.append(p, raw);
            }
        }
        else {
            const p = document.createElement('pre');
            p.textContent = JSON.stringify(data, null, 2);
            root.append(p);
        }
        msg('context-status', kind + ' loaded.');
        telemetry(event, selected.id);
    }
    catch (e) {
        if (generation === epoch)
            msg('context-status', err(e), true);
    } }
    function feedback() { dialog('Feedback', () => { choices('rating', 'Rating', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]); field('feedback-body', 'Feedback (optional)', 'textarea', false); }, () => post('feedback', { leadId: selected.id, rating: Number(v('rating')), body: v('feedback-body') })); }
    $('new-lead').onclick = () => dialog('Create lead from original conversation', () => { field('display-name', 'Lead display name'); field('utterance', 'Original utterance', 'textarea'); choices('speaker', 'Speaker', [['customer', 'Customer'], ['staff', 'Staff']]); field('connection', 'Conversation source / connection'); field('external-record', 'Source record ID'); field('occurred', 'Occurred at (optional; otherwise UNKNOWN)', 'datetime-local', false); field('synthetic', 'Synthetic fixture (immutable after creation)', 'checkbox', false); }, () => post('scenarios', { displayName: v('display-name'), utterance: v('utterance'), speaker: v('speaker'), connection: v('connection'), externalRecordId: v('external-record'), occurredAt: v('occurred') ? new Date(v('occurred')).toISOString() : 'unknown', isSynthetic: $('synthetic').checked }));
    $('command-form').onsubmit = submit;
    const discard = () => (!dirty && !recovery) || window.confirm('Discard unsaved changes?');
    $('command-fields').addEventListener('input', () => { dirty = true; });
    window.addEventListener('beforeunload', e => { if (dirty || recovery) { e.preventDefault(); e.returnValue = ''; } });
    $('cancel-command').onclick = () => { if (!busy && discard()) $('command-dialog').close(); };
    $('command-dialog').addEventListener('close', () => { $('submit-command').dataset.stale = ''; $('submit-command').disabled = false; command = null; dirty = false; $('command-fields').replaceChildren(); });
    $('command-dialog').addEventListener('cancel', e => { if (busy || !discard())
        e.preventDefault(); });
    $('recheck-session').onclick = async () => {
        const held = recovery;
        if (!held) return;
        try {
            const fresh = await request('/v1/auth/session');
            if (!fresh.authenticated) { msg('session-status', 'Sign in before rechecking.', true); return; }
            if (fresh.context.userId !== held.context.userId || fresh.context.workspaceId !== held.context.workspaceId) {
                recovery = null; clear(); session = fresh; $('recheck-session').hidden = true;
                msg('session-status', 'Identity or workspace changed. Unsaved draft discarded.', true); return;
            }
            session = fresh;
            await openLead(held.command.id);
            if (!selected || !recovery) return;
            $('command-fields').replaceChildren(...held.fields);
            command = { ...held.command, epoch, version: selected.version, key: crypto.randomUUID() };
            recovery = null; dirty = true; $('recheck-session').hidden = true;
            $('submit-command').disabled = false; $('submit-command').dataset.stale = '';
            $('command-dialog').showModal();
            msg('dialog-status', 'Session restored and lead access checked. Review draft and refreshed context before explicitly recording.');
            msg('session-status', 'Signed in.'); $('signin').hidden = true;
        } catch (e) { msg('session-status', err(e), true); }
    };
    $('logout').onclick = async () => { if (!discard()) return; recovery = null; clear(); try {
        await request('/v1/auth/logout', { method: 'POST', body: '{}' });
        clear();
        $('token').value = '';
        session = {};
        await init();
    }
    catch (e) {
        msg('session-status', err(e), true);
    } };
    $('login-workspace').oninput = () => { recovery = null; $('recheck-session').hidden = true; $('signin').href = '/v1/auth/login' + (v('login-workspace') ? '?workspace=' + encodeURIComponent(v('login-workspace')) : ''); };
    $('token').oninput = () => { recovery = null; $('recheck-session').hidden = true; clear(); msg('queue-status', 'Load workspace for this development token.'); };
    for (const id of ['load', 'refresh'])
        $(id).onclick = () => { cursor = null; load(); };
    $('next').onclick = load;
    for (const id of ['classification', 'view'])
        $(id).onchange = () => { clear(); load(); };
    init();
})();
`;



