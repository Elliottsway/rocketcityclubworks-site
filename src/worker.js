// Rocket City ClubWorks: static site (served from assets) + the service-ticket API under /api/.
import { json, err } from './lib.js';
import { currentCustomer, authStart, authVerify, authLogout, isAdmin, adminLogin } from './auth.js';
import { me, updateMe, createTicket, getOwnTicket, postMessage, approve, syncPayment, payDeposit } from './customer.js';
import { squareWebhook, squareReady } from './square.js';
import * as A from './admin.js';
import * as X from './extras.js';
import { getTicket } from './lib.js';

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
      if (p[2] === 'payments' && m === 'GET') return A.ticketPaymentsAdmin(request, env, p[1]);
      if (p[2] === 'refund' && m === 'POST') return A.refundTicket(request, env, p[1], ctx);
      if (p[2] === 'manual-payment' && m === 'POST') return p[4] === 'delete' ? X.deleteManualPayment(request, env, p[1], p[3]) : X.manualPayment(request, env, p[1], ctx);
      if (p[2] === 'deposit' && m === 'POST') return A.requestDeposit(request, env, p[1], ctx);
      if (p[2] === 'deposit-refund' && m === 'POST') return A.refundDeposit(request, env, p[1], ctx);
      if (p[2] === 'apply-credit' && m === 'POST') return X.applyCredit(request, env, p[1]);
      if (p[2] === 'photos' && m === 'POST') { const t = await getTicket(env, p[1]); return t ? X.uploadPhoto(request, env, t, 'shop') : err('Ticket not found.', 404); }
      if (!p[2] && m === 'GET') return A.getTicketAdmin(request, env, p[1]);
      if (!p[2] && m === 'PUT') return A.updateTicket(request, env, p[1], ctx);
    }
    if (p[0] === 'orders') {
      if (!p[1]) return m === 'POST' ? A.createOrder(request, env) : A.listOrders(request, env);
      if (m === 'PUT') return A.updateOrder(request, env, p[1], ctx);
    }
    if (p[0] === 'customers') {
      if (!p[1]) return m === 'POST' ? A.createCustomer(request, env) : A.listCustomers(request, env);
      if (p[2] === 'invite' && m === 'POST') return A.inviteCustomer(request, env, p[1]);
      if (p[2] === 'payments' && m === 'GET') return A.customerPayments(request, env, p[1]);
      if (p[2] === 'credit' && m === 'PUT') return X.setCredit(request, env, p[1]);
      if (!p[2] && m === 'GET') return A.getCustomerAdmin(request, env, p[1]);
      if (!p[2] && m === 'PUT') return A.updateCustomer(request, env, p[1]);
    }
    if (p[0] === 'today' && m === 'GET') return A.today(request, env);
    if (p[0] === 'costs' && m === 'GET') return X.partCosts(request, env);
    if (p[0] === 'reports' && m === 'GET') return X.reports(request, env);
    if (p[0] === 'photos' && p[1] && m === 'GET') { const ph = await X.getPhoto(env, p[1]); return ph ? X.servePhoto(env, ph) : err('Not found.', 404); }
    return err('Not found.', 404);
  }

  // ---- signed-in customers ----
  const c = await currentCustomer(request, env);
  if (!c) return err('Please sign in.', 401);
  if (path === '/api/me') return m === 'PUT' ? updateMe(request, env, c) : me(request, env, c);
  if (path === '/api/tickets' && m === 'POST') return createTicket(request, env, c, ctx);
  const ph = path.match(/^\/api\/photos\/([\w-]{8,40})$/);
  if (ph && m === 'GET') {
    const photo = await X.getPhoto(env, ph[1]), pt = photo && await getTicket(env, photo.ticket_id);
    return pt && pt.customer_id === c.id ? X.servePhoto(env, photo) : err('Not found.', 404);
  }
  const t = path.match(/^\/api\/tickets\/([\w-]{8,40})(?:\/(message|approve|sync|photos|pickup|dropoff|deposit))?$/);
  if (t) {
    if (!t[2] && m === 'GET') return getOwnTicket(request, env, c, t[1]);
    if (t[2] === 'message' && m === 'POST') return postMessage(request, env, c, t[1], ctx);
    if (t[2] === 'approve' && m === 'POST') return approve(request, env, c, t[1], ctx);
    if (t[2] === 'deposit' && m === 'POST') return payDeposit(request, env, c, t[1], ctx);
    if (t[2] === 'sync' && m === 'POST') return syncPayment(request, env, c, t[1], ctx);
    if (t[2] === 'photos' || t[2] === 'pickup' || t[2] === 'dropoff') {
      const tk = await getTicket(env, t[1]);
      if (!tk || tk.customer_id !== c.id) return err('Ticket not found.', 404);
      if (t[2] === 'photos' && m === 'POST') return X.uploadPhoto(request, env, tk, 'customer');
      if (t[2] === 'pickup' && m === 'POST') return X.schedulePickup(request, env, c, tk, ctx);
      if (t[2] === 'dropoff' && m === 'POST') return X.scheduleDropoff(request, env, c, tk, ctx);
    }
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
  // Hourly: reminders, thank-you emails, FedEx tracking.
  async scheduled(event, env, ctx) {
    try { await X.reminders(env, A.todayData); } catch (e) { console.log('reminders failed', e && e.stack); }
    try { await X.fedexTrack(env, ctx, A.applyOrderStatus); } catch (e) { console.log('fedex failed', e && e.stack); }
  },
};
