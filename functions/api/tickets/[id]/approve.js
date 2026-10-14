// POST /api/tickets/:id/approve — the customer approves the shop's final price and is sent to Square to pay.
import { json, err, now, getTicket, addEvent, notify, siteUrl, ticketNo, priceLines, money } from '../../../_lib/util.js';
import { createPaymentLink, squareReady } from '../../../_lib/square.js';

export async function onRequestPost({ request, params, env }) {
  const t = await getTicket(env, String(params.id));
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await request.json(); } catch { b = {}; }
  if (Number(b.version) !== t.version) return err('The price was just updated. Refresh to see the latest version before approving.', 409);
  if (!['awaiting_approval', 'approved'].includes(t.status)) return err('This ticket is not waiting for approval.', 409);
  const due = t.total_cents - t.paid_cents;
  if (due <= 0) return err('Nothing is due on this ticket.', 409);

  // Same version already approved and a Square page exists: send them back to it.
  if (t.status === 'approved' && t.approved_version === t.version && t.square_link_url) return json({ url: t.square_link_url });
  if (!squareReady(env)) return err('Online payment is not switched on yet. We will text you a payment link.', 503);

  const p = priceLines(JSON.parse(t.lines || '[]'), t.tax_rate);
  let lines;
  if (t.paid_cents > 0 || p.lines.some((l) => l.unit_cents < 0)) {
    lines = [{ name: `${ticketNo(t.number)} ${t.paid_cents > 0 ? 'balance due' : 'work ticket'}`, cents: due }];
  } else {
    lines = p.lines.filter((l) => l.unit_cents > 0).map((l) => ({ name: l.qty > 1 ? `${l.desc} × ${l.qty}` : l.desc, cents: l.qty * l.unit_cents }));
    if (p.tax_cents > 0) lines.push({ name: 'Alabama sales tax on parts', cents: p.tax_cents });
  }
  let link;
  try {
    link = await createPaymentLink(env, {
      idempotencyKey: `${t.id}-v${t.version}-${t.paid_cents}`,
      reference: ticketNo(t.number), lines,
      redirectUrl: siteUrl(env, '/ticket/?t=' + t.id + '&paid=1'),
      email: t.email, phone: t.phone && t.phone.length === 10 ? '+1' + t.phone : t.phone,
    });
  } catch (e) {
    console.log(e.message);
    return err('Square could not start the payment. Please try again in a minute or text us.', 502);
  }
  await env.DB.prepare("UPDATE tickets SET status = 'approved', approved_version = ?, square_order_id = ?, square_link_url = ?, updated_at = ? WHERE id = ?")
    .bind(t.version, link.orderId, link.url, now(), t.id).run();
  await addEvent(env, t.id, 'customer', 'approved', `Approved ${money(due)} and started payment.`);
  await notify(env, `${ticketNo(t.number)} approved by ${t.name}`, `${money(due)} approved; waiting on Square payment.\n${siteUrl(env, '/admin/?t=' + t.id)}`);
  return json({ url: link.url });
}
