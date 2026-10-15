// Jackson's dashboard API: tickets, parts orders, customers.
import { ticketPayments, refundPayment } from './square.js';
import { json, err, now, newId, clip, cleanEmail, okEmail, cleanPhone, fmtPhone, readJson, cleanLines, priceKey, totals, getTicket, getCustomer,
  addEvent, events, publicTicket, fillCosts, ordersFor, trackingUrl, isPaid, notifyCustomer, sendEmail, siteUrl, ticketNo, money, STATUSES, LABEL, TRACK } from './lib.js';

const custOut = (c) => c && { id: c.id, name: c.name, email: c.email, phone: c.phone, phone_fmt: fmtPhone(c.phone), created_at: c.created_at, last_login_at: c.last_login_at, created_by: c.created_by, shop_notes: c.shop_notes, credit_cents: c.credit_cents || 0 };

async function fullTicket(env, t) {
  const c = await getCustomer(env, t.customer_id);
  const lines = JSON.parse(t.lines || '[]'), orders = await ordersFor(env, lines);
  const pub = await publicTicket(env, t);
  return { ...pub, paid: isPaid(t), customer: custOut(c), all_events: await events(env, t.id), square_order_id: t.square_order_id,
    lines: lines.map((l) => ({ ...l, order: l.order_id && orders[l.order_id] ? orders[l.order_id] : null })) };
}

// GET /api/admin/tickets?status=open|all|<status>&q=
export async function listTickets(request, env) {
  const u = new URL(request.url), s = u.searchParams.get('status') || 'open', q = (u.searchParams.get('q') || '').trim().toLowerCase();
  let where = '1=1'; const args = [];
  if (s === 'open') where = "t.status NOT IN ('completed','cancelled')";
  else if (STATUSES.includes(s)) { where = 't.status = ?'; args.push(s); }
  else if (s === 'waiting') where = "t.status IN ('awaiting_approval','approved')";
  if (q) {
    const n = Number(q.replace(/^rc-?/i, ''));
    where += ' AND (LOWER(c.name) LIKE ? OR c.email LIKE ? OR c.phone LIKE ?' + (n ? ' OR t.number = ?' : '') + ')';
    args.push('%' + q + '%', '%' + q + '%', '%' + q.replace(/\D/g, '') + '%'); if (n) args.push(n);
  }
  const r = await env.DB.prepare(`SELECT t.id, t.number, t.kind, t.title, t.status, t.created_at, t.updated_at, t.total_cents, t.paid_cents, t.eta, c.name, c.phone
      FROM tickets t LEFT JOIN customers c ON c.id = t.customer_id WHERE ${where} ORDER BY t.updated_at DESC LIMIT 300`).bind(...args).all();
  const counts = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all();
  return json({
    tickets: (r.results || []).map((t) => ({ ...t, number: ticketNo(t.number), status_label: LABEL[t.status], paid: t.total_cents > 0 && t.paid_cents >= t.total_cents })),
    counts: Object.fromEntries((counts.results || []).map((x) => [x.status, x.n])),
  });
}

// GET /api/admin/tickets/:id
export async function getTicketAdmin(request, env, id) {
  const t = await getTicket(env, id);
  if (!t) return err('Ticket not found.', 404);
  return json(await fullTicket(env, t));
}

// PUT /api/admin/tickets/:id {version, lines?, tax_rate?, shop_note?, eta?, title?, send_for_approval?, status?, message?, internal?}
export async function updateTicket(request, env, id, ctx) {
  const t = await getTicket(env, id);
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  if (b.version != null && Number(b.version) !== t.version) return err('This ticket changed while you were editing. Reload it first.', 409);

  let { status, version, total_cents } = t;
  const oldLines = JSON.parse(t.lines || '[]');
  let lines = oldLines, taxRate = t.tax_rate;
  const changes = [], mail = [];
  if (b.lines || b.tax_rate != null) {
    taxRate = b.tax_rate != null ? Math.max(0, Math.min(0.2, Number(b.tax_rate) || 0)) : taxRate;
    lines = b.lines ? await fillCosts(env, cleanLines(b.lines, oldLines, true)) : oldLines;
    if (priceKey(lines) !== priceKey(oldLines) || taxRate !== t.tax_rate) {
      total_cents = totals(lines, taxRate).total_cents; version += 1;
      changes.push(`Price updated to ${money(total_cents)}.`);
      if (status === 'approved') status = 'awaiting_approval'; // price changed after approval: approve again
      if (['paid', 'parts_ordered', 'in_progress', 'ready'].includes(status) && total_cents > t.paid_cents) status = 'awaiting_approval';
    }
    // parts that changed tracking by hand
    const before = Object.fromEntries(oldLines.map((l) => [l.id, l.track]));
    lines.forEach((l) => { if (l.kind === 'part' && before[l.id] && before[l.id] !== l.track) changes.push(`${l.desc}: ${l.track.replace('_', ' ')}.`); });
  }
  const shopNote = b.shop_note != null ? clip(b.shop_note, 3000) : t.shop_note;
  if (b.shop_note != null && shopNote !== t.shop_note) changes.push('Note from Jackson updated.');
  const eta = b.eta !== undefined ? (b.eta && /^\d{4}-\d{2}-\d{2}$/.test(b.eta) ? b.eta : null) : t.eta;
  if (eta !== t.eta) changes.push(eta ? `Estimated ready: ${eta}.` : 'Ready date cleared.');
  const title = b.title != null ? clip(b.title, 120) : t.title;
  const pickup = b.pickup_at !== undefined ? clip((b.pickup_at || '').trim(), 80) || null : t.pickup_at;
  if (pickup !== t.pickup_at) changes.push(pickup ? `Pickup scheduled: ${pickup}.` : 'Pickup time cleared.');

  if (b.send_for_approval) {
    if (total_cents - t.paid_cents <= 0) return err('Nothing is due, so there is nothing to approve.');
    status = 'awaiting_approval';
    mail.push(['your price is ready to approve', `Jackson reviewed your ticket. Total due: ${money(total_cents - t.paid_cents)}.\n\nOpen your ticket to see every part and service, then tap "Approve & pay" to pay securely with Square. Parts are ordered as soon as your payment clears.`]);
  } else if (b.status && b.status !== status) {
    if (!STATUSES.includes(b.status)) return err('Unknown status.');
    status = b.status;
    if (status === 'ready') mail.push(['ready for pickup', 'Your clubs are ready! Open your ticket and tap "Schedule pickup" to pick a time, or reply to this email.']);
    if (status === 'in_progress') mail.push(['on the bench', 'Your parts are in and Jackson is working on your clubs now.']);
  }

  await env.DB.prepare('UPDATE tickets SET status = ?, version = ?, lines = ?, tax_rate = ?, total_cents = ?, shop_note = ?, eta = ?, title = ?, pickup_at = ?, updated_at = ? WHERE id = ?')
    .bind(status, version, JSON.stringify(lines), taxRate, total_cents, shopNote, eta, title, pickup, now(), t.id).run();
  if (changes.length) await addEvent(env, t.id, 'shop', 'priced', changes.join(' '));
  if (status !== t.status) await addEvent(env, t.id, 'shop', 'status', LABEL[status] || status);
  const msg = clip((b.message || '').trim(), 1500);
  if (msg) {
    await addEvent(env, t.id, 'shop', b.internal ? 'internal' : 'message', msg);
    if (!b.internal) mail.push(['message from Jackson', msg]);
  }
  if (mail.length && !b.quiet) {
    const fresh = { ...t, status };
    ctx.waitUntil(Promise.all(mail.map((m) => notifyCustomer(env, fresh, m[0], m[1]))));
  }
  return json(await fullTicket(env, await getTicket(env, t.id)));
}

// POST /api/admin/tickets {customer_id, title, note}  → a ticket Jackson opens himself (walk-ins, phone calls)
export async function createTicketAdmin(request, env) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const c = await getCustomer(env, String(b.customer_id || ''));
  if (!c) return err('Pick a customer first.');
  const id = newId(), t = now();
  const last = await env.DB.prepare('SELECT MAX(number) AS n FROM tickets').first();
  const number = (last && last.n ? last.n : 1000) + 1;
  await env.DB.prepare(`INSERT INTO tickets (id, number, customer_id, kind, title, status, created_at, updated_at, customer_note, spec, lines, tax_rate, total_cents)
      VALUES (?, ?, ?, 'shop', ?, 'submitted', ?, ?, ?, ?, '[]', ?, 0)`)
    .bind(id, number, c.id, clip(b.title || 'Service ticket', 120), t, t, clip(b.note, 2000), JSON.stringify({ summary: b.note ? [clip(b.note, 2000)] : [] }), Number(env.TAX_RATE || 0)).run();
  await addEvent(env, id, 'shop', 'submitted', 'Ticket opened by Jackson.');
  return json({ id, number: ticketNo(number) }, 201);
}

// ---------- parts orders ----------
// GET /api/admin/orders → parts waiting to be ordered (paid tickets only), parts on unpaid tickets, and recent orders
export async function listOrders(request, env) {
  const r = await env.DB.prepare(`SELECT t.id, t.number, t.status, t.lines, t.total_cents, t.paid_cents, c.name FROM tickets t LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.status NOT IN ('completed','cancelled','submitted') ORDER BY t.updated_at`).all();
  const toOrder = [], unpaid = [];
  for (const t of r.results || []) {
    const paid = t.total_cents > 0 && t.paid_cents >= t.total_cents;
    for (const l of JSON.parse(t.lines || '[]')) {
      if (l.kind !== 'part' || l.track !== 'to_order') continue;
      const row = { ticket_id: t.id, number: ticketNo(t.number), customer: t.name, line_id: l.id, desc: l.desc, qty: l.qty, part_no: l.part_no };
      (paid ? toOrder : unpaid).push(row);
    }
  }
  const o = await env.DB.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 60').all();
  const orders = o.results || [];
  // which tickets/lines each order covers
  const cover = {};
  for (const t of (await env.DB.prepare("SELECT id, number, lines FROM tickets WHERE lines LIKE '%order_id\":%'").all()).results || []) {
    for (const l of JSON.parse(t.lines || '[]')) if (l.order_id) (cover[l.order_id] = cover[l.order_id] || []).push({ ticket_id: t.id, number: ticketNo(t.number), desc: l.desc, qty: l.qty, part_no: l.part_no, track: l.track });
  }
  return json({ to_order: toOrder, unpaid, orders: orders.map((x) => ({ ...x, url: trackingUrl(x.carrier, x.tracking), items: cover[x.id] || [] })) });
}

// Update lines across tickets for an order; returns the tickets touched.
async function setLines(env, pick, track, orderId) {
  const touched = [];
  const r = await env.DB.prepare("SELECT * FROM tickets WHERE status NOT IN ('completed','cancelled')").all();
  for (const t of r.results || []) {
    const lines = JSON.parse(t.lines || '[]'); let hit = false;
    for (const l of lines) if (l.kind === 'part' && pick(t, l)) { l.track = track; if (orderId !== undefined) l.order_id = orderId; hit = true; }
    if (!hit) continue;
    let status = t.status;
    const parts = lines.filter((l) => l.kind === 'part');
    if (track === 'ordered' && isPaid(t) && status === 'paid' && parts.every((l) => l.track !== 'to_order')) status = 'parts_ordered';
    await env.DB.prepare('UPDATE tickets SET lines = ?, status = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(lines), status, now(), t.id).run();
    if (status !== t.status) await addEvent(env, t.id, 'shop', 'status', LABEL[status]);
    touched.push({ ...t, status });
  }
  return touched;
}

// POST /api/admin/orders {order_no, eta?, note?, items: [{ticket_id, line_id}]}  → record a GolfWorks order
export async function createOrder(request, env) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200);
  if (!items.length) return err('Pick the parts on this order.');
  const t = now();
  const ship = b.shipping_cents === '' || b.shipping_cents == null ? null : Math.max(0, Math.round(Number(b.shipping_cents) || 0));
  const ins = await env.DB.prepare("INSERT INTO orders (vendor, order_no, status, eta, note, shipping_cents, placed_at, updated_at) VALUES (?, ?, 'placed', ?, ?, ?, ?, ?)")
    .bind(clip(b.vendor || 'GolfWorks', 40), clip(b.order_no, 60), b.eta && /^\d{4}-\d{2}-\d{2}$/.test(b.eta) ? b.eta : null, clip(b.note, 500), ship, t, t).run();
  const orderId = ins.meta.last_row_id;
  const want = new Set(items.map((i) => i.ticket_id + '|' + i.line_id));
  const touched = await setLines(env, (tk, l) => want.has(tk.id + '|' + l.id), 'ordered', orderId);
  for (const tk of touched) await addEvent(env, tk.id, 'shop', 'parts', `Parts ordered from ${b.vendor || 'GolfWorks'}${b.order_no ? ' (order ' + clip(b.order_no, 60) + ')' : ''}.`);
  return json({ id: orderId, tickets: touched.length }, 201);
}

// PUT /api/admin/orders/:id {order_no?, carrier?, tracking?, eta?, status?, note?}
export async function updateOrder(request, env, id, ctx) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(Number(id)).first();
  if (!o) return err('Order not found.', 404);
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const v = {
    order_no: b.order_no !== undefined ? clip(b.order_no, 60) : o.order_no,
    carrier: b.carrier !== undefined ? clip(b.carrier, 20) : o.carrier,
    tracking: b.tracking !== undefined ? clip((b.tracking || '').replace(/\s/g, ''), 60) : o.tracking,
    eta: b.eta !== undefined ? (b.eta && /^\d{4}-\d{2}-\d{2}$/.test(b.eta) ? b.eta : null) : o.eta,
    note: b.note !== undefined ? clip(b.note, 500) : o.note,
    shipping_cents: b.shipping_cents !== undefined ? (b.shipping_cents === '' || b.shipping_cents == null ? null : Math.max(0, Math.round(Number(b.shipping_cents) || 0))) : o.shipping_cents,
    status: ['placed', 'shipped', 'delivered'].includes(b.status) ? b.status : o.status,
  };
  if (v.tracking && v.status === 'placed') v.status = 'shipped';
  await env.DB.prepare('UPDATE orders SET order_no = ?, carrier = ?, tracking = ?, eta = ?, note = ?, shipping_cents = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(v.order_no, v.carrier, v.tracking, v.eta, v.note, v.shipping_cents, v.status, now(), o.id).run();
  await applyOrderStatus(env, o, v, ctx);
  return json({ ok: true });
}

// After an order's status changes: move its parts along and tell each customer. Also used by FedEx auto-tracking.
export async function applyOrderStatus(env, o, v, ctx) {
  if (v.status === o.status || v.status === 'placed') return;
  const track = v.status === 'shipped' ? 'shipped' : 'received';
  const touched = await setLines(env, (tk, l) => l.order_id === o.id && TRACK.indexOf(l.track) < TRACK.indexOf(track), track);
  const url = trackingUrl(v.carrier, v.tracking);
  for (const tk of touched) {
    await addEvent(env, tk.id, 'system', 'parts', v.status === 'shipped' ? `Parts shipped${v.carrier ? ' via ' + v.carrier : ''}${v.tracking ? ' (tracking ' + v.tracking + ')' : ''}.` : 'Parts arrived at the shop.');
    if (v.status === 'shipped') ctx.waitUntil(notifyCustomer(env, tk, 'your parts shipped', `Your parts are on the way to the shop${v.carrier ? ' via ' + v.carrier : ''}.${url ? '\nTrack them: ' + url : ''}${v.eta ? '\nExpected: ' + v.eta : ''}`));
    if (v.status === 'delivered') ctx.waitUntil(notifyCustomer(env, tk, 'your parts arrived', 'Your parts arrived at the shop. Jackson will get your clubs on the bench next.'));
  }
}

// ---------- customers ----------
// GET /api/admin/customers?q=
export async function listCustomers(request, env) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase();
  const args = []; let where = '1=1';
  if (q) { where = '(LOWER(c.name) LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)'; args.push('%' + q + '%', '%' + q + '%', '%' + (q.replace(/\D/g, '') || q) + '%'); }
  const r = await env.DB.prepare(`SELECT c.*, COUNT(t.id) AS tickets, COALESCE(SUM(t.paid_cents),0) AS spent_cents, MAX(t.updated_at) AS last_ticket
      FROM customers c LEFT JOIN tickets t ON t.customer_id = c.id WHERE ${where} GROUP BY c.id ORDER BY COALESCE(MAX(t.updated_at), c.created_at) DESC LIMIT 500`).bind(...args).all();
  return json({ customers: (r.results || []).map((c) => ({ ...custOut(c), tickets: c.tickets, spent_cents: c.spent_cents, last_ticket: c.last_ticket })) });
}
// GET /api/admin/customers/:id
export async function getCustomerAdmin(request, env, id) {
  const c = await getCustomer(env, id);
  if (!c) return err('Customer not found.', 404);
  const r = await env.DB.prepare('SELECT id, number, kind, title, status, created_at, updated_at, total_cents, paid_cents, lines FROM tickets WHERE customer_id = ? ORDER BY created_at DESC').bind(c.id).all();
  const tickets = (r.results || []).map((t) => ({ id: t.id, number: ticketNo(t.number), title: t.title, status: t.status, status_label: LABEL[t.status], created_at: t.created_at,
    total_cents: t.total_cents, paid_cents: t.paid_cents, work: JSON.parse(t.lines || '[]').filter((l) => l.unit_cents >= 0).map((l) => (l.qty > 1 ? l.qty + ' × ' : '') + l.desc) }));
  return json({ customer: custOut(c), tickets, spent_cents: tickets.reduce((s, t) => s + t.paid_cents, 0) });
}
// POST /api/admin/customers {name, email, phone, shop_notes}
export async function createCustomer(request, env) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const email = cleanEmail(b.email), name = clip((b.name || '').trim(), 80), phone = cleanPhone(b.phone);
  if (!name) return err('Name is required.');
  if (!okEmail(email)) return err('An email is required (it is how they sign in and get updates).');
  if (await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first()) return err('A customer with that email already exists.', 409);
  const id = newId(12);
  await env.DB.prepare("INSERT INTO customers (id, email, name, phone, created_at, created_by, shop_notes) VALUES (?, ?, ?, ?, ?, 'shop', ?)")
    .bind(id, email, name, phone || null, now(), clip(b.shop_notes, 3000)).run();
  return json({ id }, 201);
}
// PUT /api/admin/customers/:id {name?, email?, phone?, shop_notes?}
export async function updateCustomer(request, env, id) {
  const c = await getCustomer(env, id);
  if (!c) return err('Customer not found.', 404);
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const email = b.email !== undefined ? cleanEmail(b.email) : c.email;
  if (!okEmail(email)) return err('That email does not look right.');
  if (email !== c.email && await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first()) return err('Another customer already uses that email.', 409);
  await env.DB.prepare('UPDATE customers SET name = ?, email = ?, phone = ?, shop_notes = ? WHERE id = ?')
    .bind(b.name !== undefined ? clip(b.name, 80) : c.name, email, b.phone !== undefined ? cleanPhone(b.phone) : c.phone, b.shop_notes !== undefined ? clip(b.shop_notes, 3000) : c.shop_notes, c.id).run();
  return json({ ok: true });
}
// POST /api/admin/customers/:id/invite → email them a sign-in link to the account page
export async function inviteCustomer(request, env, id) {
  const c = await getCustomer(env, id);
  if (!c) return err('Customer not found.', 404);
  const ok = await sendEmail(env, { to: c.email, subject: 'Your Rocket City ClubWorks account',
    text: `Hi ${c.name.split(' ')[0]},\n\nJackson set up an account for you so you can track your clubs, approve prices and pay online.\n\nSign in with this email (we'll send you a code, no password needed):\n${siteUrl(env, '/account/')}\n\nJackson\nRocket City ClubWorks` });
  return ok ? json({ ok: true }) : err('The email did not send.', 502);
}

// ---------- payments & refunds ----------
// GET /api/admin/tickets/:id/payments
export async function ticketPaymentsAdmin(request, env, id) {
  const t = await getTicket(env, id);
  if (!t) return err('Ticket not found.', 404);
  return json(await ticketPayments(env, t));
}
// POST /api/admin/tickets/:id/refund {payment_id, amount_cents, reason, key}
export async function refundTicket(request, env, id, ctx) {
  const t = await getTicket(env, id);
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const pay = await env.DB.prepare('SELECT * FROM payments WHERE square_payment_id = ? AND ticket_id = ?').bind(String(b.payment_id || ''), t.id).first();
  if (!pay) return err('That payment is not on this ticket.', 404);
  const live = await ticketPayments(env, t);
  const p = live.payments.find((x) => x.id === pay.square_payment_id);
  const amount = Math.round(Number(b.amount_cents) || 0);
  if (amount <= 0) return err('Enter a refund amount.');
  if (amount > p.refundable_cents) return err(`At most ${money(p.refundable_cents)} can be refunded on this payment.`);
  let r;
  try {
    r = await refundPayment(env, { paymentId: pay.square_payment_id, amount, reason: clip(b.reason, 190) || `Refund for ${ticketNo(t.number)}`,
      idempotencyKey: clip(b.key, 40) || `${pay.square_payment_id}-r-${amount}-${p.refunded_cents}` });
  } catch (e) { return err('Square: ' + e.message, 502); }
  await env.DB.prepare('INSERT OR IGNORE INTO refunds (square_refund_id, ticket_id, square_payment_id, amount_cents, reason, status, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(r.id, t.id, pay.square_payment_id, amount, clip(b.reason, 190), r.status, now()).run();
  await env.DB.prepare('UPDATE payments SET refunded_cents = refunded_cents + ? WHERE square_payment_id = ?').bind(amount, pay.square_payment_id).run();
  await env.DB.prepare('UPDATE tickets SET refunded_cents = refunded_cents + ?, updated_at = ? WHERE id = ?').bind(amount, now(), t.id).run();
  await addEvent(env, t.id, 'shop', 'paid', `Refund of ${money(amount)} issued to ${p.card || 'the card used'}.${b.reason ? ' ' + clip(b.reason, 190) : ''}`);
  ctx.waitUntil(notifyCustomer(env, t, 'refund issued', `Jackson issued a refund of ${money(amount)} to ${p.card || 'your card'}. It usually shows up in 2 to 7 business days.${b.reason ? '\n\nNote: ' + clip(b.reason, 190) : ''}`));
  return json(await ticketPayments(env, await getTicket(env, t.id)));
}
// GET /api/admin/customers/:id/payments
export async function customerPayments(request, env, id) {
  const r = await env.DB.prepare(`SELECT p.square_payment_id AS id, p.amount_cents, p.refunded_cents, p.at, p.card, p.receipt_url, p.receipt_number, t.id AS ticket_id, t.number
      FROM payments p JOIN tickets t ON t.id = p.ticket_id WHERE t.customer_id = ? ORDER BY p.at DESC`).bind(id).all();
  return json({ payments: (r.results || []).map((x) => ({ ...x, number: ticketNo(x.number) })) });
}
