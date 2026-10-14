// GET /api/admin/tickets?status=open|all|<status> — the shop's ticket list.
import { json, ticketNo } from '../../../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const s = new URL(request.url).searchParams.get('status') || 'open';
  let q = 'SELECT id, number, status, name, phone, email, total_cents, paid_cents, created_at, updated_at FROM tickets';
  const args = [];
  if (s === 'open') q += " WHERE status NOT IN ('completed', 'cancelled')";
  else if (s !== 'all') { q += ' WHERE status = ?'; args.push(s); }
  q += ' ORDER BY updated_at DESC LIMIT 200';
  const r = await env.DB.prepare(q).bind(...args).all();
  return json({ tickets: (r.results || []).map((t) => ({ ...t, label: ticketNo(t.number) })) });
}
