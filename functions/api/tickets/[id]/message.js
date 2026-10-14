// POST /api/tickets/:id/message — the customer asks a question or requests a change.
import { json, err, now, clip, getTicket, addEvent, notify, siteUrl, ticketNo } from '../../../_lib/util.js';

export async function onRequestPost({ request, params, env }) {
  const t = await getTicket(env, String(params.id));
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await request.json(); } catch { return err('Bad request'); }
  const text = clip((b.text || '').trim(), 1500);
  if (!text) return err('Write a message first.');
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE ticket_id = ? AND who = 'customer' AND kind = 'message' AND at > ?").bind(t.id, hourAgo).first();
  if (n && n.n >= 10) return err('Lots of messages at once. Please text us instead.', 429);
  await addEvent(env, t.id, 'customer', 'message', text);
  await env.DB.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').bind(now(), t.id).run();
  await notify(env, `Message on ${ticketNo(t.number)} from ${t.name}`, `${text}\n\n${siteUrl(env, '/admin/?t=' + t.id)}`);
  return json({ ok: true });
}
