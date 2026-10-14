/* Instant price + work ticket builder for /menu/.
   Reads labor prices from prices.js (window.RCCW) and parts from /assets/catalog.json
   (every grip and shaft in the GolfWorks 2026 booklet, retail prices, with the sizes,
   colors, flexes and weights GolfWorks offers). Customers submit the result as a work
   ticket; Jackson confirms parts and price before they pay. */
(function(){
  var D = window.RCCW, R = D.rules, B = D.bundles, S = window.RCCWsite, $ = S.money;
  function g(id){ return document.getElementById(id); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function r2(n){ return Math.round(n * 100) / 100; }
  function bundle(n, per, cap, max){ return n <= max ? Math.min(n * per, cap) : cap + (n - max) * per; }
  function atCap(per, cap){ return Math.ceil(cap / per); }
  var CAT = { grips: [], shafts: [] };
  var ADAPTERS = D.shafts.filter(function(s){ return s.id === 'adapters'; })[0].items.filter(function(a){ return typeof a.price === 'number'; });
  var PAINT = ['None', 'White', 'Black', 'Yellow', 'Red', 'Orange', 'Blue', 'Light blue', 'Green', 'Pink', 'Purple', 'Gold', 'Silver'];
  var TYPES = [['driver', 'Driver'], ['fairway', 'Fairway wood'], ['hybrid', 'Hybrid'], ['iron', 'Irons'], ['wedge', 'Wedges']];
  var WOOD = { driver: 1, fairway: 1, hybrid: 1 };

  // ---------- price for the chosen size/color: the booklet prices some sizes and colors differently ----------
  var ALIAS = { STANDARD: ['STD', 'STANDARD'], MIDSIZE: ['MID', 'MIDSIZE'], OVERSIZE: ['OVER', 'OVERSIZE', 'OVR'], JUMBO: ['JUMBO', 'JMB', 'JMBO'], UNDERSIZE: ['UND', 'UNDERSIZE', 'UNDER'],
    JUNIOR: ['JUNIOR', 'JR'], GRAY: ['GRY', 'GRAY', 'GREY'], GREY: ['GRY', 'GRAY', 'GREY'], BLACK: ['BLK', 'BLACK'], BLUE: ['BLU', 'BLUE'], WHITE: ['WHT', 'WHITE'], RED: ['RED'], PINK: ['PINK'], ORANGE: ['ORNG', 'ORANGE'], COPPER: ['COPPER'], NAVY: ['NAVY'], WOMENS: ['WOMEN'] };
  function priceFor(item, sel){
    if (!item.rows || item.rows.length < 2) return item.price;
    var words = [];
    Object.keys(sel || {}).forEach(function(k){ String(sel[k] || '').toUpperCase().split(/[^A-Z0-9']+/).forEach(function(w){ if (w) words = words.concat(ALIAS[w.replace(/'S$/, 'S')] || [w]); }); });
    var best = null, bestScore = -1;
    item.rows.forEach(function(r){
      var toks = r.d.toUpperCase().split(/[^A-Z0-9]+/), score = 0;
      words.forEach(function(w){ if (toks.indexOf(w) >= 0) score += 2; });
      // rows that name a size or color the customer did NOT pick lose a point
      toks.forEach(function(t){ if (/^(MID|MIDSIZE|OVER|OVERSIZE|JUMBO|JMB|UND|JUNIOR|JR|WOMEN)$/.test(t) && words.indexOf(t) < 0) score -= 1; });
      if (score > bestScore || (score === bestScore && r.p < best.p)) { best = r; bestScore = score; }
    });
    return best ? best.p : item.price;
  }

  // ---------- search picker ----------
  // A search box that filters a long list; picking an item shows its option menus.
  function Picker(host, opts){
    var self = this; this.items = opts.items; this.sel = null; this.choice = {}; this.onChange = opts.onChange;
    var wrap = el('div', 'pk'), lab = el('label', null, opts.label); var inp = el('input'); inp.type = 'search'; inp.autocomplete = 'off';
    inp.placeholder = opts.placeholder; inp.id = 'pk' + Math.random().toString(36).slice(2, 8); lab.htmlFor = inp.id; inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'false');
    var list = el('div', 'pk-list'); list.setAttribute('role', 'listbox'); list.hidden = true;
    var chosen = el('div', 'pk-chosen'); chosen.hidden = true;
    var optsBox = el('div', 'pk-opts');
    wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(list); wrap.appendChild(chosen); wrap.appendChild(optsBox); host.appendChild(wrap);
    this.inp = inp; this.list = list; this.chosen = chosen; this.optsBox = optsBox;
    function search(){
      // Match every typed word; spaces and punctuation are ignored so "superstroke" finds "Super Stroke"
      var squash = function(x){ return x.toLowerCase().replace(/[^a-z0-9]+/g, ''); };
      var words = inp.value.trim().split(/\s+/).map(squash).filter(Boolean);
      var hits = self.items().filter(function(it){ var h = squash(it.name + ' ' + it.brand + ' ' + it.id); return words.every(function(w){ return h.indexOf(w) >= 0; }); });
      list.textContent = '';
      if (opts.extra) { var ex = el('button', 'pk-item pk-extra', opts.extra.label); ex.type = 'button'; ex.onclick = function(){ self.pick(opts.extra.item); }; list.appendChild(ex); }
      hits.slice(0, 40).forEach(function(it){
        var b = el('button', 'pk-item'); b.type = 'button'; b.setAttribute('role', 'option');
        b.appendChild(el('span', null, it.name)); b.appendChild(el('small', null, it.brand + ' · ' + (it.rows && it.rows.length > 1 ? 'from ' : '') + $(it.price)));
        b.onclick = function(){ self.pick(it); }; list.appendChild(b);
      });
      if (!hits.length) list.appendChild(el('p', 'pk-none', 'No match. Pick "something else" and describe it in your note.'));
      if (hits.length > 40) list.appendChild(el('p', 'pk-none', (hits.length - 40) + ' more. Keep typing to narrow it down.'));
      list.hidden = false; inp.setAttribute('aria-expanded', 'true');
    }
    inp.addEventListener('input', search); inp.addEventListener('focus', search);
    document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); } });
  }
  Picker.prototype.pick = function(it){
    var self = this; this.sel = it; this.choice = {}; this.list.hidden = true; this.inp.value = ''; this.inp.hidden = true;
    this.chosen.hidden = false; this.chosen.textContent = '';
    this.chosen.appendChild(el('b', null, it.name)); this.chosen.appendChild(el('span', null, it.own ? '' : $(it.price)));
    var ch = el('button', 'pk-change', 'Change'); ch.type = 'button'; ch.onclick = function(){ self.inp.hidden = false; self.inp.focus(); }; this.chosen.appendChild(ch);
    this.optsBox.textContent = '';
    Object.keys(it.opts || {}).forEach(function(name){
      var f = el('div', 'pk-opt'), id = 'o' + Math.random().toString(36).slice(2, 8), l = el('label', null, name); l.htmlFor = id;
      var s = el('select'); s.id = id; it.opts[name].forEach(function(v){ s.appendChild(new Option(v, v)); });
      self.choice[name] = it.opts[name][0];
      s.onchange = function(){ self.choice[name] = s.value; self.onChange(); };
      f.appendChild(l); f.appendChild(s); self.optsBox.appendChild(f);
    });
    this.onChange();
  };
  Picker.prototype.price = function(){ return !this.sel || this.sel.own ? 0 : priceFor(this.sel, this.choice); };
  Picker.prototype.desc = function(){
    if (!this.sel) return '';
    var c = this.choice, extra = Object.keys(c).map(function(k){ return c[k]; }).join(', ');
    return this.sel.name + (extra ? ' (' + extra + ')' : '');
  };

  // ---------- state ----------
  var q = { rg: 0, ll: 8, pf: 0 };
  var gripMode = 'order', gripPk, putterPk, shaftRows = [];
  function stepper(k, max){
    var st = document.querySelector('.step[data-k="' + k + '"]'); if (!st) return;
    var out = st.querySelector('output'), b = st.querySelectorAll('button');
    function set(n){ q[k] = Math.max(0, Math.min(max, n)); out.textContent = q[k]; calc(); }
    b[0].onclick = function(){ set(q[k] - 1); }; b[1].onclick = function(){ set(q[k] + 1); };
  }

  function addShaftRow(){
    var row = { n: 1, type: 'iron', adapter: -1 }, box = el('div', 'srow card');
    var top = el('div', 'srow-top');
    var tl = el('label', null, 'Club'), ts = el('select'); var tid = 'st' + Math.random().toString(36).slice(2, 7); tl.htmlFor = tid; ts.id = tid;
    TYPES.forEach(function(t){ ts.appendChild(new Option(t[1], t[0])); }); ts.value = row.type;
    var tw = el('div'); tw.appendChild(tl); tw.appendChild(ts);
    var cw = el('div', 'line'); cw.appendChild(el('span', null, 'How many'));
    var stp = el('div', 'step'); var mi = el('button', null, '−'), out = el('output', null, '1'), pl = el('button', null, '+'); mi.type = pl.type = 'button';
    mi.setAttribute('aria-label', 'Fewer clubs'); pl.setAttribute('aria-label', 'More clubs');
    stp.appendChild(mi); stp.appendChild(out); stp.appendChild(pl); cw.appendChild(stp);
    var rm = el('button', 'pk-change', 'Remove'); rm.type = 'button';
    top.appendChild(tw); top.appendChild(cw); box.appendChild(top);
    var pkHost = el('div'); box.appendChild(pkHost);
    var adW = el('div'); var al = el('label', null, 'Adapter'), as = el('select'); var aid = 'ad' + Math.random().toString(36).slice(2, 7); al.htmlFor = aid; as.id = aid;
    as.appendChild(new Option('Move my current adapter (no charge)', '-1')); ADAPTERS.forEach(function(a, i){ as.appendChild(new Option('New ' + a.name + ' adapter · ' + $(a.price), String(i))); });
    adW.appendChild(al); adW.appendChild(as); box.appendChild(adW); box.appendChild(rm);
    row.pk = new Picker(pkHost, { label: 'Shaft', placeholder: 'Search shafts: brand, model or flex (e.g. Ventus, Dynamic Gold)', onChange: calc,
      items: function(){ return CAT.shafts.filter(function(s){ return !s.use.length || s.use.indexOf(row.type) >= 0; }); },
      extra: { label: 'Use my own shaft (labor only)', item: { id: 'OWN', name: 'My own shaft', brand: '', price: 0, own: true, opts: {} } } });
    ts.onchange = function(){ row.type = ts.value; adW.hidden = !WOOD[row.type]; calc(); };
    mi.onclick = function(){ row.n = Math.max(1, row.n - 1); out.textContent = row.n; calc(); };
    pl.onclick = function(){ row.n = Math.min(14, row.n + 1); out.textContent = row.n; calc(); };
    as.onchange = function(){ row.adapter = +as.value; calc(); };
    rm.onclick = function(){ shaftRows.splice(shaftRows.indexOf(row), 1); box.remove(); calc(); };
    adW.hidden = !WOOD[row.type];
    row.box = box; shaftRows.push(row); g('q-shafts').appendChild(box); calc();
  }

  // ---------- pricing ----------
  var last = null;
  function calc(){
    if (!gripPk) return;
    var lines = [], msg = [], saves = [];
    function add(desc, qty, unit, kind, taxable, off){ lines.push({ desc: desc, qty: qty, unit_cents: Math.round(unit * 100), kind: kind, taxable: !!taxable, off: !!off }); }
    var ordered = gripMode === 'order';
    g('q-grippick').hidden = !ordered || q.rg === 0;
    // Regrip
    var per = ordered ? R.regripOurs : R.regripOwn, cap = ordered ? R.regripOursBag : R.regripOwnBag, need = atCap(per, cap);
    var fullBag = q.rg >= need, launchBag = false, parts = 0;
    if (q.rg > 0) {
      add('Regrip labor, ' + q.rg + ' club' + (q.rg > 1 ? 's' : '') + (fullBag ? ' (full bag)' : ''), 1, bundle(q.rg, per, cap, R.bagMax), 'labor');
      if (ordered && gripPk.sel) { var gp = gripPk.price(); add(gripPk.desc(), q.rg, gp, 'part', true); parts += gp * q.rg; }
      msg.push('Regrip ' + q.rg + ' club' + (q.rg > 1 ? 's' : '') + ': ' + (ordered ? (gripPk.sel ? gripPk.desc() : 'grip not picked yet') : 'my own grips'));
      if (ordered && fullBag && S.launchLive) { launchBag = true; add('Launch full-bag price', 1, -(R.regripOursBag - B.launchBag.price), 'discount', false, true); saves.push('Launch full-bag price'); }
    }
    var nudge = g('n-rg'); var nn = need - q.rg;
    nudge.hidden = !(q.rg > 0 && nn > 0 && nn <= 4); nudge.textContent = nudge.hidden ? '' : 'Add ' + nn + ' more club' + (nn > 1 ? 's' : '') + ' and the full-bag price kicks in: up to 14 clubs for ' + $(ordered && S.launchLive ? B.launchBag.price : cap) + '.';
    // Putter
    var putter = g('q-putter').checked; g('q-putterpick').hidden = !putter;
    if (putter) {
      add('Putter grip install', 1, R.putterGrip, 'labor');
      if (putterPk.sel && !putterPk.sel.own) { var pp = putterPk.price(); add(putterPk.desc(), 1, pp, 'part', true); parts += pp; }
      msg.push('Putter regrip: ' + (putterPk.sel ? putterPk.desc() : 'grip not picked yet'));
    }
    // Loft & lie
    var loft = g('q-loft').value; g('q-loft-n').hidden = loft !== 'adjust';
    if (loft === 'check') { add('Loft & lie check', 1, R.loftCheck, 'labor'); if (launchBag) add('Free loft & lie check with launch full bag', 1, -R.loftCheck, 'discount', false, true); msg.push('Loft & lie check'); }
    if (loft === 'adjust' && q.ll > 0) { var llNeed = atCap(R.loftPer, R.loftSet); add('Loft & lie check & adjust, ' + q.ll + ' clubs' + (q.ll >= llNeed ? ' (set)' : ''), 1, bundle(q.ll, R.loftPer, R.loftSet, R.loftSetMax), 'labor'); msg.push('Loft & lie check & adjust, ' + q.ll + ' clubs'); }
    // Reshaft
    var irons = 0, shaftCount = 0;
    shaftRows.forEach(function(r){ if (!WOOD[r.type]) irons += r.n; shaftCount += r.n; });
    var set = irons >= R.ironSetMin;
    shaftRows.forEach(function(r){
      var s = r.pk.sel, graphite = s && !s.own ? s.material === 'graphite' : WOOD[r.type];
      var label = TYPES.filter(function(t){ return t[0] === r.type; })[0][1];
      var each = WOOD[r.type] ? R.reshaftWood : set ? (graphite ? R.ironSetGraphite : R.ironSetSteel) : (graphite ? R.reshaftGraphite : R.reshaftSteel);
      add('Reshaft ' + label.toLowerCase() + (set && !WOOD[r.type] ? ' (set price)' : ''), r.n, each, 'labor');
      if (s && !s.own) { var sp = r.pk.price(); add(r.pk.desc(), r.n, sp, 'part', true); parts += sp * r.n; }
      if (WOOD[r.type] && r.adapter >= 0) { var a = ADAPTERS[r.adapter]; add(a.name + ' adapter', r.n, a.price, 'part', true); parts += a.price * r.n; }
      msg.push('Reshaft ' + r.n + ' ' + label.toLowerCase() + ': ' + (s ? r.pk.desc() : 'shaft not picked yet') + (WOOD[r.type] && r.adapter >= 0 ? ' + new ' + ADAPTERS[r.adapter].name + ' adapter' : ''));
    });
    var rs = g('n-rs'), need6 = R.ironSetMin - irons;
    rs.hidden = !(irons > 0 && need6 > 0 && need6 <= 3); rs.textContent = rs.hidden ? '' : 'Add ' + need6 + ' more iron' + (need6 > 1 ? 's' : '') + ' for set pricing: ' + $(R.ironSetSteel) + ' steel, ' + $(R.ironSetGraphite) + ' graphite per club.';
    // Paint fill
    var paint = g('q-paint').checked; g('q-paintbox').hidden = !paint;
    if (paint && q.pf > 0) {
      var colors = ['pf-num', 'pf-logo', 'pf-stamp'].map(function(id){ return g(id).value; });
      add('Paint fill, ' + q.pf + ' clubs' + (q.pf >= atCap(R.paintPer, R.paintSet) ? ' (set)' : ''), 1, bundle(q.pf, R.paintPer, R.paintSet, 10), 'labor');
      msg.push('Paint fill ' + q.pf + ' clubs: numbers ' + colors[0] + ', logo ' + colors[1] + ', stamping ' + colors[2]);
    }
    // Season tune-up
    if (q.rg >= 10 && loft === 'adjust' && q.ll >= 6) { add('Season tune-up bundle', 1, -B.tuneUpOff, 'discount', false, true); saves.push('Season tune-up'); }
    // Parts fee / rush and timing
    var partsOrdered = parts > 0;
    g('q-parts').hidden = !partsOrdered;
    var rush = partsOrdered && g('q-rush').checked;
    if (partsOrdered) {
      if (rush) { add('Rush: overnight parts', 1, R.rush, 'fee'); msg.push('Rush overnight parts'); }
      else if (parts >= R.partsFreeOver) add('Parts fee (free at $' + R.partsFreeOver + '+ in parts)', 1, 0, 'fee');
      else add('Parts fee', 1, R.partsFee, 'fee');
    }
    var anyWork = lines.length > 0;
    var ready = !anyWork ? '—' : !partsOrdered ? 'Next day' : rush ? 'About ' + R.rushDays : irons >= R.ironSetMin ? '4–5 business days' : shaftCount ? '3–5 business days' : R.partsDays;
    var total = r2(lines.reduce(function(s, l){ return s + l.qty * l.unit_cents; }, 0) / 100);

    var box = g('q-lines'); box.textContent = '';
    if (!anyWork) box.appendChild(el('p', 'empty', 'Add clubs to see your price.'));
    lines.forEach(function(l){
      var d = el('div', 'ln' + (l.off ? ' off' : ''));
      d.appendChild(el('span', null, l.qty > 1 ? l.desc + ' × ' + l.qty : l.desc));
      var amt = l.qty * l.unit_cents / 100;
      d.appendChild(el('span', null, amt === 0 ? 'Free' : (amt < 0 ? '−' : '') + $(Math.abs(r2(amt)))));
      box.appendChild(d);
    });
    g('q-total').textContent = $(total);
    g('q-ready').textContent = ready;
    g('q-submit').disabled = !anyWork;

    var text = ['Hi Jackson! Quote from the website:'].concat(msg.map(function(m){ return '• ' + m; }));
    if (saves.length) text.push('Deals: ' + saves.join(', '));
    text.push('Estimate: ' + $(total), 'Ready in: ' + ready, '(' + S.ref + ')');
    last = { lines: lines.map(function(l){ return { desc: l.desc, qty: l.qty, unit_cents: l.unit_cents, kind: l.kind, taxable: l.taxable }; }), summary: msg.concat(saves.length ? ['Deals: ' + saves.join(', ')] : []).concat(['Ready in: ' + ready]), text: anyWork ? text.join('\n') : "Hi Jackson! I'd like a quote. (" + S.ref + ')' };
    g('q-send').href = S.smsHref(last.text);
  }

  // ---------- submit as a work ticket ----------
  function submit(e){
    e.preventDefault();
    var f = g('q-form'), out = g('q-fout'), btn = f.querySelector('button[type=submit]');
    var body = { name: g('f-name').value, phone: g('f-phone').value, email: g('f-email').value, note: g('f-note').value, website: g('f-website').value,
      ref: S.ref, lines: last.lines, summary: last.summary.join('\n'), spec: { summary: last.summary } };
    btn.disabled = true; out.className = 'fine'; out.textContent = 'Sending…';
    fetch('/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(x){
        if (!x.ok) { out.className = 'err'; out.textContent = x.j.error || 'Something went wrong.'; btn.disabled = false; return; }
        location.href = '/ticket/?t=' + encodeURIComponent(x.j.id) + '&new=1';
      })
      .catch(function(){ out.className = 'err'; out.textContent = 'Could not reach the shop. Use "Text this quote" instead.'; btn.disabled = false; });
  }

  // ---------- start ----------
  function start(cat){
    CAT = cat;
    var grips = function(){ return CAT.grips.filter(function(x){ return !x.putter; }); };
    gripPk = new Picker(g('q-grippick'), { label: 'Grip', placeholder: 'Search grips: brand, model or color (e.g. Tour Velvet, MCC, Dri-Tac)', items: grips, onChange: calc });
    putterPk = new Picker(g('q-putterpick'), { label: 'Putter grip', placeholder: 'Search putter grips (e.g. SuperStroke, Pistol)', onChange: calc,
      items: function(){ return CAT.grips.filter(function(x){ return x.putter; }); },
      extra: { label: 'Use my own putter grip', item: { id: 'OWN', name: 'My own putter grip', brand: '', price: 0, own: true, opts: {} } } });
    var tv = grips().filter(function(x){ return x.id === 'VT'; })[0] || grips()[0];
    if (tv) gripPk.pick(tv);
    stepper('rg', 14); stepper('ll', 14); stepper('pf', 14);
    document.querySelectorAll('input[name=gmode]').forEach(function(r){ r.onchange = function(){ gripMode = r.value; calc(); }; });
    ['q-loft', 'q-putter', 'q-paint', 'q-rush', 'pf-num', 'pf-logo', 'pf-stamp'].forEach(function(id){ g(id).addEventListener('change', calc); });
    ['pf-num', 'pf-logo', 'pf-stamp'].forEach(function(id, i){ var s = g(id); PAINT.forEach(function(c){ s.appendChild(new Option(c, c)); }); s.value = i === 2 ? 'None' : 'White'; });
    g('q-addshaft').onclick = addShaftRow;
    g('q-submit').onclick = function(){ g('q-form').hidden = false; g('f-name').focus(); };
    g('q-form').addEventListener('submit', submit);
    g('q-copy').onclick = function(){ var b = this; try { navigator.clipboard.writeText(last.text).then(function(){ b.textContent = 'Copied'; }); } catch (e) {} };
    g('q-loading').hidden = true; g('q-body').hidden = false;
    calc();
  }
  fetch('/assets/catalog.json').then(function(r){ return r.json(); }).then(start)
    .catch(function(){ g('q-loading').textContent = 'The parts catalog did not load. Refresh the page or text us your quote.'; });
})();
