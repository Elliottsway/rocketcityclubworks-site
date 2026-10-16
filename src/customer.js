// Customer-facing API: account, tickets, messages, approve & pay.
import { fillCosts, json, err, now, newId, clip, cleanPhone, fmtPhone, readJson, cleanLines, totals, getTicket, addEvent, publicTicket,
  limited, notifyShop, notifyCustomer, siteUrl, ticketNo, money, statusLabel, depositState } from './lib.js';
import { createPaymentLink, squareReady, syncOrder } from './square.js';

const CATEGORIES = ['Regrip', 'Reshaft', 'Loft & lie', 'Broken club repair', 'Find a part', 'Something else'];

// GET /api/me
export async function me(request, env, c) {
  const r = await env.DB.prepare('SELECT id, number, kind, title, status, created_at, updated_at, total_cents, paid_cents, eta, deposit_cents, deposit_paid_at FROM tickets WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100').bind(c.id).all();
  return json({
    customer: { name: c.name, email: c.email, phone: c.phone, phone_fmt: fmtPhone(c.phone), credit_cents: c.credit_cents || 0 },
    tickets: (r.results || []).map(({ deposit_cents, deposit_paid_at, ...t }) => ({ ...t, number: ticketNo(t.number), status_label: statusLabel({ ...t, deposit_cents, deposit_paid_at }),
      due_cents: depositState({ ...t, deposit_cents, deposit_paid_at }) === 'requested' ? deposit_cents : Math.max(0, t.total_cents - t.paid_cents) })),
    categories: CATEGORIES,
  });
}
// PUT /api/me {name, phone}
export async function updateMe(request, env, c) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const name = clip((b.name || '').trim(), 80), phone = cleanPhone(b.phone);
  if (!name) return err('Please add your name.');
  if (phone.length < 10) return err('Please add a 10-digit mobile number.');
  await env.DB.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').bind(name, phone, c.id).run();
  return json({ ok: true });
}

// POST /api/tickets {kind: 'quote'|'request', note, lines?, summary?, spec?, category?, clubs?, timing?}
export async function createTicket(request, env, c, ctx) {
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  if (await limited(env, 'ticket:' + c.id, 8, 3600)) return err('That is a lot of tickets at once. Message Jackson on an open ticket instead.', 429);
  const kind = b.kind === 'request' ? 'request' : 'quote';
  let title, spec, lines = [];
  if (kind === 'request') {
    const cat = CATEGORIES.includes(b.category) ? b.category : 'Something else';
    const desc = clip((b.description || '').trim(), 3000);
    if (!desc) return err('Please describe what you need.');
    title = cat;
    spec = { summary: [`Request: ${cat}`, b.clubs ? `Clubs: ${clip(b.clubs, 300)}` : null, `Details: ${desc}`, b.timing ? `Timing: ${clip(b.timing, 200)}` : null].filter(Boolean) };
  } else {
    lines = await fillCosts(env, cleanLines(b.lines));
    if (!lines.length) return err('Your quote is empty.');
    spec = { summary: (Array.isArray(b.summary) ? b.summary : []).slice(0, 40).map((s) => clip(s, 400)) };
    title = clip(String(spec.summary[0] || 'Instant price quote').split(':')[0], 60);
  }
  const taxRate = Number(env.TAX_RATE || 0), sum = totals(lines, taxRate);
  const id = newId(), t = now();
  const last = await env.DB.prepare('SELECT MAX(number) AS n FROM tickets').first();
  const number = (last && last.n ? last.n : 1000) + 1;
  await env.DB.prepare(`INSERT INTO tickets (id, number, customer_id, kind, title, status, created_at, updated_at, customer_note, spec, lines, tax_rate, total_cents, ref)
      VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, number, c.id, kind, title, t, t, clip(b.note, 2000), JSON.stringify(spec).slice(0, 20000), JSON.stringify(lines), taxRate, sum.total_cents, clip(b.ref, 24)).run();
  await addEvent(env, id, 'customer', 'submitted', kind === 'request' ? `Service request: ${title}.` : 'Submitted from the instant price.');
  const tk = { id, number, customer_id: c.id };
  ctx.waitUntil(Promise.all([
    notifyShop(env, `New ${kind === 'request' ? 'request' : 'quote'} ${ticketNo(number)} from ${c.name}`,
      `${c.name} · ${fmtPhone(c.phone)} · ${c.email}\n${kind === 'quote' ? 'Estimate: ' + money(sum.total_cents) + '\n' : ''}\n${spec.summary.join('\n')}\n\nNote: ${b.note || '-'}\n\nReview and price it: ${siteUrl(env, '/admin/?t=' + id)}`),
    notifyCustomer(env, tk, 'we got your ' + (kind === 'request' ? 'request' : 'quote'),
      'Thanks! Jackson will review it, confirm parts and fit, and send you a final price to approve, usually the same day (replies 8am–5pm). Nothing is charged until you approve it.\n\nIf it\'s a repair, or you\'re not sure of your grip size or shaft, a photo on your ticket helps.'),
  ]));
  return json({ id, number: ticketNo(number) }, 201);
}

async function ownTicket(env, c, id) {
  const t = await getTicket(env, String(id));
  return t && t.customer_id === c.id ? t : null;
}

// GET /api/tickets/:id
export async function getOwnTicket(request, env, c, id) {
  const t = await ownTicket(env, c, id);
  if (!t) return err('Ticket not found.', 404);
  return json(await publicTicket(env, t));
}

// POST /api/tickets/:id/message {text}
export async function postMessage(request, env, c, id, ctx) {
  const t = await ownTicket(env, c, id);
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await readJson(request); } catch { return err('Bad request'); }
  const text = clip((b.text || '').trim(), 1500), photos = Math.max(0, Math.min(30, Number(b.photos) || 0));
  if (!text && !photos) return err('Type a message first.');
  if (await limited(env, 'msg:' + c.id, 15, 3600)) return err('Too many messages. Please wait a bit.', 429);
  if (text) await addEvent(env, t.id, 'customer', 'message', text);
  await env.DB.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').bind(now(), t.id).run();
  ctx.waitUntil(notifyShop(env, `${text ? 'Message' : 'Photos'} on ${ticketNo(t.number)} from ${c.name}`, `${text || ''}${photos ? `\n(${photos} photo${photos > 1 ? 's' : ''} added)` : ''}\n\nReply: ${siteUrl(env, '/admin/?t=' + t.id)}`));
  return json(await publicTicket(env, await getTicket(env, t.id)));
}

// POST /api/tickets/:id/approve {version}  → Square checkout URL for what's due
export async function approve(request, env, c, id, ctx) {
  const t = await ownTicket(env, c, id);
  if (!t) return err('Ticket not found.', 404);
  let b; try { b = await readJson(request); } catch { b = {}; }
  if (Number(b.version) !== t.version) return err('The price was just updated. Refresh to see the latest version before approving.', 409);
  // A balance can also be paid once work has started (e.g. Jackson set it ready before the payment came in).
  const working = ['in_progress', 'ready'].includes(t.status);
  if (!['awaiting_approval', 'approved'].includes(t.status) && !working) return err('This ticket is not waiting for approval.', 409);
  const due = t.total_cents - t.paid_cents;
  if (due <= 0) return err('Nothing is due on this ticket.', 409);
  if ((t.status === 'approved' || working) && t.approved_version === t.version && t.square_link_url && t.square_order_id) return json({ url: t.square_link_url });
  if (!squareReady(env)) return err('Online payment is not switched on yet. Jackson will send you a payment link.', 503);

  const lines = JSON.parse(t.lines || '[]'), sum = totals(lines, t.tax_rate);
  let items;
  if (t.paid_cents > 0 || lines.some((l) => l.unit_cents < 0)) {
    items = [{ name: `${ticketNo(t.number)} ${t.paid_cents > 0 ? 'balance due' : 'service ticket'}`, cents: due }];
  } else {
    items = lines.filter((l) => l.unit_cents > 0).map((l) => ({ name: l.qty > 1 ? `${l.desc} × ${l.qty}` : l.desc, cents: l.qty * l.unit_cents }));
    if (sum.tax_cents > 0) items.push({ name: 'Sales tax on parts', cents: sum.tax_cents });
  }
  let link;
  try {
    link = await createPaymentLink(env, {
      idempotencyKey: `${t.id}-v${t.version}-${t.paid_cents}`, reference: ticketNo(t.number), lines: items,
      redirectUrl: siteUrl(env, '/ticket/?t=' + t.id + '&paid=1'), email: c.email, phone: c.phone,
    });
  } catch (e) {
    console.log(e.message);
    return err('Square could not start the payment. Please try again in a minute.', 502);
  }
  await env.DB.prepare('UPDATE tickets SET status = ?, approved_version = ?, square_order_id = ?, square_link_url = ?, updated_at = ? WHERE id = ?')
    .bind(working ? t.status : 'approved', t.version, link.orderId, link.url, now(), t.id).run();
  await addEvent(env, t.id, 'customer', 'approved', `Approved ${money(due)} and went to payment.`);
  ctx.waitUntil(notifyShop(env, `${ticketNo(t.number)} approved by ${c.name}`, `${money(due)} approved; waiting on Square to confirm payment.\n${siteUrl(env, '/admin/?t=' + t.id)}`));
  return json({ url: link.url });
}

// POST /api/tickets/:id/deposit  → Square checkout URL for the head sourcing deposit Jackson asked for
export async function payDeposit(request, env, c, id, ctx) {
  const t = await ownTicket(env, c, id);
  if (!t) return err('Ticket not found.', 404);
  if (depositState(t) !== 'requested') return err('There is no deposit waiting on this ticket.', 409);
  if (t.deposit_link_url && t.deposit_order_id) return json({ url: t.deposit_link_url });
  if (!squareReady(env)) return err('Online payment is not switched on yet. Jackson will send you a payment link.', 503);
  let link;
  try {
    link = await createPaymentLink(env, {
      idempotencyKey: `${t.id}-dep-${t.deposit_cents}-${t.deposit_requested_at}`, reference: ticketNo(t.number),
      lines: [{ name: `${ticketNo(t.number)} head sourcing deposit (counts toward your build, refundable)`, cents: t.deposit_cents }],
      redirectUrl: siteUrl(env, '/ticket/?t=' + t.id + '&paid=1'), email: c.email, phone: c.phone,
    });
  } catch (e) {
    console.log(e.message);
    return err('Square could not start the payment. Please try again in a minute.', 502);
  }
  await env.DB.prepare('UPDATE tickets SET deposit_order_id = ?, deposit_link_url = ?, updated_at = ? WHERE id = ?').bind(link.orderId, link.url, now(), t.id).run();
  await addEvent(env, t.id, 'customer', 'approved', `Went to pay the ${money(t.deposit_cents)} sourcing deposit.`);
  return json({ url: link.url });
}

// POST /api/tickets/:id/sync — after returning from Square, check the payment directly with Square.
export async function syncPayment(request, env, c, id, ctx) {
  const t = await ownTicket(env, c, id);
  if (!t) return err('Ticket not found.', 404);
  if (await limited(env, 'sync:' + t.id, 20, 600)) return json(await publicTicket(env, t));
  await syncOrder(env, t, ctx);
  return json(await publicTicket(env, await getTicket(env, t.id)));
}

export { notifyCustomer };
