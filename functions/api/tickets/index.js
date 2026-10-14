// POST /api/tickets — a customer submits their instant price as a work ticket for review.
import { json, err, now, newId, sha256, clip, priceLines, addEvent, notify, siteUrl, ticketNo, money } from '../../_lib/util.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return err('Bad request'); }
  if (b.website) return json({ ok: true }); // honeypot field filled in: a bot

  const name = clip((b.name || '').trim(), 80);
  const phone = clip((b.phone || '').replace(/[^\d+]/g, ''), 16);
  const email = clip((b.email || '').trim().toLowerCase(), 120);
  if (!name) return err('Please add your name.');
  if (!phone && !email) return err('Please add a phone number or email so we can reach you.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('That email does not look right.');
  const spec = JSON.stringify(b.spec || {}).slice(0, 20000);

  // Up to 5 tickets an hour from one connection.
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ipHash = await sha256(ip + (env.IP_SALT || 'rccw'));
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM tickets WHERE ip_hash = ? AND created_at > ?').bind(ipHash, hourAgo).first();
  if (recent && recent.n >= 5) return err('Too many tickets at once. Please text us instead.', 429);

  const taxRate = Number(env.TAX_RATE || 0);
  const p = priceLines(b.lines, taxRate);
  const id = newId(), t = now();
  const last = await env.DB.prepare('SELECT MAX(number) AS n FROM tickets').first();
  const number = (last && last.n ? last.n : 1000) + 1;
  await env.DB.prepare(`INSERT INTO tickets (id, number, status, created_at, updated_at, name, phone, email, customer_note, spec, lines, tax_rate, total_cents, ref, ip_hash)
      VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, number, t, t, name, phone, email, clip(b.note, 2000), spec, JSON.stringify(p.lines), taxRate, p.total_cents, clip(b.ref, 12), ipHash).run();
  await addEvent(env, id, 'customer', 'submitted', 'Ticket submitted from the instant price.');

  await notify(env, `New work ticket ${ticketNo(number)} from ${name}`,
    `${name} · ${phone || ''} ${email || ''}\nEstimate: ${money(p.total_cents)}\n\n${b.summary ? String(b.summary).slice(0, 3000) : ''}\n\nNote: ${b.note || '-'}\n\nReview it: ${siteUrl(env, '/admin/?t=' + id)}`);

  return json({ id, number: ticketNo(number), url: siteUrl(env, '/ticket/?t=' + id) }, 201);
}
