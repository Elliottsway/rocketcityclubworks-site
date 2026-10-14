// GET /api/health — tells the menu whether online work tickets are switched on (database connected).
import { json } from '../_lib/util.js';

export async function onRequestGet({ env }) {
  return json({ tickets: !!env.DB });
}
