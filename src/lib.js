// Shared helpers for the service-ticket API (Cloudflare Worker + D1).

export const STATUSES = ['submitted', 'awaiting_approval', 'approved', 'paid', 'parts_ordered', 'in_progress', 'ready', 'completed', 'cancelled'];
export const LABEL = {
  submitted: 'Being reviewed', awaiting_approval: 'Ready for your approval', approved: 'Approved, waiting on payment', paid: 'Paid',
  parts_ordered: 'Parts ordered', in_progress: 'On the bench', ready: 'Ready for pickup', completed: 'Picked up', cancelled: 'Cancelled',
};
export const TRACK = ['to_order', 'ordered', 'shipped', 'received', 'installed'];

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
}
export function err(message, status = 400) { return json({ error: message }, status); }
export const now = () => new Date().toISOString();

export function newId(bytes = 16) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}

export const clip = (s, n) => (s == null ? null : String(s).slice(0, n));
export const money = (cents) => (cents < 0 ? '-$' : '$') + (Math.abs(cents) / 100).toFixed(2);
export const ticketNo = (n) => 'RC-' + n;
export const siteUrl = (env, path) => (env.SITE_URL || 'https://rocketcityclubworks.com') + path;
export const cleanEmail = (e) => String(e || '').trim().toLowerCase().slice(0, 120);
export const okEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
export function cleanPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 11 && d[0] === '1' ? d.slice(1) : d.slice(0, 15);
}
export const fmtPhone = (p) => (p && p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p || '');

export async function readJson(request) {
  // Mutating calls must be JSON: browsers cannot send that cross-site without a preflight, which blocks CSRF.
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new Error('json');
  return request.json();
}

// ---------- price lines ----------
// A line: {id, desc, qty, unit_cents, kind, taxable, part_no, track, order_id}. Parts carry order tracking.
export function cleanLines(lines, old) {
  const prev = {};
  (old || []).forEach((l) => { if (l.id) prev[l.id] = l; });
  return (Array.isArray(lines) ? lines : []).slice(0, 80).map((l) => {
    const kind = ['labor', 'part', 'fee', 'discount'].includes(l.kind) ? l.kind : 'labor';
    const id = l.id && /^[\w-]{4,24}$/.test(l.id) ? l.id : newId(6);
    const p = prev[id] || {};
    const track = kind !== 'part' ? null : TRACK.includes(l.track) ? l.track : (p.track || 'to_order');
    return {
      id, desc: clip(l.desc || 'Item', 200), qty: Math.max(1, Math.min(99, Math.round(Number(l.qty) || 1))),
      unit_cents: Math.round(Number(l.unit_cents) || 0), kind, taxable: !!l.taxable,
      part_no: kind === 'part' ? clip((l.part_no || '').toUpperCase().replace(/[^\w.-]/g, ''), 24) || null : null,
      track, order_id: kind === 'part' ? (l.order_id != null ? Number(l.order_id) || null : (p.order_id || null)) : null,
    };
  });
}
// Only these fields change the price (and so the version the customer approves).
export const priceKey = (lines) => JSON.stringify(lines.map((l) => [l.desc, l.qty, l.unit_cents, l.kind, l.taxable]));

export function totals(lines, taxRate) {
  let sub = 0, taxable = 0;
  for (const l of lines) { const t = l.qty * l.unit_cents; sub += t; if (l.taxable) taxable += t; }
  const tax = Math.round(Math.max(0, taxable) * (Number(taxRate) || 0));
  return { subtotal_cents: sub, tax_cents: tax, total_cents: Math.max(0, sub + tax) };
}

// ---------- tickets ----------
export const getTicket = (env, id) => env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
export const getCustomer = (env, id) => env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();

export async function addEvent(env, ticketId, who, kind, text) {
  await env.DB.prepare('INSERT INTO events (ticket_id, at, who, kind, text) VALUES (?, ?, ?, ?, ?)').bind(ticketId, now(), who, kind, clip(text, 2000)).run();
}
export async function events(env, ticketId) {
  const r = await env.DB.prepare('SELECT at, who, kind, text FROM events WHERE ticket_id = ? ORDER BY id').bind(ticketId).all();
  return r.results || [];
}
export async function ordersFor(env, lines) {
  const ids = [...new Set(lines.map((l) => l.order_id).filter(Boolean))];
  if (!ids.length) return {};
  const r = await env.DB.prepare(`SELECT * FROM orders WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const m = {}; (r.results || []).forEach((o) => { m[o.id] = o; }); return m;
}
export function trackingUrl(carrier, no) {
  if (!no) return null;
  const n = encodeURIComponent(no);
  if (/ups/i.test(carrier)) return 'https://www.ups.com/track?tracknum=' + n;
  if (/fedex/i.test(carrier)) return 'https://www.fedex.com/fedextrack/?trknbr=' + n;
  if (/usps/i.test(carrier)) return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + n;
  return null;
}
export const isPaid = (t) => t.total_cents > 0 && t.paid_cents >= t.total_cents;

// What the customer is allowed to see.
export async function publicTicket(env, t) {
  const lines = JSON.parse(t.lines || '[]'), sum = totals(lines, t.tax_rate), orders = await ordersFor(env, lines);
  const evs = await events(env, t.id);
  return {
    id: t.id, number: ticketNo(t.number), kind: t.kind, title: t.title, status: t.status, status_label: LABEL[t.status] || t.status,
    created_at: t.created_at, updated_at: t.updated_at, spec: JSON.parse(t.spec || '{}'), customer_note: t.customer_note,
    shop_note: t.shop_note, eta: t.eta, tax_rate: t.tax_rate, ...sum, total_cents: t.total_cents, paid_cents: t.paid_cents, refunded_cents: t.refunded_cents || 0,
    due_cents: Math.max(0, t.total_cents - t.paid_cents), version: t.version, approved_version: t.approved_version,
    can_pay: ['awaiting_approval', 'approved'].includes(t.status) && t.total_cents > t.paid_cents,
    lines: lines.map((l) => {
      const o = l.order_id && orders[l.order_id];
      return { id: l.id, desc: l.desc, qty: l.qty, unit_cents: l.unit_cents, kind: l.kind, taxable: l.taxable, track: l.track,
        shipping: o ? { carrier: o.carrier, tracking: o.tracking, url: trackingUrl(o.carrier, o.tracking), eta: o.eta, status: o.status } : null };
    }),
    events: evs.filter((e) => e.kind !== 'internal'),
  };
}

// ---------- rate limiting ----------
export async function limited(env, key, max, windowSec) {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE key = ? AND at > ?').bind(key, since).first();
  if (r && r.n >= max) return true;
  await env.DB.prepare('INSERT INTO hits (key, at) VALUES (?, ?)').bind(key, now()).run();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM hits WHERE at < ?').bind(new Date(Date.now() - 86400_000).toISOString()).run();
  return false;
}
export const ipKey = (request) => request.headers.get('CF-Connecting-IP') || 'local';

// ---------- email (Resend) ----------
// Never throws: a failed email must not fail the request.
export async function sendEmail(env, { to, subject, text, replyTo }) {
  if (!env.RESEND_API_KEY || !to) { console.log('email skipped', subject); return false; }
  try {
    const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#10231a;max-width:560px">'
      + text.split('\n').map((l) => {
        const esc = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return esc.replace(/(https:\/\/[^\s]+)/g, '<a href="$1" style="color:#0f5132">$1</a>') || '&nbsp;';
      }).join('<br>')
      + '<br><br><span style="color:#5b6b62;font-size:13px">Rocket City ClubWorks · Huntsville, AL · rocketcityclubworks.com</span></div>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'Rocket City ClubWorks <shop@rocketcityclubworks.com>', to: [to], subject, text, html,
        reply_to: replyTo || env.NOTIFY_TO || 'jackson@rocketcityclubworks.com' }),
    });
    if (!r.ok) console.log('email failed', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) { console.log('email error', e && e.message); return false; }
}
// Alert Jackson.
export const notifyShop = (env, subject, text) => sendEmail(env, { to: env.NOTIFY_TO || 'jackson@rocketcityclubworks.com', subject, text });
// Tell the customer something about their ticket.
export async function notifyCustomer(env, t, subject, body) {
  const c = await getCustomer(env, t.customer_id);
  if (!c || !c.email) return;
  await sendEmail(env, { to: c.email, subject: `${ticketNo(t.number)}: ${subject}`,
    text: `Hi ${c.name.split(' ')[0]},\n\n${body}\n\nSee your ticket: ${siteUrl(env, '/ticket/?t=' + t.id)}\n\nQuestions? Reply to this email or message Jackson on your ticket.\n\nJackson\nRocket City ClubWorks` });
}
