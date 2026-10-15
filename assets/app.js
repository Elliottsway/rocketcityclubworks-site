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
  // Shrink a photo in the browser (longest side 1600px, JPEG) before uploading it.
  A.shrink = function(file){
    return new Promise(function(ok, fail){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function(b){ b ? ok(b) : fail(new Error('Could not read that photo.')); }, 'image/jpeg', 0.8);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); fail(new Error('Could not read that photo.')); };
      img.src = url;
    });
  };
  // Upload photos one at a time; resolves with how many went up.
  A.uploadPhotos = function(path, files, status){
    var list = [].slice.call(files || []), done = 0;
    return list.reduce(function(p, f){
      return p.then(function(){
        if (status) status('Uploading photo ' + (done + 1) + ' of ' + list.length + '…');
        return A.shrink(f).then(function(blob){
          return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
            .then(function(r){ if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || 'Upload failed.'); }); done++; });
        });
      });
    }, Promise.resolve()).then(function(){ return done; });
  };
  // A photo thumbnail that opens full size.
  A.photo = function(src){ var a = document.createElement('a'); a.href = src; a.target = '_blank'; a.rel = 'noopener'; a.className = 'thumb'; var i = document.createElement('img'); i.src = src; i.alt = 'Photo'; i.loading = 'lazy'; a.appendChild(i); return a; };
  A.toSignIn = function(){ location.href = '/account/?next=' + encodeURIComponent(location.pathname + location.search + location.hash); };
  A.STATUS_CLASS = { submitted: 'warn', awaiting_approval: 'warn', approved: 'warn', paid: 'good', parts_ordered: 'good', in_progress: 'good', ready: 'good', completed: 'dim', cancelled: 'dim' };
  A.TRACK = { to_order: 'After payment', ordered: 'Ordered', shipped: 'Shipped', received: 'At the shop', installed: 'Installed' };
})();
