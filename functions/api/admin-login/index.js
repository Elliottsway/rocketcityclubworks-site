// POST /api/admin-login {password} — password sign-in for the shop admin page (sets a 30-day cookie).
// POST /api/admin-login {logout:true} — signs out.
import { json, err } from '../../_lib/util.js';
import { checkPassword, makeSession } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return err('Bad request'); }
  const cookie = (v, age) => `rccw_admin=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  if (b.logout) return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  await new Promise((r) => setTimeout(r, 600)); // slows down password guessing
  if (!(await checkPassword(env, b.password))) return err('Wrong password.', 401);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(await makeSession(env), 30 * 86400) });
}
