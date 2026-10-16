// Photos, hand-recorded payments, customer credit, part costs, reports and the hourly automatic jobs
// (approval/payment and pickup reminders, thank-you + review emails, FedEx tracking).
import { json, err, now, newId, clip, readJson, getTicket, getCustomer, addEvent, totals, limited, notifyShop, notifyCustomer,
  siteUrl, ticketNo, money, LABEL, DEPOSIT, depositState, nextSteps } from './lib.js';

const HOUR = 3600_000;
const MAX_PHOTO = 1_600_000; // bytes, after the browser shrinks it

// ---------- photos ----------
function sniff(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return null;
}
// POST /api/tickets/:id/photos and /api/admin/tickets/:id/photos  (body: the image itself)
export async function uploadPhoto(request, env, t, who) {
  if (!/^image\//.test(request.headers.get('content-type') || '')) return err('Send an image.');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_PHOTO) return err('That photo is too large. Try a smaller one.', 413);
  const mime = sniff(buf);
  if (!mime) return err('Photos must be JPEG, PNG or WebP.');
  if (await limited(env, 'photo:' + t.id + ':' + who, 30, 3600)) return err('Too many photos at once. Try again in a bit.', 429);
  const id = newId(12);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO photos (id, ticket_id, who, at, mime, size) VALUES (?, ?, ?, ?, ?, ?)').bind(id, t.id, who, now(), mime, buf.byteLength),
    env.DB.prepare('INSERT INTO photo_data (id, data) VALUES (?, ?)').bind(id, buf),
  ]);
  await addEvent(env, t.id, who, 'photo', id);
  await env.DB.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').bind(now(), t.id).run();
  return json({ id }, 201);
}
// GET /api/photos/:id  (the caller has already been checked for access to the photo's ticket)
export async function servePhoto(env, photo) {
  const d = await env.DB.prepare('SELECT data FROM photo_data WHERE id = ?').bind(photo.id).first();
  if (!d) return err('Not found.', 404);
  const bytes = d.data instanceof ArrayBuffer ? d.data : new Uint8Array(d.data); // D1 hands BLOBs back as an array of numbers
  return new Response(bytes, { headers: { 'content-type': photo.mime, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
}
export const getPhoto = (env, id) => env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(String(id)).first();

// ---------- pickup (customer) ----------
// POST /api/tickets/:id/pickup {when}
export async function schedulePickup(request, env, c, t, ctx) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const when = clip((b.when || '').trim(), 80);
  if (!when) return err('Pick a day and time.');
  if (!['ready', 'in_progress'].includes(t.status)) return err('Pickup can be scheduled once your clubs are ready.', 409);
  await env.DB.prepare('UPDATE tickets SET pickup_at = ?, updated_at = ? WHERE id = ?').bind(when, now(), t.id).run();
  await addEvent(env, t.id, 'customer', 'message', `Pickup requested: ${when}`);
  ctx.waitUntil(notifyShop(env, `${ticketNo(t.number)} pickup: ${when}`, `${c.name} wants to pick up ${when}.\n\n${siteUrl(env, '/admin/?t=' + t.id)}`));
  return json({ ok: true });
}

// ---------- drop-off (customer) ----------
// POST /api/tickets/:id/dropoff {when}
export async function scheduleDropoff(request, env, c, t, ctx) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const when = clip((b.when || '').trim(), 80);
  if (!when) return err('Pick a day and time.');
  if (t.clubs_in_at) return err('Jackson already has your clubs.', 409);
  if (!(t.paid_cents > 0) || !['approved', 'paid', 'parts_ordered'].includes(t.status)) return err('Drop-off can be scheduled once your price is approved and paid.', 409);
  await env.DB.prepare('UPDATE tickets SET dropoff_at = ?, updated_at = ? WHERE id = ?').bind(when, now(), t.id).run();
  await addEvent(env, t.id, 'customer', 'message', `Drop-off planned: ${when}`);
  ctx.waitUntil(notifyShop(env, `${ticketNo(t.number)} drop-off: ${when}`, `${c.name} plans to drop off ${when}.\n\n${siteUrl(env, '/admin/?t=' + t.id)}`));
  return json({ ok: true });
}

// ---------- payments recorded by hand (cash, Venmo...) ----------
const METHODS = ['cash', 'venmo', 'cash app', 'apple cash', 'zelle', 'check', 'card in person', 'other'];
// POST /api/admin/tickets/:id/manual-payment {amount_cents, method, note}
export async function manualPayment(request, env, id, ctx) {
  const t = await getTicket(env, id);
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const amount = Math.round(Number(b.amount_cents) || 0), method = METHODS.includes(b.method) ? b.method : 'other';
  if (amount <= 0) return err('Enter the amount received.');
  const pid = 'manual-' + newId(9);
  await env.DB.prepare('INSERT INTO payments (square_payment_id, ticket_id, amount_cents, at, method, note) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(pid, t.id, amount, now(), method, clip(b.note, 200)).run();
  const paid = t.paid_cents + amount, full = paid >= t.total_cents && t.total_cents > 0;
  if (depositState(t) === 'requested') { // a sourcing deposit paid in person starts the 48-hour clock, like one paid online
    await env.DB.prepare('UPDATE tickets SET paid_cents = ?, deposit_paid_at = ?, deposit_due_by = ?, updated_at = ? WHERE id = ?')
      .bind(paid, now(), new Date(Date.now() + DEPOSIT.hours * HOUR).toISOString(), now(), t.id).run();
    await addEvent(env, t.id, 'shop', 'paid', `Sourcing deposit received: ${money(amount)} (${method}). It counts toward the build.`);
    ctx.waitUntil(notifyCustomer(env, t, 'sourcing deposit received', `Thanks! Jackson recorded your ${method} sourcing deposit of ${money(amount)} and is now searching for your head. You'll hear back within ${DEPOSIT.hours} hours. It counts toward your build, and it's refunded in full if no genuine head is found at the quoted price.`));
    return json({ ok: true });
  }
  const status = full && ['submitted', 'awaiting_approval', 'approved'].includes(t.status) ? 'paid' : t.status;
  await env.DB.prepare('UPDATE tickets SET paid_cents = ?, status = ?, updated_at = ? WHERE id = ?').bind(paid, status, now(), t.id).run();
  await addEvent(env, t.id, 'shop', 'paid', `Payment received: ${money(amount)} (${method}).`);
  ctx.waitUntil(notifyCustomer(env, t, 'payment received', `Thanks! Jackson recorded your ${method} payment of ${money(amount)}.${full ? '\n\n' + nextSteps(env, t) : ''}`));
  return json({ ok: true });
}
// POST /api/admin/tickets/:id/manual-payment/:pid/delete  (undo a mistake)
export async function deleteManualPayment(request, env, id, pid) {
  const t = await getTicket(env, id);
  const p = await env.DB.prepare("SELECT * FROM payments WHERE square_payment_id = ? AND ticket_id = ? AND method <> 'square'").bind(String(pid), String(id)).first();
  if (!t || !p) return err('Payment not found.', 404);
  await env.DB.prepare('DELETE FROM payments WHERE square_payment_id = ?').bind(p.square_payment_id).run();
  await env.DB.prepare('UPDATE tickets SET paid_cents = MAX(0, paid_cents - ?), updated_at = ? WHERE id = ?').bind(p.amount_cents, now(), t.id).run();
  await addEvent(env, t.id, 'shop', 'internal', `Removed recorded ${p.method} payment of ${money(p.amount_cents)}.`);
  return json({ ok: true });
}

// ---------- thank-you credit ----------
// POST /api/admin/tickets/:id/apply-credit  → adds the customer's credit as a discount line and uses it up
export async function applyCredit(request, env, id) {
  const t = await getTicket(env, id);
  if (!t) return err('Ticket not found.', 404);
  const c = await getCustomer(env, t.customer_id);
  const due = t.total_cents - t.paid_cents, use = Math.min(c.credit_cents || 0, Math.max(0, due));
  if (use <= 0) return err(c.credit_cents ? 'Price the ticket first: the credit comes off what is due.' : 'This customer has no credit.');
  const lines = JSON.parse(t.lines || '[]');
  lines.push({ id: newId(6), desc: 'Thank-you credit', qty: 1, unit_cents: -use, kind: 'discount', taxable: false, part_no: null, track: null, order_id: null, cost_cents: null });
  const total = totals(lines, t.tax_rate).total_cents;
  await env.DB.batch([
    env.DB.prepare("UPDATE tickets SET lines = ?, total_cents = ?, version = version + 1, status = CASE WHEN status = 'approved' THEN 'awaiting_approval' ELSE status END, updated_at = ? WHERE id = ?").bind(JSON.stringify(lines), total, now(), t.id),
    env.DB.prepare('UPDATE customers SET credit_cents = credit_cents - ? WHERE id = ?').bind(use, c.id),
  ]);
  await addEvent(env, t.id, 'shop', 'priced', `Thank-you credit applied: ${money(-use)}.`);
  return json({ ok: true });
}
// PUT /api/admin/customers/:id/credit {credit_cents}
export async function setCredit(request, env, id) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const v = Math.max(0, Math.min(100000, Math.round(Number(b.credit_cents) || 0)));
  await env.DB.prepare('UPDATE customers SET credit_cents = ? WHERE id = ?').bind(v, String(id)).run();
  return json({ ok: true });
}

// ---------- private part costs ----------
// GET /api/admin/costs?part_no=VT,DGI  → {VT: {ratio, cost_cents, retail_cents}}
export async function partCosts(request, env) {
  const ids = (new URL(request.url).searchParams.get('part_no') || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean).slice(0, 50);
  if (!ids.length) return json({});
  const r = await env.DB.prepare(`SELECT * FROM part_costs WHERE part_no IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  return json(Object.fromEntries((r.results || []).map((x) => [x.part_no, { ratio: x.ratio, cost_cents: x.cost_cents, retail_cents: x.retail_cents }])));
}

// ---------- reports ----------
const baseDesc = (d) => String(d || '').replace(/\s*\((?:[^()]*)\)\s*$/, '').replace(/\s+for\s+.+$/, '').trim();
// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD   (dates are when the first payment came in)
export async function reports(request, env) {
  const u = new URL(request.url);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('from') || '') ? u.searchParams.get('from') : '2000-01-01';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('to') || '') ? u.searchParams.get('to') : '2999-12-31';
  const toEnd = to + 'T23:59:59.999Z';
  const tk = (await env.DB.prepare(`SELECT t.*, (SELECT MIN(at) FROM payments p WHERE p.ticket_id = t.id) AS paid_at FROM tickets t WHERE t.paid_cents > 0`).all()).results || [];
  const inRange = tk.filter((t) => t.paid_at >= from && t.paid_at <= toEnd);
  const items = {}, months = {};
  let revenue = 0, refunds = 0, partsCost = 0, missingCost = 0, discounts = 0;
  for (const t of tk) {
    const m = t.paid_at.slice(0, 7), lines = JSON.parse(t.lines || '[]');
    const cost = lines.reduce((s, l) => s + (l.cost_cents || 0) * l.qty, 0);
    const mo = months[m] = months[m] || { month: m, revenue_cents: 0, cost_cents: 0, tickets: 0 };
    mo.revenue_cents += t.paid_cents - (t.refunded_cents || 0) - Math.min(t.paid_cents, totals(lines, t.tax_rate).tax_cents); mo.cost_cents += cost; mo.tickets += 1;
  }
  for (const t of inRange) {
    const lines = JSON.parse(t.lines || '[]');
    revenue += t.paid_cents - Math.min(t.paid_cents, totals(lines, t.tax_rate).tax_cents); refunds += t.refunded_cents || 0; // sales tax isn't income
    for (const l of lines) {
      const amt = l.qty * l.unit_cents;
      if (l.kind === 'discount') { discounts += -amt; continue; }
      const key = l.part_no || (l.kind + ':' + baseDesc(l.desc).toLowerCase());
      const it = items[key] = items[key] || { key, part_no: l.part_no || null, kind: l.kind, name: baseDesc(l.desc), qty: 0, revenue_cents: 0, cost_cents: 0, cost_known: true, tickets: 0 };
      it.qty += l.qty; it.revenue_cents += amt; it.tickets += 1;
      if (l.cost_cents != null) it.cost_cents += l.cost_cents * l.qty;
      else if (l.kind === 'part') { it.cost_known = false; missingCost += amt; }
      partsCost += (l.cost_cents || 0) * l.qty;
    }
  }
  const ids = inRange.map((t) => t.id);
  const ph = ids.map(() => '?').join(',');
  const fees = ids.length ? (await env.DB.prepare(`SELECT COALESCE(SUM(fee_cents),0) AS f FROM payments WHERE ticket_id IN (${ph})`).bind(...ids).first()).f : 0;
  const ship = (await env.DB.prepare('SELECT COALESCE(SUM(shipping_cents),0) AS s FROM orders WHERE placed_at >= ? AND placed_at <= ?').bind(from, toEnd).first()).s;
  const custs = (await env.DB.prepare('SELECT COUNT(*) AS n FROM customers WHERE created_at >= ? AND created_at <= ?').bind(from, toEnd).first()).n;
  const net = revenue - refunds;
  return json({
    from, to,
    summary: { revenue_cents: revenue, refunds_cents: refunds, net_cents: net, discounts_cents: discounts, parts_cost_cents: partsCost, square_fees_cents: fees, shipping_cents: ship,
      gross_profit_cents: net - partsCost - fees - ship, tickets: inRange.length, avg_ticket_cents: inRange.length ? Math.round(net / inRange.length) : 0,
      new_customers: custs, revenue_missing_cost_cents: missingCost,
      completed: inRange.filter((t) => t.status === 'completed').length },
    items: Object.values(items),
    months: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
  });
}

// ---------- hourly automatic jobs ----------
function centralHour() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
}
async function sentSince(env, ticketId, kind, since) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(sent_at) AS last FROM reminders WHERE ticket_id = ? AND kind = ? AND sent_at >= ?').bind(ticketId, kind, since).first();
  return { n: r.n || 0, last: r.last };
}
const logSent = (env, id, kind) => env.DB.prepare('INSERT INTO reminders (ticket_id, kind, sent_at) VALUES (?, ?, ?)').bind(id, kind, now()).run();

export async function reminders(env) {
  const nowMs = Date.now();
  // 0) Head sourcing: warn Jackson 12 hours before the 48-hour report-back is due, and again if it passes (any hour).
  for (const t of (await env.DB.prepare("SELECT * FROM tickets WHERE status = 'submitted' AND deposit_paid_at IS NOT NULL AND deposit_due_by IS NOT NULL").all()).results || []) {
    const left = Date.parse(t.deposit_due_by) - nowMs, kind = left <= 0 ? 'sourcing-late' : left <= 12 * HOUR ? 'sourcing-soon' : null;
    if (!kind || (await sentSince(env, t.id, kind, '2000')).n) continue;
    await logSent(env, t.id, kind);
    const by = new Date(t.deposit_due_by).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' });
    await notifyShop(env, `${ticketNo(t.number)}: head search ${kind === 'sourcing-late' ? 'is PAST its 48 hours' : 'due by ' + by}`,
      `${kind === 'sourcing-late' ? 'The 48 hours you promised are up.' : `You promised an update by ${by} Central.`} Send the price, message the customer with where the search stands, or refund the deposit and close the ticket.\n\n${siteUrl(env, '/admin/?t=' + t.id)}`);
  }
  const h = centralHour();
  if (!env.DEV_ANY_HOUR && (h < 8 || h >= 20)) return; // only email customers 8am–8pm Central
  // 0b) Sourcing deposit asked for but not paid: every 24 hours, up to 3 times.
  for (const t of (await env.DB.prepare("SELECT * FROM tickets WHERE status = 'submitted' AND deposit_cents > 0 AND deposit_paid_at IS NULL AND deposit_requested_at IS NOT NULL").all()).results || []) {
    const base = t.deposit_requested_at, s = await sentSince(env, t.id, 'deposit', base);
    if (s.n >= 3 || nowMs - Date.parse(s.last || base) < 24 * HOUR) continue;
    await logSent(env, t.id, 'deposit');
    await notifyCustomer(env, t, 'reminder: start your head search', `Jackson is ready to search for your head as soon as the ${money(t.deposit_cents)} sourcing deposit is in. It counts toward your build and is refunded in full if no genuine head is found at the quoted price.\n\nOpen your ticket and tap "Pay deposit & start search". Changed your mind? Just reply and let him know.`);
  }
  // 1) Price sent but not approved/paid: every 24 hours, up to 5 times.
  for (const t of (await env.DB.prepare("SELECT * FROM tickets WHERE status IN ('awaiting_approval','approved') AND total_cents > paid_cents").all()).results || []) {
    const base = t.status_at || t.updated_at, s = await sentSince(env, t.id, 'approve', base);
    if (s.n >= 5 || nowMs - Date.parse(s.last || base) < 24 * HOUR) continue;
    await logSent(env, t.id, 'approve');
    await notifyCustomer(env, t, 'reminder: approve your price', `Your price is ready: ${money(t.total_cents - t.paid_cents)} due. Open your ticket to review it and tap "Approve & pay". Jackson orders your parts as soon as payment clears.\n\nQuestions or changes? Reply here or message Jackson on your ticket.`);
  }
  // 1b) Paid but no drop-off planned and clubs not in yet: once a day, up to 2 times.
  for (const t of (await env.DB.prepare("SELECT * FROM tickets WHERE status IN ('paid','parts_ordered') AND clubs_in_at IS NULL AND (dropoff_at IS NULL OR dropoff_at = '') AND paid_cents > 0").all()).results || []) {
    const base = t.status_at || t.updated_at, s = await sentSince(env, t.id, 'dropoff', base);
    if (s.n >= 2 || nowMs - Date.parse(s.last || base) < 24 * HOUR) continue;
    await logSent(env, t.id, 'dropoff');
    await notifyCustomer(env, t, 'when can you drop off your clubs?', `You're all paid up. The only thing left is getting your clubs to the shop.\n\n${nextSteps(env, t)}`);
  }
  // 2) Ready but no pickup scheduled: every 12 hours, up to 10 times.
  for (const t of (await env.DB.prepare("SELECT * FROM tickets WHERE status = 'ready' AND (pickup_at IS NULL OR pickup_at = '')").all()).results || []) {
    const base = t.status_at || t.updated_at, s = await sentSince(env, t.id, 'pickup', base);
    if (s.n >= 10 || nowMs - Date.parse(s.last || base) < 12 * HOUR) continue;
    await logSent(env, t.id, 'pickup');
    await notifyCustomer(env, t, 'your clubs are ready for pickup', 'Your clubs are done and waiting for you. Open your ticket and tap "Schedule pickup" to pick a time, or reply to this email.');
  }
  // 3) Picked up a day ago: thank you, credit toward next time, and a review link.
  const credit = Number(env.THANKS_CREDIT_CENTS || 0);
  for (const t of (await env.DB.prepare("SELECT * FROM tickets WHERE status = 'completed' AND paid_cents > 0 AND status_at <= ? AND status_at >= ?")
    .bind(new Date(nowMs - 24 * HOUR).toISOString(), new Date(nowMs - 14 * 24 * HOUR).toISOString()).all()).results || []) {
    if ((await sentSince(env, t.id, 'review', '2000')).n) continue;
    await logSent(env, t.id, 'review'); // log first so a failed email can never grant the credit twice
    if (credit > 0) await env.DB.prepare('UPDATE customers SET credit_cents = credit_cents + ? WHERE id = ?').bind(credit, t.customer_id).run();
    const review = env.GOOGLE_REVIEW_URL ? `\n\nIf you have a minute, a quick Google review helps a small local shop more than anything:\n${env.GOOGLE_REVIEW_URL}` : '';
    await notifyCustomer(env, t, 'thanks for choosing Rocket City ClubWorks',
      `Thanks for trusting me with your clubs! I hope they feel great out there.${credit > 0 ? `\n\nAs a thank-you, ${money(credit)} is saved on your account toward your next service. I'll take it off your next service.` : ''}${review}`);
    await addEvent(env, t.id, 'system', 'internal', `Thank-you email sent${credit > 0 ? ' with ' + money(credit) + ' credit' : ''}.`);
  }
}

// FedEx Track API: keeps shipped GolfWorks orders up to date (needs FEDEX_API_KEY + FEDEX_SECRET_KEY).
async function fedexToken(env) {
  const r = await fetch('https://apis.fedex.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(env.FEDEX_API_KEY)}&client_secret=${encodeURIComponent(env.FEDEX_SECRET_KEY)}` });
  if (!r.ok) throw new Error('FedEx auth ' + r.status);
  return (await r.json()).access_token;
}
export async function fedexTrack(env, ctx, applyOrderStatus) {
  if (!env.FEDEX_API_KEY || !env.FEDEX_SECRET_KEY) return;
  const orders = (await env.DB.prepare("SELECT * FROM orders WHERE status = 'shipped' AND tracking IS NOT NULL AND tracking <> '' AND LOWER(COALESCE(carrier,'')) IN ('fedex','') LIMIT 30").all()).results || [];
  if (!orders.length) return;
  const token = await fedexToken(env);
  for (let i = 0; i < orders.length; i += 10) {
    const batch = orders.slice(i, i + 10);
    const r = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
      body: JSON.stringify({ includeDetailedScans: false, trackingInfo: batch.map((o) => ({ trackingNumberInfo: { trackingNumber: o.tracking } })) }),
    });
    if (!r.ok) { console.log('fedex track', r.status); continue; }
    const res = ((await r.json()).output || {}).completeTrackResults || [];
    for (const c of res) {
      const o = batch.find((x) => x.tracking === c.trackingNumber); const tr = (c.trackResults || [])[0];
      if (!o || !tr || tr.error) continue;
      const code = tr.latestStatusDetail && tr.latestStatusDetail.code;
      const est = (tr.dateAndTimes || []).find((d) => d.type === 'ESTIMATED_DELIVERY') || (tr.estimatedDeliveryTimeWindow && tr.estimatedDeliveryTimeWindow.window && { dateTime: tr.estimatedDeliveryTimeWindow.window.ends });
      const eta = est && est.dateTime ? est.dateTime.slice(0, 10) : o.eta;
      const v = { ...o, carrier: o.carrier || 'FedEx', eta, status: code === 'DL' ? 'delivered' : 'shipped' };
      if (v.status !== o.status || v.eta !== o.eta || v.carrier !== o.carrier) {
        await env.DB.prepare('UPDATE orders SET status = ?, eta = ?, carrier = ?, updated_at = ? WHERE id = ?').bind(v.status, v.eta, v.carrier, now(), o.id).run();
        await applyOrderStatus(env, o, v, ctx);
        if (v.status === 'delivered') await notifyShop(env, `GolfWorks order ${o.order_no || '#' + o.id} delivered`, `FedEx says it was delivered. Parts on it are marked "at the shop".\n\n${siteUrl(env, '/admin/?v=orders')}`);
      }
    }
  }
}
