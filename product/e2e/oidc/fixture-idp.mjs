import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

/** Loopback-only test issuer. No provider, customer account or persistent signing key. */
export async function startIdp(port, appOrigin) {
  const issuer = `http://127.0.0.1:${port}`;
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'runtime-fixture', alg: 'RS256', use: 'sig' };
  const transactions = new Map(), codes = new Map();
  const accounts = ['owner', 'recipient', 'viewer', 'bystander', 'foreign', 'admin'];
  const opaque = () => randomBytes(32).toString('base64url');
  const redirectUri = `${appOrigin}/v1/auth/callback`;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, issuer);
      res.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/jwks') return res.end(JSON.stringify({ keys: [jwk] }));
      if (url.pathname === '/authorize' && req.method === 'GET') {
        const p = url.searchParams;
        if (p.get('client_id') !== 'qa-browser' || p.get('redirect_uri') !== redirectUri || p.get('response_type') !== 'code' ||
            p.get('code_challenge_method') !== 'S256' || p.get('scope') !== 'openid' || !p.get('nonce') || !p.get('state') ||
            !/^[\w-]{43}$/.test(p.get('code_challenge') || '')) throw new Error('authorize');
        const tx = opaque(); transactions.set(tx, { params: p, expires: Date.now() + 60000 });
        res.setHeader('Content-Type', 'text/html');
        return res.end(`<h1>Loopback fixture identity</h1><form method="post" action="/choose"><input type="hidden" name="transaction" value="${tx}"><label>Account<select name="account">${accounts.map(a => `<option>${a}</option>`).join('')}</select></label><button>Continue</button></form>`);
      }
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 8192) throw new Error('bounded'); }
      const p = new URLSearchParams(raw);
      if (url.pathname === '/choose' && req.method === 'POST') {
        const tx = transactions.get(p.get('transaction')); transactions.delete(p.get('transaction'));
        if (!tx || tx.expires < Date.now() || !accounts.includes(p.get('account'))) throw new Error('account');
        const code = opaque(); codes.set(code, { ...tx, account: p.get('account') });
        const target = new URL(redirectUri); target.searchParams.set('code', code); target.searchParams.set('state', tx.params.get('state'));
        res.writeHead(302, { Location: target.href }); return res.end();
      }
      if (url.pathname === '/token' && req.method === 'POST') {
        const code = codes.get(p.get('code')); codes.delete(p.get('code'));
        if (!code || code.expires < Date.now() || p.get('client_id') !== 'qa-browser' || p.get('redirect_uri') !== redirectUri ||
            p.get('grant_type') !== 'authorization_code' || createHash('sha256').update(p.get('code_verifier') || '').digest('base64url') !== code.params.get('code_challenge')) throw new Error('code');
        const sign = (audience, payload) => new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
          .setIssuer(issuer).setAudience(audience).setSubject(code.account).setIssuedAt().setExpirationTime('10m').sign(privateKey);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ token_type: 'Bearer', expires_in: 600,
          access_token: await sign('qa-api', {}), id_token: await sign('qa-browser', { nonce: code.params.get('nonce') }) }));
      }
      res.writeHead(404); res.end();
    } catch { res.writeHead(400); res.end('Fixture protocol rejected'); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return server;
}
