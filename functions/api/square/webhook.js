// POST /api/square/webhook — Square tells us a payment went through; mark the ticket paid.
import { json, now, addEvent, notify, siteUrl, ticketNo, money } from '../../_lib/util.js';
import { verifyWebhook } from '../../_lib/square.js';

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  if (!(await verifyWebhook(env, raw, request.headers.get('x-square-hmacsha256-signature')))) return json({ error: 'bad signature' }, 401);
  let ev; try { ev = JSON.parse(raw); } catch { return json({ ok: true }); }
  const pay = ev && ev.data && ev.data.object && ev.data.object.payment;
  if (!pay || pay.status !== 'COMPLETED' || !pay.order_id) return json({ ok: true });

  const t = await env.DB.prepare('SELECT * FROM tickets WHERE square_order_id = ?').bind(pay.order_id).first();
  if (!t) return json({ ok: true });
  const amount = (pay.amount_money && pay.amount_money.amount) || 0;
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO payments (square_payment_id, ticket_id, amount_cents, at) VALUES (?, ?, ?, ?)').bind(pay.id, t.id, amount, now()).run();
  if (!ins.meta || !ins.meta.changes) return json({ ok: true }); // already recorded (Square retries)

  const paid = t.paid_cents + amount;
  const status = paid >= t.total_cents && ['approved', 'awaiting_approval'].includes(t.status) ? 'paid' : t.status;
  await env.DB.prepare('UPDATE tickets SET paid_cents = ?, status = ?, updated_at = ? WHERE id = ?').bind(paid, status, now(), t.id).run();
  await addEvent(env, t.id, 'system', 'paid', `Paid ${money(amount)} by card.`);
  await notify(env, `${ticketNo(t.number)} paid ${money(amount)}`, `${t.name} paid ${money(amount)}. Time to order parts.\n${siteUrl(env, '/admin/?t=' + t.id)}`);
  return json({ ok: true });
}
