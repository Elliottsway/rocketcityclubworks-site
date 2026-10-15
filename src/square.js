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
    checkout_options: { redirect_url: redirectUrl, ask_for_shipping_address: false, allow_tipping: false,
      accepted_payment_methods: { apple_pay: true, google_pay: true, cash_app_pay: true } },
    pre_populated_data: {},
  };
  if (email) body.pre_populated_data.buyer_email = email;
  if (phone && /^\d{10}$/.test(phone)) body.pre_populated_data.buyer_phone_number = '+1' + phone;
  const r = await fetch(base(env) + '/v2/online-checkout/payment-links', { method: 'POST', headers: headers(env), body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || !j.payment_link) throw new Error('Square: ' + JSON.stringify(j.errors || j).slice(0, 300));
  return { url: j.payment_link.url, orderId: j.payment_link.order_id };
}

const cardLabel = (p) => {
  const c = p.card_details && p.card_details.card;
  if (c) return `${(c.card_brand || 'Card').replace(/_/g, ' ')} •••• ${c.last_4 || '????'}`;
  return p.wallet_details ? 'Digital wallet' : p.source_type || null;
};

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
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO payments (square_payment_id, ticket_id, amount_cents, at, card, receipt_url, receipt_number) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(p.id, t.id, amount, now(), cardLabel(p), p.receipt_url || null, p.receipt_number || null).run();
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

// Live details for every payment on a ticket, straight from Square. Also picks up refunds
// made in Square's own dashboard and keeps the ticket's refunded total in step.
export async function ticketPayments(env, t) {
  const rows = (await env.DB.prepare('SELECT * FROM payments WHERE ticket_id = ? ORDER BY at').bind(t.id).all()).results || [];
  const refunds = (await env.DB.prepare('SELECT * FROM refunds WHERE ticket_id = ? ORDER BY at').bind(t.id).all()).results || [];
  const out = [];
  let refundedTotal = 0;
  for (const r of rows) {
    const p = squareReady(env) ? await getPayment(env, r.square_payment_id) : null;
    const refunded = p ? ((p.refunded_money && p.refunded_money.amount) || 0) : r.refunded_cents;
    refundedTotal += refunded;
    if (p && (refunded !== r.refunded_cents || (!r.card && cardLabel(p)))) {
      await env.DB.prepare('UPDATE payments SET refunded_cents = ?, card = COALESCE(card, ?), receipt_url = COALESCE(receipt_url, ?), receipt_number = COALESCE(receipt_number, ?) WHERE square_payment_id = ?')
        .bind(refunded, cardLabel(p), p.receipt_url || null, p.receipt_number || null, r.square_payment_id).run();
    }
    const fee = p && (p.processing_fee || []).reduce((s, f) => s + ((f.amount_money && f.amount_money.amount) || 0), 0);
    out.push({
      id: r.square_payment_id, amount_cents: r.amount_cents, refunded_cents: refunded, at: (p && p.created_at) || r.at,
      status: p ? p.status : 'COMPLETED', card: (p && cardLabel(p)) || r.card, receipt_url: (p && p.receipt_url) || r.receipt_url,
      receipt_number: (p && p.receipt_number) || r.receipt_number, fee_cents: fee || null,
      refundable_cents: Math.max(0, r.amount_cents - refunded),
    });
  }
  if (refundedTotal !== (t.refunded_cents || 0)) await env.DB.prepare('UPDATE tickets SET refunded_cents = ? WHERE id = ?').bind(refundedTotal, t.id).run();
  return { payments: out, refunds, refunded_cents: refundedTotal };
}

// Refund part or all of one payment through Square.
export async function refundPayment(env, { paymentId, amount, reason, idempotencyKey }) {
  const r = await fetch(base(env) + '/v2/refunds', {
    method: 'POST', headers: headers(env),
    body: JSON.stringify({ idempotency_key: idempotencyKey, payment_id: paymentId, amount_money: { amount, currency: 'USD' }, reason: (reason || 'Refund').slice(0, 192) }),
  });
  const j = await r.json();
  if (!r.ok || !j.refund) throw new Error((j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || 'Square refused the refund.');
  return j.refund;
}
