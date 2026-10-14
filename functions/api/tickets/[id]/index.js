// GET /api/tickets/:id — the customer's view of their work ticket (the id is the secret in their link).
import { json, err, getTicket, events, publicTicket } from '../../../_lib/util.js';

export async function onRequestGet({ params, env }) {
  const t = await getTicket(env, String(params.id));
  if (!t) return err('Ticket not found.', 404);
  return json(publicTicket(t, await events(env, t.id)));
}
