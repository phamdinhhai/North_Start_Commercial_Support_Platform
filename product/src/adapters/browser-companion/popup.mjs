import { backendOrigin } from './upload.mjs';
import { errorMessage, popupView } from './popup-view.mjs';
const $ = (selector) => document.querySelector(selector);
const summary = $('#summary');
let shownPending = null; // count the user actually saw in the discard confirmation label

function render(status) {
  const view = popupView(status);
  summary.textContent = view.summary;
  $('#blocked').hidden = !view.blocked;
  $('#blocked-reason').textContent = view.blockedText;
  $('#full').hidden = !view.full;
  $('#reset').hidden = !view.reset;
  shownPending = view.pending;
  $('#discard-label').textContent = `I understand ${view.pending} records are permanently deleted.`;
  $('#drift').hidden = !view.drift;
  $('#drift-text').textContent = view.drift;
  $('#details').textContent = JSON.stringify(status, null, 2);
}

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response.ok) summary.textContent = errorMessage(response.code);
  else if (message.kind !== 'export') render(response.result);
  return response;
}
const refresh = () => send({ kind: 'status' });

$('#scope').addEventListener('submit', async (event) => {
  event.preventDefault();
  await send({ kind: 'start', scope: Object.fromEntries(new FormData(event.target)) });
});
$('#stop').addEventListener('click', () => send({ kind: 'stop' }));
$('#export').addEventListener('click', async () => {
  const response = await send({ kind: 'export' });
  if (!response.ok) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(response.result, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'north-star-observations.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await refresh();
  summary.textContent = `Redacted metadata exported (${response.result.outbox.length} records). ` + summary.textContent;
});
$('#upload-settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const origin = backendOrigin($('#backend').value);
    const enrollment = JSON.parse($('#enrollment').value);
    if (!$('#consent').checked) return;
    // Permission request originates from an explicit user gesture and grants only this origin.
    if (!await chrome.permissions.request({ origins: [origin + '/*'] })) throw new Error();
    await send({ kind: 'configure-upload', origin, enrollment });
    $('#enrollment').value = '';
  } catch { summary.textContent = 'Enrollment unavailable: check origin, grant and permission. Existing records are retained.'; }
});
$('#upload').addEventListener('click', () => send({ kind: 'upload' }));
$('#disconnect').addEventListener('click', () => send({ kind: 'disconnect-upload' }));
$('#reset').addEventListener('submit', async (event) => {
  event.preventDefault();
  const disposition = new FormData(event.target).get('disposition');
  if (disposition === 'discarded' && !$('#confirm-discard').checked) {
    summary.textContent = errorMessage('discard_confirmation_required');
    $('#confirm-discard').focus();
    return;
  }
  // The worker re-checks the displayed count, so records captured after rendering are never discarded unseen.
  await send({ kind: 'reset-enrollment', disposition, ...(disposition === 'discarded' ? { confirmDiscard: shownPending } : {}) });
  $('#confirm-discard').checked = false;
});
await refresh();
