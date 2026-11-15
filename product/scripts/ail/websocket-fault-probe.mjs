/** Only install on a disposable research page: Playwright has no public unrouteWebSocket API. */
export async function installWebSocketFaultProbe(page, matches) {
  let blocked = false;
  const bridges = [];
  const audit = { forwardedConnections: 0, refusedConnections: 0, cutConnections: 0, closeFailures: 0 };
  await page.routeWebSocket(matches, (client) => {
    if (blocked) {
      audit.refusedConnections += 1;
      client.close({ code: 1012, reason: 'North Star bounded research fault' }).catch(() => { audit.closeFailures += 1; });
      return;
    }
    // Default forwarding is untouched; no message handlers or payload storage.
    const server = client.connectToServer();
    audit.forwardedConnections += 1;
    if (bridges.length < 64) bridges.push({ client, server });
  });
  return {
    audit,
    async cut() {
      blocked = true;
      const active = bridges.splice(0);
      audit.cutConnections += active.length;
      const results = await Promise.allSettled(active.flatMap(({ client, server }) => [
        client.close({ code: 1012, reason: 'North Star bounded research fault' }),
        server.close({ code: 1012, reason: 'North Star bounded research fault' }),
      ]));
      audit.closeFailures += results.filter((result) => result.status === 'rejected').length;
    },
    restore() { blocked = false; },
  };
}
