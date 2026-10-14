// Until the ticket database is connected, the ticket routes answer with a clean "not available yet".
import { err } from '../_lib/util.js';

export async function onRequest({ request, env, next }) {
  const path = new URL(request.url).pathname;
  if (!env.DB && path !== '/api/health') return err('Online work tickets are not switched on yet. Please text your quote instead.', 503);
  return next();
}
