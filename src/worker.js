// Rocket City ClubWorks: static site (served from assets) + the service-ticket API under /api/.
import { json, err } from './lib.js';
import { currentCustomer, authStart, authVerify, authLogout, isAdmin, adminLogin } from './auth.js';
import { me, updateMe, createTicket, getOwnTicket, postMessage, approve, syncPayment } from './customer.js';
import { squareWebhook, squareReady } from './square.js';
import * as A from './admin.js';

async function api(request, env, ctx) {
  const url = new URL(request.url), path = url.pathname.replace(/\/+$/, ''), m = request.method;
  if (!env.DB) return err('Service tickets are not switched on yet.', 503);

  if (path === '/api/health') return json({ tickets: true, accounts: !!env.RESEND_API_KEY, payments: squareReady(env) });
  if (path === '/api/square/webhook' && m === 'POST') return squareWebhook(request, env, ctx);
  if (path === '/api/auth/start' && m === 'POST') return authStart(request, env);
  if (path === '/api/auth/verify' && m === 'POST') return authVerify(request, env);
  if (path === '/api/auth/logout' && m === 'POST') return authLogout(request, env);
  if (path === '/api/admin-login' && m === 'POST') return adminLogin(request, env);

  // ---- Jackson ----
  if (path.startsWith('/api/admin/')) {
    if (!(await isAdmin(request, env))) return err('Not signed in.', 401);
    const p = path.slice('/api/admin/'.length).split('/');
    if (p[0] === 'tickets') {
      if (!p[1]) return m === 'POST' ? A.createTicketAdmin(request, env) : A.listTickets(request, env);
      if (m === 'GET') return A.getTicketAdmin(request, env, p[1]);
      if (m === 'PUT') return A.updateTicket(request, env, p[1], ctx);
    }
    if (p[0] === 'orders') {
      if (!p[1]) return m === 'POST' ? A.createOrder(request, env) : A.listOrders(request, env);
      if (m === 'PUT') return A.updateOrder(request, env, p[1], ctx);
    }
    if (p[0] === 'customers') {
      if (!p[1]) return m === 'POST' ? A.createCustomer(request, env) : A.listCustomers(request, env);
      if (p[2] === 'invite' && m === 'POST') return A.inviteCustomer(request, env, p[1]);
      if (m === 'GET') return A.getCustomerAdmin(request, env, p[1]);
      if (m === 'PUT') return A.updateCustomer(request, env, p[1]);
    }
    return err('Not found.', 404);
  }

  // ---- signed-in customers ----
  const c = await currentCustomer(request, env);
  if (!c) return err('Please sign in.', 401);
  if (path === '/api/me') return m === 'PUT' ? updateMe(request, env, c) : me(request, env, c);
  if (path === '/api/tickets' && m === 'POST') return createTicket(request, env, c, ctx);
  const t = path.match(/^\/api\/tickets\/([\w-]{8,40})(?:\/(message|approve|sync))?$/);
  if (t) {
    if (!t[2] && m === 'GET') return getOwnTicket(request, env, c, t[1]);
    if (t[2] === 'message' && m === 'POST') return postMessage(request, env, c, t[1], ctx);
    if (t[2] === 'approve' && m === 'POST') return approve(request, env, c, t[1], ctx);
    if (t[2] === 'sync' && m === 'POST') return syncPayment(request, env, c, t[1], ctx);
  }
  return err('Not found.', 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(request, env, ctx); }
      catch (e) { console.log('api error', e && e.stack); return err('Something went wrong. Please try again.', 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
