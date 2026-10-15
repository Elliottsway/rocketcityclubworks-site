/* Shared helpers for the account, request and ticket pages. */
(function(){
  var A = window.RCCWapp = {};
  A.$ = function(id){ return document.getElementById(id); };
  A.el = function(tag, text, cls){ var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  A.money = function(c){ return (c < 0 ? '−$' : '$') + (Math.abs(c) / 100).toFixed(2); };
  A.date = function(iso){ try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };
  A.when = function(iso){ try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } };
  A.day = function(ymd){ if (!ymd) return ''; var p = ymd.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  // JSON API call. 401 → send them to sign in, then back here.
  A.api = function(path, opts){
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(path, init).then(function(r){
      if (r.status === 401 && !opts.noRedirect) { A.toSignIn(); throw new Error('auth'); }
      return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) { var e = new Error(j.error || 'Something went wrong.'); e.status = r.status; throw e; } return j; });
    });
  };
  A.toSignIn = function(){ location.href = '/account/?next=' + encodeURIComponent(location.pathname + location.search + location.hash); };
  A.STATUS_CLASS = { submitted: 'warn', awaiting_approval: 'warn', approved: 'warn', paid: 'good', parts_ordered: 'good', in_progress: 'good', ready: 'good', completed: 'dim', cancelled: 'dim' };
  A.TRACK = { to_order: 'After payment', ordered: 'Ordered', shipped: 'Shipped', received: 'At the shop', installed: 'Installed' };
})();
