// Shared helpers for the work-ticket API (Cloudflare Pages Functions).

export const STATUSES = ['submitted', 'awaiting_approval', 'approved', 'paid', 'parts_ordered', 'in_progress', 'ready', 'completed', 'cancelled'];

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
}
export function err(message, status = 400) { return json({ error: message }, status); }
export const now = () => new Date().toISOString();

export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const clip = (s, n) => (s == null ? null : String(s).slice(0, n));
export const money = (cents) => '$' + (cents / 100).toFixed(2);
export const ticketNo = (n) => 'RC-' + n;

// Clean and total a list of priced lines. Taxable lines (parts) get sales tax at the ticket's rate.
export function priceLines(lines, taxRate) {
  const clean = (Array.isArray(lines) ? lines : []).slice(0, 80).map((l) => ({
    desc: clip(l.desc || 'Item', 160),
    qty: Math.max(1, Math.min(99, Math.round(Number(l.qty) || 1))),
    unit_cents: Math.round(Number(l.unit_cents) || 0),
    kind: ['labor', 'part', 'fee', 'discount'].includes(l.kind) ? l.kind : 'labor',
    taxable: !!l.taxable,
  }));
  let sub = 0, taxable = 0;
  for (const l of clean) { const t = l.qty * l.unit_cents; sub += t; if (l.taxable) taxable += t; }
  const tax = Math.round(Math.max(0, taxable) * (Number(taxRate) || 0));
  return { lines: clean, subtotal_cents: sub, tax_cents: tax, total_cents: Math.max(0, sub + tax) };
}

export async function getTicket(env, id) {
  return env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
}

export async function addEvent(env, ticketId, who, kind, text) {
  await env.DB.prepare('INSERT INTO events (ticket_id, at, who, kind, text) VALUES (?, ?, ?, ?, ?)').bind(ticketId, now(), who, kind, clip(text, 2000)).run();
}

export async function events(env, ticketId) {
  const r = await env.DB.prepare('SELECT at, who, kind, text FROM events WHERE ticket_id = ? ORDER BY id').bind(ticketId).all();
  return r.results || [];
}

// What the customer is allowed to see.
export function publicTicket(t, evs) {
  const p = priceLines(JSON.parse(t.lines || '[]'), t.tax_rate);
  return {
    id: t.id, number: ticketNo(t.number), status: t.status, created_at: t.created_at, updated_at: t.updated_at,
    name: t.name, spec: JSON.parse(t.spec || '{}'), customer_note: t.customer_note, shop_note: t.shop_note,
    lines: p.lines, subtotal_cents: p.subtotal_cents, tax_cents: p.tax_cents, tax_rate: t.tax_rate,
    total_cents: t.total_cents, paid_cents: t.paid_cents, due_cents: Math.max(0, t.total_cents - t.paid_cents),
    version: t.version, approved_version: t.approved_version, can_pay: t.status === 'awaiting_approval' && t.total_cents > t.paid_cents,
    events: (evs || []).filter((e) => e.kind !== 'internal').map((e) => ({ at: e.at, who: e.who, kind: e.kind, text: e.text })),
  };
}

// Email Jackson through Cloudflare Email Routing when the MAILER binding exists; never fails the request.
export async function notify(env, subject, text) {
  try {
    if (!env.MAILER || !env.NOTIFY_TO || !env.NOTIFY_FROM) return;
    const { EmailMessage } = await import('cloudflare:email');
    const raw = [
      `From: Rocket City ClubWorks <${env.NOTIFY_FROM}>`, `To: ${env.NOTIFY_TO}`, `Subject: ${subject}`,
      `Message-ID: <${newId()}@rocketcityclubworks.com>`, `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', text,
    ].join('\r\n');
    await env.MAILER.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw));
  } catch (e) { console.log('notify failed', e && e.message); }
}

export const siteUrl = (env, path) => (env.SITE_URL || 'https://rocketcityclubworks.com') + path;
