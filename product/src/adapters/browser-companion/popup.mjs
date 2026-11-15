const status = document.querySelector('#status');
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  status.textContent = response.ok ? JSON.stringify(response.result, null, 2) : response.error;
  return response;
}
document.querySelector('#scope').addEventListener('submit', async (event) => {
  event.preventDefault();
  await send({ kind: 'start', scope: Object.fromEntries(new FormData(event.target)) });
});
document.querySelector('#stop').addEventListener('click', () => send({ kind: 'stop' }));
document.querySelector('#export').addEventListener('click', async () => {
  const response = await send({ kind: 'export' });
  if (!response.ok) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(response.result, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'north-star-observations.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
await send({ kind: 'status' });
