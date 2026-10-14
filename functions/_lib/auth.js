// Admin auth. Two ways in: a password login (signed cookie, see below) or Cloudflare Access,
// which signs every request with a JWT (Cf-Access-Jwt-Assertion) that we verify ourselves.
//
// env.ACCESS_TEAM_DOMAIN  e.g. "rccw.cloudflareaccess.com"
// env.ACCESS_AUD          the Access application's audience tag
// env.ADMIN_EMAILS        comma-separated emails allowed in (e.g. "jackson@rocketcityclubworks.com")
// env.DEV_ADMIN = "1"     local development only: skips the check. Never set this in Cloudflare.

let certCache = { at: 0, keys: [] };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function accessKeys(team) {
  if (Date.now() - certCache.at < 3600_000 && certCache.keys.length) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  const j = await r.json();
  certCache = { at: Date.now(), keys: j.keys || [] };
  return certCache.keys;
}

// ---- Password login (used when Cloudflare Access is not set up) ----
// env.ADMIN_PASSWORD: a long passphrase stored as a Cloudflare secret. Login sets a signed cookie for 30 days.
async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
export async function makeSession(env) {
  const exp = Date.now() + 30 * 86400_000;
  return exp + '.' + (await hmac(env.ADMIN_PASSWORD, 'admin.' + exp));
}
export async function checkPassword(env, pw) {
  if (!env.ADMIN_PASSWORD || typeof pw !== 'string') return false;
  return safeEqual(await hmac('pw', pw), await hmac('pw', env.ADMIN_PASSWORD));
}
async function sessionOk(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)rccw_admin=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, 'admin.' + exp));
}

export async function adminEmail(request, env) {
  if (env.DEV_ADMIN === '1') return 'dev@localhost';
  if (await sessionOk(request, env)) return 'password-login';
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(h + '.' + p));
    if (!ok) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    const email = String(payload.email || '').toLowerCase();
    const allowed = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
    return allowed.includes(email) ? email : null;
  } catch (e) {
    return null;
  }
}
