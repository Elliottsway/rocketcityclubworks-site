// GET /api/admin/tickets/:id — full ticket for the shop.
// PUT /api/admin/tickets/:id — re-price lines, add a note, send for approval, move status, or message the customer.
import { json, err, now, clip, getTicket, events, addEvent, publicTicket, priceLines, STATUSES, money } from '../../../_lib/util.js';

export async function onRequestGet({ params, env }) {
  const t = await getTicket(env, String(params.id));
  if (!t) return err('Ticket not found.', 404);
  return json({ ...publicTicket(t, await events(env, t.id)), phone: t.phone, email: t.email, ref: t.ref, square_order_id: t.square_order_id });
}

export async function onRequestPut({ request, params, env }) {
  const t = await getTicket(env, String(params.id));
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await request.json(); } catch { return err('Bad request'); }
  if (b.version != null && Number(b.version) !== t.version) return err('This ticket changed while you were editing. Reload it first.', 409);

  let { status, version, total_cents } = t;
  let lines = t.lines, taxRate = t.tax_rate, shopNote = t.shop_note;
  const changes = [];

  if (b.lines || b.tax_rate != null) {
    taxRate = b.tax_rate != null ? Math.max(0, Math.min(0.2, Number(b.tax_rate) || 0)) : taxRate;
    const p = priceLines(b.lines || JSON.parse(t.lines || '[]'), taxRate);
    if (JSON.stringify(p.lines) !== t.lines || taxRate !== t.tax_rate) {
      lines = JSON.stringify(p.lines); total_cents = p.total_cents; version += 1;
      changes.push(`Price updated to ${money(total_cents)}.`);
      // A price change after approval needs the customer to approve again.
      if (status === 'approved') status = 'awaiting_approval';
    }
  }
  if (b.shop_note != null && b.shop_note !== t.shop_note) { shopNote = clip(b.shop_note, 3000); changes.push('Shop note updated.'); }
  if (b.send_for_approval) {
    if (total_cents - t.paid_cents <= 0) return err('Nothing is due, so there is nothing to approve.');
    status = 'awaiting_approval';
  } else if (b.status) {
    if (!STATUSES.includes(b.status)) return err('Unknown status.');
    status = b.status;
  }

  await env.DB.prepare('UPDATE tickets SET status = ?, version = ?, lines = ?, tax_rate = ?, total_cents = ?, shop_note = ?, updated_at = ? WHERE id = ?')
    .bind(status, version, lines, taxRate, total_cents, shopNote, now(), t.id).run();
  if (changes.length) await addEvent(env, t.id, 'shop', 'priced', changes.join(' '));
  if (status !== t.status) await addEvent(env, t.id, 'shop', 'status', status);
  if (b.message) await addEvent(env, t.id, 'shop', 'message', clip(b.message, 1500));

  const fresh = await getTicket(env, t.id);
  return json({ ...publicTicket(fresh, await events(env, t.id)), phone: fresh.phone, email: fresh.email, ref: fresh.ref });
}
