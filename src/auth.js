// Sign-in for customers (6-digit email codes, session cookie) and for Jackson (passphrase cookie).
import { json, err, now, newId, sha256, safeEqual, clip, cleanEmail, okEmail, cleanPhone, readJson, limited, ipKey, sendEmail } from './lib.js';

const DAY = 86400_000;
const cookie = (name, v, maxAge, sameSite = 'Lax') => `${name}=${v}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
const readCookie = (request, name) => {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
};

// ---------- customers ----------
export async function currentCustomer(request, env) {
  const tok = readCookie(request, 'rccw_s');
  if (!tok) return null;
  const s = await env.DB.prepare('SELECT customer_id, expires_at FROM sessions WHERE token_hash = ?').bind(await sha256(tok)).first();
  if (!s || s.expires_at < now()) return null;
  return env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(s.customer_id).first();
}

const codeHash = (env, email, code) => sha256(`${email}|${code}|${env.ADMIN_PASSWORD || 'rccw'}`);

// POST /api/auth/start {mode: 'signup'|'signin', email, name?, phone?}  → emails a 6-digit code
export async function authStart(request, env) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  if (b.website) return json({ ok: true }); // honeypot
  const email = cleanEmail(b.email);
  if (!okEmail(email)) return err('Please enter a valid email address.');
  const existing = await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first();
  let name = null, phone = null;
  if (b.mode === 'signup' && !existing) {
    name = clip((b.name || '').trim(), 80); phone = cleanPhone(b.phone);
    if (!name) return err('Please add your name.');
    if (phone.length < 10) return err('Please add a mobile number so Jackson can reach you.');
  } else if (!existing) {
    return err('There is no account with that email yet. Tap "Create account" instead.', 404);
  }
  if (await limited(env, 'code:' + email, 4, 900) || await limited(env, 'codeip:' + ipKey(request), 12, 3600)) {
    return err('Too many codes requested. Please wait a few minutes and try again.', 429);
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await env.DB.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, name, phone) VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, name = excluded.name, phone = excluded.phone`)
    .bind(email, await codeHash(env, email, code), new Date(Date.now() + 15 * 60_000).toISOString(), name, phone).run();
  const sent = await sendEmail(env, { to: email, subject: `${code} is your Rocket City ClubWorks code`,
    text: `Your sign-in code is ${code}\n\nIt works for 15 minutes. If you didn't ask for this, you can ignore this email.` });
  if (!sent && !env.DEV_SHOW_CODE) return err('We could not send the email. Please check the address and try again.', 502);
  return json({ ok: true, existing: !!existing, ...(env.DEV_SHOW_CODE === '1' ? { dev_code: code } : {}) });
}

// POST /api/auth/verify {email, code}  → signs in (creating the account on first sign-up)
export async function authVerify(request, env) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const email = cleanEmail(b.email), code = String(b.code || '').replace(/\D/g, '');
  const row = await env.DB.prepare('SELECT * FROM login_codes WHERE email = ?').bind(email).first();
  if (!row || row.expires_at < now()) return err('That code expired. Ask for a new one.', 400);
  if (row.attempts >= 5) return err('Too many tries. Ask for a new code.', 429);
  if (!safeEqual(row.code_hash, await codeHash(env, email, code))) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return err('That code is not right. Check the email and try again.', 400);
  }
  await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
  let c = await env.DB.prepare('SELECT * FROM customers WHERE email = ?').bind(email).first();
  if (!c) {
    if (!row.name) return err('Please start over and create your account.', 400);
    const id = newId(12);
    const src = String(b.source || '').trim().slice(0, 80) || null, ref = String(b.ref || '').replace(/[^\w.-]/g, '').toUpperCase().slice(0, 24) || null;
    await env.DB.prepare("INSERT INTO customers (id, email, name, phone, created_at, created_by, source, ref) VALUES (?, ?, ?, ?, ?, 'self', ?, ?)")
      .bind(id, email, row.name, row.phone, now(), src, ref).run();
    c = { id };
  }
  await env.DB.prepare('UPDATE customers SET last_login_at = ? WHERE id = ?').bind(now(), c.id).run();
  const tok = newId(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, customer_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(tok), c.id, now(), new Date(Date.now() + 180 * DAY).toISOString()).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('rccw_s', tok, 180 * 86400) });
}

export async function authLogout(request, env) {
  const tok = readCookie(request, 'rccw_s');
  if (tok) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(tok)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('rccw_s', '', 0) });
}

// ---------- Jackson (admin) ----------
async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function isAdmin(request, env) {
  if (env.DEV_ADMIN === '1') return true;
  if (!env.ADMIN_PASSWORD) return false;
  const v = readCookie(request, 'rccw_admin');
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, 'admin.' + exp));
}
// POST /api/admin-login {password} | {logout: true}
export async function adminLogin(request, env) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  if (b.logout) return json({ ok: true }, 200, { 'Set-Cookie': cookie('rccw_admin', '', 0, 'Strict') });
  if (await limited(env, 'admin:' + ipKey(request), 8, 900)) return err('Too many tries. Wait 15 minutes.', 429);
  await new Promise((r) => setTimeout(r, 500));
  const ok = env.ADMIN_PASSWORD && typeof b.password === 'string'
    && safeEqual(await hmac('pw', b.password), await hmac('pw', env.ADMIN_PASSWORD));
  if (!ok) return err('Wrong passphrase.', 401);
  const exp = Date.now() + 30 * DAY;
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('rccw_admin', exp + '.' + (await hmac(env.ADMIN_PASSWORD, 'admin.' + exp)), 30 * 86400, 'Strict') });
}
