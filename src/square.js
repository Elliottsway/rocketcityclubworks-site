// Square: hosted checkout for approved tickets, and payment confirmation straight from Square's API.
// A ticket's paid amount only goes up after Square's API itself says the payment COMPLETED for this
// ticket's order at our location, whether we heard about it from the webhook or the customer returning.
import { json, now, addEvent, notifyShop, notifyCustomer, siteUrl, ticketNo, money } from './lib.js';

const VERSION = '2024-10-17';
const base = (env) => env.SQUARE_API_BASE || (env.SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com');
const headers = (env) => ({ Authorization: 'Bearer ' + env.SQUARE_ACCESS_TOKEN, 'Square-Version': VERSION, 'Content-Type': 'application/json' });

export const squareReady = (env) => !!(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID);

// lines: [{name, cents}] — the final approved amounts (tax as its own line)
export async function createPaymentLink(env, { idempotencyKey, reference, lines, redirectUrl, email, phone }) {
  const body = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: env.SQUARE_LOCATION_ID, reference_id: reference,
      line_items: lines.map((l) => ({ name: l.name.slice(0, 500), quantity: '1', base_price_money: { amount: l.cents, currency: 'USD' } })),
    },
    checkout_options: { redirect_url: redirectUrl, ask_for_shipping_address: false, allow_tipping: false },
    pre_populated_data: {},
  };
  if (email) body.pre_populated_data.buyer_email = email;
  if (phone && /^\d{10}$/.test(phone)) body.pre_populated_data.buyer_phone_number = '+1' + phone;
  const r = await fetch(base(env) + '/v2/online-checkout/payment-links', { method: 'POST', headers: headers(env), body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || !j.payment_link) throw new Error('Square: ' + JSON.stringify(j.errors || j).slice(0, 300));
  return { url: j.payment_link.url, orderId: j.payment_link.order_id };
}

async function getPayment(env, id) {
  const r = await fetch(base(env) + '/v2/payments/' + encodeURIComponent(id), { headers: headers(env) });
  if (!r.ok) return null;
  return (await r.json()).payment || null;
}

// Record one payment for a ticket after checking it with Square. Safe to call repeatedly.
export async function confirmPayment(env, paymentId, ctx) {
  const p = await getPayment(env, paymentId);
  if (!p || p.status !== 'COMPLETED' || p.location_id !== env.SQUARE_LOCATION_ID || !p.order_id) return false;
  const t = await env.DB.prepare('SELECT * FROM tickets WHERE square_order_id = ?').bind(p.order_id).first();
  if (!t) return false;
  const amount = (p.amount_money && p.amount_money.currency === 'USD' && p.amount_money.amount) || 0;
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO payments (square_payment_id, ticket_id, amount_cents, at) VALUES (?, ?, ?, ?)').bind(p.id, t.id, amount, now()).run();
  if (!ins.meta || !ins.meta.changes) return true; // already recorded
  const paid = t.paid_cents + amount;
  const full = paid >= t.total_cents;
  const status = full && ['approved', 'awaiting_approval'].includes(t.status) ? 'paid' : t.status;
  await env.DB.prepare('UPDATE tickets SET paid_cents = ?, status = ?, updated_at = ? WHERE id = ?').bind(paid, status, now(), t.id).run();
  await addEvent(env, t.id, 'system', 'paid', `Payment received: ${money(amount)} (confirmed with Square).`);
  const tasks = [
    notifyShop(env, `${ticketNo(t.number)} PAID ${money(amount)}${full ? '' : ' (partial)'}`,
      `Square confirmed ${money(amount)} on ${ticketNo(t.number)}.${full ? ' Paid in full: its parts are now on your order list.' : ` Still due: ${money(t.total_cents - paid)}.`}\n\n${siteUrl(env, '/admin/?t=' + t.id)}`),
    notifyCustomer(env, t, 'payment received', `Thanks! We received your payment of ${money(amount)}.${full ? ' Jackson will order your parts and keep your ticket updated.' : ''}`),
  ];
  if (ctx) ctx.waitUntil(Promise.all(tasks)); else await Promise.all(tasks);
  return true;
}

// The customer came back from checkout: look up their order's payments with Square directly.
export async function syncOrder(env, t, ctx) {
  if (!t.square_order_id || !squareReady(env)) return;
  const r = await fetch(base(env) + '/v2/orders/' + encodeURIComponent(t.square_order_id), { headers: headers(env) });
  if (!r.ok) return;
  const o = (await r.json()).order;
  for (const tender of (o && o.tenders) || []) if (tender.payment_id) await confirmPayment(env, tender.payment_id, ctx);
}

// Square signs webhooks with base64(HMAC-SHA256(signatureKey, notificationUrl + rawBody)).
async function verifySignature(env, rawBody, signature) {
  if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY || !env.SQUARE_WEBHOOK_URL || !signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(env.SQUARE_WEBHOOK_URL + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== signature.length) return false;
  let d = 0; for (let i = 0; i < expected.length; i++) d |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return d === 0;
}

// POST /api/square/webhook
export async function squareWebhook(request, env, ctx) {
  const raw = await request.text();
  if (!(await verifySignature(env, raw, request.headers.get('x-square-hmacsha256-signature')))) return json({ error: 'bad signature' }, 401);
  let ev; try { ev = JSON.parse(raw); } catch { return json({ ok: true }); }
  const pay = ev && ev.data && ev.data.object && ev.data.object.payment;
  if (pay && pay.id && pay.status === 'COMPLETED') await confirmPayment(env, pay.id, ctx);
  return json({ ok: true });
}
