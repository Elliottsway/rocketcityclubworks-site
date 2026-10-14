// Square Checkout API: creates a hosted payment page for exactly what the customer approved.
// env.SQUARE_ACCESS_TOKEN, env.SQUARE_LOCATION_ID, env.SQUARE_ENV ("production" | "sandbox")
// env.SQUARE_WEBHOOK_SIGNATURE_KEY, env.SQUARE_WEBHOOK_URL (exactly as entered in the Square dashboard)

const VERSION = '2024-10-17';
const base = (env) => env.SQUARE_API_BASE || (env.SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com');

export function squareReady(env) { return !!(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID); }

// lines: [{name, cents}] — already the final, approved amounts (tax included as its own line)
export async function createPaymentLink(env, { idempotencyKey, reference, lines, redirectUrl, email, phone }) {
  const body = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: env.SQUARE_LOCATION_ID,
      reference_id: reference,
      line_items: lines.map((l) => ({ name: l.name.slice(0, 500), quantity: '1', base_price_money: { amount: l.cents, currency: 'USD' } })),
    },
    checkout_options: { redirect_url: redirectUrl, ask_for_shipping_address: false, allow_tipping: false },
    pre_populated_data: {},
  };
  if (email) body.pre_populated_data.buyer_email = email;
  if (phone && /^\+1\d{10}$/.test(phone)) body.pre_populated_data.buyer_phone_number = phone;
  const r = await fetch(base(env) + '/v2/online-checkout/payment-links', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.SQUARE_ACCESS_TOKEN, 'Square-Version': VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || !j.payment_link) throw new Error('Square: ' + JSON.stringify(j.errors || j).slice(0, 300));
  return { url: j.payment_link.url, orderId: j.payment_link.order_id, id: j.payment_link.id };
}

// Square signs webhooks with base64(HMAC-SHA256(signatureKey, notificationUrl + rawBody)).
export async function verifyWebhook(env, rawBody, signature) {
  if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY || !env.SQUARE_WEBHOOK_URL || !signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(env.SQUARE_WEBHOOK_URL + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
