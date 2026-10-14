// Every /api/admin/* request must carry a valid Cloudflare Access login for an allowed email.
import { err } from '../../_lib/util.js';
import { adminEmail } from '../../_lib/auth.js';

export async function onRequest(context) {
  const email = await adminEmail(context.request, context.env);
  if (!email) return err('Not signed in.', 401);
  context.data.admin = email;
  return context.next();
}
