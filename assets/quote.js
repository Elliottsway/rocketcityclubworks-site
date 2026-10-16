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
  var P = window.RCCWparts, ADAPTERS = P.ADAPTERS, priceFor = P.priceFor;
  var POP_GRIPS = ['VT', 'VTC', 'GP0113', 'GP0125', 'GP0058', 'GP0107', 'WN0161', 'WN0084', 'ST0600'];
  var POP_PUTTER = ['ST0200', 'ST0605', 'ST0607', 'FC0006', 'GP0183'];
  var POP_SHAFTS = ['DGI', 'UDGI', 'FS0028', 'NP0016', 'TT0118', 'TT0223', 'US0124', 'FK0116', 'FK0118', 'MR0104', 'TT0104', 'TT0190', 'MR0119', 'FK0127', 'MR0105'];
  var HEAD_BRANDS = ['TaylorMade', 'Titleist', 'Callaway', 'Ping', 'Cobra', 'Mizuno', 'Srixon', 'PXG', 'Tour Edge', 'Cleveland', 'Wilson', 'Other'];
  function adapterFits(a, type){ return a.use === type || (a.use === 'wood' && (type === 'driver' || type === 'fairway')); }
  var PAINT = ['None', 'White', 'Black', 'Yellow', 'Red', 'Orange', 'Blue', 'Light blue', 'Green', 'Pink', 'Purple', 'Gold', 'Silver'];
  var TYPES = [['driver', 'Driver'], ['fairway', 'Fairway wood'], ['hybrid', 'Hybrid'], ['iron', 'Irons'], ['wedge', 'Wedges']];
  var WOOD = { driver: 1, fairway: 1, hybrid: 1 };

  // ---------- search picker ----------
  // A search box with the results listed right under it. Picking an item shows its option menus
  // (size, color, flex...). The last entry is always "Can't find it? Request it", which takes a
  // free-text description that Jackson prices by hand.
  var squash = function(x){ return String(x).toLowerCase().replace(/[^a-z0-9]+/g, ''); };
  function optSummary(it){
    var o = it.opts || {}, bits = [];
    Object.keys(o).forEach(function(k){ if (o[k].length > 1) bits.push(o[k].length + ' ' + k.toLowerCase() + (/s$/.test(k) ? '' : 's')); });
    return bits.join(', ');
  }
  function Picker(host, opts){
    var self = this; this.items = opts.items; this.sel = null; this.choice = {}; this.onChange = opts.onChange; this.opts = opts; this.req = '';
    var wrap = el('div', 'pk'), lab = el('label', null, opts.label); var inp = el('input'); inp.type = 'search'; inp.autocomplete = 'off'; inp.enterKeyHint = 'search';
    inp.placeholder = opts.placeholder; inp.id = 'pk' + Math.random().toString(36).slice(2, 8); lab.htmlFor = inp.id; inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'false');
    var search = el('div', 'pk-search'), bar = el('div', 'pk-bar'), cancel = el('button', 'pk-change', 'Cancel'); cancel.type = 'button'; cancel.hidden = true;
    var list = el('div', 'pk-list'); list.setAttribute('role', 'listbox'); list.hidden = true; list.id = inp.id + 'l'; inp.setAttribute('aria-controls', list.id);
    var chosen = el('div', 'pk-chosen'); chosen.hidden = true;
    var optsBox = el('div', 'pk-opts');
    bar.appendChild(lab); bar.appendChild(cancel);
    search.appendChild(bar); search.appendChild(inp); search.appendChild(list);
    wrap.appendChild(search); wrap.appendChild(chosen); wrap.appendChild(optsBox); host.appendChild(wrap);
    this.inp = inp; this.list = list; this.chosen = chosen; this.optsBox = optsBox; this.search = search; this.cancel = cancel;
    function item(it){
      var b = el('button', 'pk-item'); b.type = 'button'; b.setAttribute('role', 'option');
      var sum = optSummary(it);
      b.appendChild(el('span', null, it.name)); b.appendChild(el('small', null, [it.brand, it.priceLabel || (it.rows && it.rows.length > 1 ? 'from ' : '') + $(it.price), sum].filter(Boolean).join(' · ')));
      b.onclick = function(){ self.pick(it); }; return b;
    }
    function run(){
      var q = inp.value.trim(), words = q.split(/\s+/).map(squash).filter(Boolean), all = self.items();
      list.textContent = '';
      if (opts.extra) { var ex = el('button', 'pk-item pk-extra', opts.extra.label); ex.type = 'button'; ex.onclick = function(){ self.pick(opts.extra.item); }; list.appendChild(ex); }
      if (!words.length) {
        // Nothing typed yet: offer brands to browse, then the most common picks
        var count = {}; all.forEach(function(it){ if (it.brand) count[it.brand] = (count[it.brand] || 0) + 1; });
        var brands = Object.keys(count).sort(function(a, b){ return count[b] - count[a]; }).slice(0, 10);
        if (brands.length > 1) {
          list.appendChild(el('p', 'pk-head', 'Browse by brand'));
          var bx = el('div', 'pk-brands');
          brands.forEach(function(br){ var c = el('button', null, br); c.type = 'button'; c.onclick = function(){ inp.value = br; run(); inp.focus(); }; bx.appendChild(c); });
          list.appendChild(bx);
        }
        list.appendChild(el('p', 'pk-head', 'Popular'));
        (opts.popular ? all.filter(function(it){ return opts.popular.indexOf(it.id) >= 0; }) : all).slice(0, 8).forEach(function(it){ list.appendChild(item(it)); });
      } else {
        // Every typed word must match the name, brand, part number or an option (color, size, flex)
        var hits = all.filter(function(it){
          var h = squash(it.name + ' ' + it.brand + ' ' + it.id + ' ' + Object.keys(it.opts || {}).map(function(k){ return it.opts[k].join(' '); }).join(' '));
          return words.every(function(w){ return h.indexOf(w) >= 0; });
        });
        hits.slice(0, 40).forEach(function(it){ list.appendChild(item(it)); });
        if (!hits.length) list.appendChild(el('p', 'pk-none', 'Nothing in the price book matches "' + q + '". Request it below and Jackson will check if he can get it.'));
        if (hits.length > 40) list.appendChild(el('p', 'pk-none', (hits.length - 40) + ' more. Keep typing to narrow it down.'));
      }
      var rq = el('button', 'pk-item pk-req'); rq.type = 'button';
      rq.appendChild(el('span', null, "Can't find it? Request a " + opts.noun));
      rq.appendChild(el('small', null, 'Tell us what you want and Jackson will see if he can get it'));
      rq.onclick = function(){ self.pick({ id: 'REQ', name: 'Requested ' + opts.noun, brand: '', price: 0, request: true, opts: {} }, q); };
      list.appendChild(rq);
      list.hidden = false; inp.setAttribute('aria-expanded', 'true');
    }
    this.run = run;
    inp.addEventListener('input', run); inp.addEventListener('focus', run);
    cancel.onclick = function(){ self.closeSearch(); };
  }
  Picker.prototype.closeSearch = function(){
    if (!this.sel) return;
    this.list.hidden = true; this.inp.setAttribute('aria-expanded', 'false'); this.search.hidden = true; this.cancel.hidden = true;
    this.chosen.hidden = false; this.optsBox.hidden = false;
  };
  Picker.prototype.openSearch = function(){
    this.search.hidden = false; this.cancel.hidden = !this.sel; this.chosen.hidden = true; this.optsBox.hidden = true;
    this.inp.value = ''; this.inp.focus(); this.run();
  };
  Picker.prototype.pick = function(it, typed){
    var self = this; this.sel = it; this.choice = {}; this.req = it.request ? (typed || '') : '';
    this.chosen.textContent = '';
    this.chosen.appendChild(el('b', null, it.name)); this.chosen.appendChild(el('span', null, it.own ? '' : it.request ? 'Price TBD' : it.priceLabel || $(it.price)));
    var ch = el('button', 'pk-change', 'Change'); ch.type = 'button'; ch.onclick = function(){ self.openSearch(); }; this.chosen.appendChild(ch);
    this.optsBox.textContent = '';
    if (it.request) {
      var f = el('div', 'pk-reqbox'), id = 'r' + Math.random().toString(36).slice(2, 8), l = el('label', null, 'Which ' + this.opts.noun + '? Brand, model, ' + this.opts.reqHint); l.htmlFor = id;
      var t = el('input'); t.id = id; t.value = this.req; t.placeholder = this.opts.reqExample; t.maxLength = 160;
      t.oninput = function(){ self.req = t.value; self.onChange(); };
      f.appendChild(l); f.appendChild(t); f.appendChild(el('p', 'fine-sm', 'Jackson checks his suppliers and adds the price before you approve anything.'));
      this.optsBox.appendChild(f); this.optsBox.style.gridTemplateColumns = '1fr';
      this.closeSearch(); this.onChange(); setTimeout(function(){ t.focus(); }, 0); return;
    }
    this.optsBox.style.gridTemplateColumns = '';
    Object.keys(it.opts || {}).forEach(function(name){
      var f = el('div', 'pk-opt'), id = 'o' + Math.random().toString(36).slice(2, 8), l = el('label', null, name); l.htmlFor = id;
      var s = el('select'); s.id = id; it.opts[name].forEach(function(v){ s.appendChild(new Option(v, v)); });
      self.choice[name] = it.opts[name][0];
      s.onchange = function(){ self.choice[name] = s.value; self.onChange(); };
      f.appendChild(l); f.appendChild(s); self.optsBox.appendChild(f);
    });
    this.closeSearch(); this.onChange();
  };
  Picker.prototype.isRequest = function(){ return !!(this.sel && this.sel.request); };
  Picker.prototype.price = function(){ return !this.sel || this.sel.own || this.sel.request ? 0 : priceFor(this.sel, this.choice); };
  Picker.prototype.desc = function(){
    if (!this.sel) return '';
    if (this.sel.request) return 'Requested ' + this.opts.noun + ': ' + (this.req.trim() || '(not described yet)');
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

  // ---------- custom builds: head + shaft + grip + build labor ----------
  var HEADS = [], buildRows = [];
  var BTYPES = [['driver', 'Driver'], ['fairway', 'Fairway wood'], ['hybrid', 'Hybrid'], ['utility', 'Utility / driving iron'], ['irons', 'Iron set'], ['wedge', 'Wedge'], ['putter', 'Putter']];
  var SHAFT_USE = { driver: 'driver', fairway: 'fairway', hybrid: 'hybrid', utility: 'iron', irons: 'iron', wedge: 'wedge', putter: 'putter' };
  var DEFAULT_SET = ['5', '6', '7', '8', '9', 'PW'];
  function leadText(l){ return l ? (l[0] === l[1] ? l[0] : l[0] + '–' + l[1]) + ' business days for the head' : ''; }
  function addBuildRow(){
    var row = { type: 'driver', clubs: [], hand: 'RH' }, box = el('div', 'srow card');
    var top = el('div', 'srow-top'), tl = el('label', null, 'Club'), ts = el('select'); var tid = 'bt' + Math.random().toString(36).slice(2, 7); tl.htmlFor = tid; ts.id = tid;
    BTYPES.forEach(function(t){ ts.appendChild(new Option(t[1], t[0])); });
    var tw = el('div'); tw.appendChild(tl); tw.appendChild(ts); top.appendChild(tw);
    var hw = el('div'), hl = el('label', null, 'Hand'), hs = el('select'); var hid = 'bh' + Math.random().toString(36).slice(2, 7); hl.htmlFor = hid; hs.id = hid;
    hs.appendChild(new Option('Right-handed', 'RH')); hs.appendChild(new Option('Left-handed', 'LH')); hw.appendChild(hl); hw.appendChild(hs); top.appendChild(hw);
    box.appendChild(top);
    var headHost = el('div'), clubsBox = el('div'), lead = el('p', 'lead'), shaftHost = el('div'), gripHost = el('div');
    box.appendChild(headHost); box.appendChild(clubsBox); box.appendChild(lead); box.appendChild(shaftHost); box.appendChild(gripHost);
    var rm = el('button', 'pk-change', 'Remove'); rm.type = 'button'; box.appendChild(rm);
    function onHead(){
      var h = row.head.sel; clubsBox.textContent = ''; row.clubs = [];
      if (h && !h.request && h.type === 'irons' && h.clubs) {
        clubsBox.appendChild(el('label', null, 'Which clubs?')); var cw = el('div', 'clubs');
        h.clubs.forEach(function(c){ var l = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.value = c; cb.checked = DEFAULT_SET.indexOf(c) >= 0;
          cb.onchange = function(){ row.clubs = [].filter.call(cw.querySelectorAll('input'), function(x){ return x.checked; }).map(function(x){ return x.value; }); calc(); };
          l.appendChild(cb); l.appendChild(document.createTextNode(c)); cw.appendChild(l); });
        clubsBox.appendChild(cw); row.clubs = h.clubs.filter(function(c){ return DEFAULT_SET.indexOf(c) >= 0; });
      }
      if (h && h.hands) { [].forEach.call(hs.options, function(o){ o.disabled = h.hands.indexOf(o.value) < 0; }); if (h.hands.indexOf(hs.value) < 0) { hs.value = h.hands[0]; row.hand = hs.value; } }
      lead.textContent = !h || h.request ? '' : h.basis === 'oem'
        ? 'Jackson finds a genuine new or like-new ' + h.brand + ' head with these specs and sends you the price to approve. New retail for comparison: ' + $(h.ref) + (h.type === 'irons' ? ' per club' : '') + '. To start the search he asks for a refundable sourcing deposit (10% of the estimate, $25–$75) that counts toward your build, and reports back within 48 hours. Usually about 1–2 weeks in all.'
        : leadText(h.lead) + (h.note ? ' · ' + h.note : '');
      calc();
    }
    row.head = new Picker(headHost, { label: 'Head', placeholder: 'Search heads: brand or model (e.g. Ping G440, Titleist T150)', noun: 'club head', reqHint: 'loft and anything else', reqExample: 'e.g. Titleist GT3 driver 9°, TSR3 SureFit', onChange: function(){ onHead(); },
      items: function(){ return HEADS.filter(function(h){ return h.type === row.type; }); } });
    row.shaft = new Picker(shaftHost, { label: 'Shaft', placeholder: 'Type a brand or model (e.g. Ventus, Dynamic Gold)', noun: 'shaft', reqHint: 'flex and weight', reqExample: 'e.g. Fujikura Ventus TR Blue 6-S', popular: POP_SHAFTS, onChange: calc,
      items: function(){ var u = SHAFT_USE[row.type]; return CAT.shafts.filter(function(x){ return !x.use.length || x.use.indexOf(u) >= 0 || (u === 'wedge' && x.use.indexOf('iron') >= 0); }); } });
    row.grip = new Picker(gripHost, { label: 'Grip', placeholder: 'Type a brand, model or color (e.g. Tour Velvet, MCC)', noun: 'grip', reqHint: 'size and color', reqExample: 'e.g. Golf Pride MCC, midsize', popular: row.type === 'putter' ? POP_PUTTER : POP_GRIPS, onChange: calc,
      items: function(){ return CAT.grips.filter(function(x){ return row.type === 'putter' ? x.putter : !x.putter; }); } });
    var tv = CAT.grips.filter(function(x){ return x.id === 'VT'; })[0]; if (tv) row.grip.pick(tv);
    ts.onchange = function(){ row.type = ts.value; row.head.sel = null; row.head.openSearch(); row.shaft.sel = null; row.shaft.chosen.hidden = true; row.shaft.optsBox.textContent = ''; row.shaft.search.hidden = false; clubsBox.textContent = ''; lead.textContent = '';
      var g2 = CAT.grips.filter(function(x){ return row.type === 'putter' ? x.putter : x.id === 'VT'; })[0]; if (g2) row.grip.pick(g2); calc(); };
    hs.onchange = function(){ row.hand = hs.value; calc(); };
    rm.onclick = function(){ buildRows.splice(buildRows.indexOf(row), 1); box.remove(); calc(); };
    buildRows.push(row); g('q-builds').appendChild(box); calc();
  }

  function addShaftRow(){
    var row = { n: 1, type: 'iron', adapter: null, brand: '', model: '', adapterReq: '', hand: 'RH' }, box = el('div', 'srow card');
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
    // Club head: brand + model, so Jackson can confirm the shaft tip and adapter fit the head
    var hd = el('div', 'head2');
    var hbW = el('div'), hbl = el('label', null, 'Club head brand'), hb = el('select'); var hbid = 'hb' + Math.random().toString(36).slice(2, 7); hbl.htmlFor = hbid; hb.id = hbid;
    hb.appendChild(new Option('Choose…', '')); HEAD_BRANDS.forEach(function(x){ hb.appendChild(new Option(x, x)); });
    hbW.appendChild(hbl); hbW.appendChild(hb);
    var hmW = el('div'), hml = el('label', null, 'Head model'), hm = el('input'); var hmid = 'hm' + Math.random().toString(36).slice(2, 7); hml.htmlFor = hmid; hm.id = hmid; hm.maxLength = 80;
    hm.placeholder = 'e.g. Qi10 LS driver, 9°';
    hmW.appendChild(hml); hmW.appendChild(hm); hd.appendChild(hbW); hd.appendChild(hmW);
    // Adapter (woods and hybrids only)
    var adW = el('div', 'pk-reqbox'); var al = el('label', null, 'Adapter (the sleeve that screws into the head)'), as = el('select'); var aid = 'ad' + Math.random().toString(36).slice(2, 7); al.htmlFor = aid; as.id = aid;
    var afits = el('p', 'fine-sm'); var aother = el('input'); aother.maxLength = 120; aother.placeholder = 'Which adapter or head? e.g. Tour Edge C723 driver'; aother.hidden = true; aother.setAttribute('aria-label', 'Describe the adapter you need');
    var ahand = el('select'); ahand.appendChild(new Option('Right-handed', 'RH')); ahand.appendChild(new Option('Left-handed', 'LH')); ahand.setAttribute('aria-label', 'Adapter hand'); ahand.hidden = true;
    adW.appendChild(al); adW.appendChild(as); adW.appendChild(ahand); adW.appendChild(aother); adW.appendChild(afits);
    function fillAdapters(){
      var keep = as.value; as.textContent = '';
      as.appendChild(new Option('Keep my current adapter (no charge)', 'keep'));
      var list = ADAPTERS.filter(function(a){ return (!row.brand || row.brand === 'Other' || a.brand === row.brand) && adapterFits(a, row.type); });
      var groups = {}; list.forEach(function(a){ (groups[a.brand] = groups[a.brand] || []).push(a); });
      Object.keys(groups).forEach(function(br){
        var og = document.createElement('optgroup'); og.label = br;
        groups[br].forEach(function(a){ og.appendChild(new Option('New ' + a.name + ' · ' + $(a.price), a.id)); });
        as.appendChild(og);
      });
      as.appendChild(new Option(row.brand && !list.length ? 'New ' + row.brand + ' adapter: request it (price TBD)' : 'Other adapter: request it (price TBD)', 'other'));
      as.value = [].some.call(as.options, function(o){ return o.value === keep; }) ? keep : 'keep';
      adapterChanged();
    }
    function adapterChanged(){
      var v = as.value, a = ADAPTERS.filter(function(x){ return x.id === v; })[0];
      row.adapter = v === 'keep' ? null : v === 'other' ? { request: true } : a;
      aother.hidden = v !== 'other'; ahand.hidden = v === 'keep';
      afits.textContent = a ? 'Fits: ' + a.fits + '. Jackson confirms it matches your head before ordering.' : v === 'other' ? 'Jackson checks if he can get the right one and adds the price before you approve.' : '';
      calc();
    }
    hb.onchange = function(){ row.brand = hb.value; fillAdapters(); calc(); };
    hm.oninput = function(){ row.model = hm.value; calc(); };
    as.onchange = adapterChanged; aother.oninput = function(){ row.adapterReq = aother.value; calc(); };
    ahand.onchange = function(){ row.hand = ahand.value; calc(); };
    box.appendChild(hd); box.appendChild(adW); box.appendChild(rm);
    row.pk = new Picker(pkHost, { label: 'Shaft', placeholder: 'Type a brand or model (e.g. Ventus, Dynamic Gold)', onChange: calc,
      items: function(){ return CAT.shafts.filter(function(s){ return !s.use.length || s.use.indexOf(row.type) >= 0; }); },
      noun: 'shaft', reqHint: 'flex and weight', reqExample: 'e.g. Fujikura Ventus TR Blue 6-S', popular: POP_SHAFTS,
      extra: { label: 'Use my own shaft (labor only)', item: { id: 'OWN', name: 'My own shaft', brand: '', price: 0, own: true, opts: {} } } });
    ts.onchange = function(){ row.type = ts.value; adW.hidden = !WOOD[row.type]; fillAdapters(); };
    mi.onclick = function(){ row.n = Math.max(1, row.n - 1); out.textContent = row.n; calc(); };
    pl.onclick = function(){ row.n = Math.min(14, row.n + 1); out.textContent = row.n; calc(); };
    rm.onclick = function(){ shaftRows.splice(shaftRows.indexOf(row), 1); box.remove(); calc(); };
    adW.hidden = !WOOD[row.type]; fillAdapters();
    row.box = box; shaftRows.push(row); g('q-shafts').appendChild(box); calc();
  }

  // ---------- pricing ----------
  var last = null;
  function calc(){
    if (!gripPk) return;
    var lines = [], msg = [], saves = [];
    var tbd = false;
    function add(desc, qty, unit, kind, taxable, off, req, partNo){ lines.push({ desc: req ? desc + ' (Jackson to price)' : desc, qty: qty, unit_cents: Math.round(unit * 100), kind: kind, taxable: !!taxable, off: !!off, tbd: !!req, part_no: partNo || null }); }
    var ordered = gripMode === 'order';
    g('q-grippick').hidden = !ordered || q.rg === 0;
    // Regrip
    var per = ordered ? R.regripOurs : R.regripOwn, cap = ordered ? R.regripOursBag : R.regripOwnBag, need = atCap(per, cap);
    var fullBag = q.rg >= need, launchBag = false, parts = 0;
    if (q.rg > 0) {
      add('Regrip labor, ' + q.rg + ' club' + (q.rg > 1 ? 's' : '') + (fullBag ? ' (full bag)' : ''), 1, bundle(q.rg, per, cap, R.bagMax), 'labor');
      if (ordered && gripPk.sel) { var gp = gripPk.price(); add(gripPk.desc(), q.rg, gp, 'part', true, false, gripPk.isRequest(), gripPk.sel.id); parts += gp * q.rg; if (gripPk.isRequest()) tbd = true; }
      msg.push('Regrip ' + q.rg + ' club' + (q.rg > 1 ? 's' : '') + ': ' + (ordered ? (gripPk.sel ? gripPk.desc() : 'grip not picked yet') : 'my own grips'));
      if (ordered && fullBag && S.launchLive) { launchBag = true; add('Launch full-bag price', 1, -(R.regripOursBag - B.launchBag.price), 'discount', false, true); saves.push('Launch full-bag price'); }
    }
    var nudge = g('n-rg'); var nn = need - q.rg;
    nudge.hidden = !(q.rg > 0 && nn > 0 && nn <= 4); nudge.textContent = nudge.hidden ? '' : 'Add ' + nn + ' more club' + (nn > 1 ? 's' : '') + ' and the full-bag price kicks in: up to 14 clubs for ' + $(ordered && S.launchLive ? B.launchBag.price : cap) + '.';
    // Putter
    var putter = g('q-putter').checked; g('q-putterpick').hidden = !putter;
    if (putter) {
      add('Putter grip install', 1, R.putterGrip, 'labor');
      if (putterPk.sel && !putterPk.sel.own) { var pp = putterPk.price(); add(putterPk.desc(), 1, pp, 'part', true, false, putterPk.isRequest(), putterPk.sel.id); parts += pp; if (putterPk.isRequest()) tbd = true; }
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
      var head = [r.brand, r.model.trim()].filter(Boolean).join(' ');
      if (s && !s.own) { var sp = r.pk.price(); add(r.pk.desc(), r.n, sp, 'part', true, false, r.pk.isRequest(), s.id); parts += sp * r.n; if (r.pk.isRequest()) tbd = true; }
      var ad = WOOD[r.type] && r.adapter, hand = r.hand === 'LH' ? ', left-handed' : '';
      var adDesc = !ad ? '' : ad.request ? 'Requested adapter: ' + (r.adapterReq.trim() || (head || 'not described yet')) + hand : ad.name + ' (' + ad.id + hand + ')';
      if (ad) { add(adDesc + (head && !ad.request ? ' for ' + head : ''), r.n, ad.request ? 0 : ad.price, 'part', true, false, !!ad.request, ad.request ? null : ad.id); if (ad.request) tbd = true; else parts += ad.price * r.n; }
      msg.push('Reshaft ' + r.n + ' ' + label.toLowerCase() + (head ? ' (' + head + ')' : '') + ': ' + (s ? r.pk.desc() : 'shaft not picked yet') + (!adDesc ? (WOOD[r.type] ? ' + keep current adapter' : '') : ad.request ? ' + ' + adDesc : ' + new ' + adDesc));
    });
    var rs = g('n-rs'), need6 = R.ironSetMin - irons;
    rs.hidden = !(irons > 0 && need6 > 0 && need6 <= 3); rs.textContent = rs.hidden ? '' : 'Add ' + need6 + ' more iron' + (need6 > 1 ? 's' : '') + ' for set pricing: ' + $(R.ironSetSteel) + ' steel, ' + $(R.ironSetGraphite) + ' graphite per club.';
    // Custom builds
    var buildLead = 0, buildClubs = 0, buildIrons = 0;
    buildRows.forEach(function(r){ if (r.type === 'irons' || r.type === 'wedge') buildIrons += r.type === 'irons' ? r.clubs.length || 1 : 1; });
    buildRows.forEach(function(r){
      var h = r.head.sel, n = r.type === 'irons' ? (h && !h.request && h.clubs ? r.clubs.length : 7) : 1;
      if (!n) return;
      var label = BTYPES.filter(function(t){ return t[0] === r.type; })[0][1], hand = r.hand === 'LH' ? ', left-handed' : '';
      var clubs = r.type === 'irons' && r.clubs.length ? ' (' + r.clubs.join(', ') + ')' : '';
      if (h) {
        var quoteHead = h.request || h.basis === 'oem', hp = quoteHead ? 0 : r.head.price();
        add(r.head.desc() + (h.type === 'irons' && !h.request ? clubs : '') + hand + (h.basis === 'oem' ? ' · head sourced new/like-new (new retail ' + $(h.ref) + (n > 1 ? '/club' : '') + ')' : ''), n, hp, 'part', true, false, quoteHead, h.request ? null : h.id);
        if (!quoteHead) parts += hp * n; else tbd = true;
        if (h.lead && h.lead[1] > buildLead) buildLead = h.lead[1];
      }
      var s = r.shaft.sel;
      if (s && !s.own) { var sp = r.shaft.price(); add(r.shaft.desc(), n, sp, 'part', true, false, r.shaft.isRequest(), s.id); parts += sp * n; if (r.shaft.isRequest()) tbd = true; }
      var gsel = r.grip.sel;
      if (gsel && !gsel.own) { var gp2 = r.grip.price(); add(r.grip.desc(), n, gp2, 'part', true, false, r.grip.isRequest(), gsel.id); parts += gp2 * n; if (r.grip.isRequest()) tbd = true; }
      var wood = WOOD[r.type], graphite = s && s.material === 'graphite';
      var each = wood ? R.reshaftWood : r.type === 'putter' ? R.reshaftSteel : buildIrons >= R.ironSetMin ? (graphite ? R.ironSetGraphite : R.ironSetSteel) : (graphite ? R.reshaftGraphite : R.reshaftSteel);
      add('Custom build labor, ' + label.toLowerCase() + (buildIrons >= R.ironSetMin && !wood && r.type !== 'putter' ? ' (set price)' : ''), n, each, 'labor');
      buildClubs += n;
      msg.push('Build ' + n + ' ' + label.toLowerCase() + ': ' + (h ? r.head.desc() + clubs + hand : 'head not picked yet') + ' · shaft: ' + (s ? r.shaft.desc() : 'not picked') + ' · grip: ' + (gsel ? r.grip.desc() : 'not picked'));
    });
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
    var partsOrdered = parts > 0 || tbd;
    g('q-parts').hidden = !partsOrdered;
    var rush = partsOrdered && g('q-rush').checked;
    if (partsOrdered) {
      if (rush) { add('Rush: overnight parts', 1, R.rush, 'fee'); msg.push('Rush overnight parts'); }
      else if (parts >= R.partsFreeOver) add('Parts fee (free at $' + R.partsFreeOver + '+ in parts)', 1, 0, 'fee');
      else add('Parts fee', 1, R.partsFee, 'fee');
    }
    var anyWork = lines.length > 0;
    var ready = !anyWork ? '—' : buildClubs ? (buildLead > 4 ? 'About ' + (buildLead + 2) + ' business days (head lead time)' : '4–6 business days') : !partsOrdered ? 'Next day' : rush ? 'About ' + R.rushDays : irons >= R.ironSetMin ? '4–5 business days' : shaftCount ? '3–5 business days' : R.partsDays;
    var total = r2(lines.reduce(function(s, l){ return s + l.qty * l.unit_cents; }, 0) / 100);

    var box = g('q-lines'); box.textContent = '';
    if (!anyWork) box.appendChild(el('p', 'empty', 'Add clubs to see your price.'));
    lines.forEach(function(l){
      var d = el('div', 'ln' + (l.off ? ' off' : '') + (l.tbd ? ' tbd' : ''));
      d.appendChild(el('span', null, l.qty > 1 ? l.desc + ' × ' + l.qty : l.desc));
      var amt = l.qty * l.unit_cents / 100;
      d.appendChild(el('span', null, l.tbd ? 'Price TBD' : amt === 0 ? 'Free' : (amt < 0 ? '−' : '') + $(Math.abs(r2(amt)))));
      box.appendChild(d);
    });
    g('q-total').textContent = $(total) + (tbd ? ' + TBD' : '');
    g('q-ready').textContent = ready;
    g('q-submit').disabled = !anyWork;

    var text = ['Hi Jackson! Quote from the website:'].concat(msg.map(function(m){ return '• ' + m; }));
    if (saves.length) text.push('Deals: ' + saves.join(', '));
    text.push('Estimate: ' + $(total) + (tbd ? ' + requested parts to price' : ''), 'Ready in: ' + ready, '(' + S.ref + ')');
    last = { lines: lines.map(function(l){ return { desc: l.desc, qty: l.qty, unit_cents: l.unit_cents, kind: l.kind, taxable: l.taxable, part_no: l.part_no && l.part_no !== 'REQ' ? l.part_no : null }; }), total_label: $(total) + (tbd ? ' + TBD' : ''), summary: msg.concat(saves.length ? ['Deals: ' + saves.join(', ')] : []).concat(['Ready in: ' + ready]), text: anyWork ? text.join('\n') : "Hi Jackson! I'd like a quote. (" + S.ref + ')' };
  }

  // ---------- submit as a service ticket (needs a customer account) ----------
  var me = null;
  function openSubmit(){
    if (!me) {
      // Save the quote, then sign in / create an account; the account page submits it.
      try { localStorage.setItem('rccw_pending_quote', JSON.stringify({ lines: last.lines, summary: last.summary, total_label: last.total_label, ref: S.ref, note: '' })); } catch (e) {}
      location.href = '/account/?next=' + encodeURIComponent('/account/');
      return;
    }
    g('q-form').hidden = false; g('q-submit').hidden = true; g('f-note').focus();
  }
  function submit(e){
    e.preventDefault();
    var out = g('q-fout'), btn = g('q-form').querySelector('button[type=submit]');
    btn.disabled = true; out.className = 'fine'; out.textContent = 'Sending…';
    fetch('/api/tickets', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'quote', lines: last.lines, summary: last.summary, note: g('f-note').value, ref: S.ref }) })
      .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function(x){
        if (x.status === 401) { me = null; btn.disabled = false; return openSubmit(); }
        if (!x.ok) { out.className = 'err'; out.textContent = x.j.error || 'Something went wrong.'; btn.disabled = false; return; }
        location.href = '/ticket/?t=' + encodeURIComponent(x.j.id) + '&new=1';
      })
      .catch(function(){ out.className = 'err'; out.textContent = 'Could not reach the shop. Check your connection and try again.'; btn.disabled = false; });
  }

  // ---------- start ----------
  function start(cat){
    CAT = cat;
    var grips = function(){ return CAT.grips.filter(function(x){ return !x.putter; }); };
    gripPk = new Picker(g('q-grippick'), { label: 'Grip', placeholder: 'Type a brand, model or color (e.g. Tour Velvet, MCC, red)', items: grips, onChange: calc,
      noun: 'grip', reqHint: 'size and color', reqExample: 'e.g. Golf Pride MCC Teams, midsize, Alabama crimson', popular: POP_GRIPS });
    putterPk = new Picker(g('q-putterpick'), { label: 'Putter grip', placeholder: 'Search putter grips (e.g. SuperStroke, Pistol)', onChange: calc,
      items: function(){ return CAT.grips.filter(function(x){ return x.putter; }); },
      noun: 'putter grip', reqHint: 'size and color', reqExample: 'e.g. SuperStroke Traxion Tour 2.0, black/red', popular: POP_PUTTER,
      extra: { label: 'Use my own putter grip', item: { id: 'OWN', name: 'My own putter grip', brand: '', price: 0, own: true, opts: {} } } });
    var tv = grips().filter(function(x){ return x.id === 'VT'; })[0] || grips()[0];
    if (tv) gripPk.pick(tv);
    stepper('rg', 14); stepper('ll', 14); stepper('pf', 14);
    document.querySelectorAll('input[name=gmode]').forEach(function(r){ r.onchange = function(){ gripMode = r.value; calc(); }; });
    ['q-loft', 'q-putter', 'q-paint', 'q-rush', 'pf-num', 'pf-logo', 'pf-stamp'].forEach(function(id){ g(id).addEventListener('change', calc); });
    ['pf-num', 'pf-logo', 'pf-stamp'].forEach(function(id, i){ var s = g(id); PAINT.forEach(function(c){ s.appendChild(new Option(c, c)); }); s.value = i === 2 ? 'None' : 'White'; });
    g('q-addshaft').onclick = addShaftRow;
    fetch('/assets/heads.json').then(function(r){ return r.json(); }).then(function(j){ HEADS = j.heads.map(function(h){ h.name = h.brand + ' ' + h.model; if (h.basis === 'oem') { h.ref = h.price; h.priceLabel = 'New ' + $(h.price) + (h.type === 'irons' ? '/club' : '') + ' · we quote'; } return h; }); g('q-buildgrp').hidden = false; g('q-addbuild').onclick = addBuildRow; }).catch(function(){});
    g('q-submit').onclick = openSubmit;
    g('q-form').addEventListener('submit', submit);
    g('q-copy').onclick = function(){ var b = this; try { navigator.clipboard.writeText(last.text).then(function(){ b.textContent = 'Copied'; }); } catch (e) {} };
    fetch('/api/me', { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      me = j && j.customer; g('q-acct').hidden = !!me;
      if (me) g('f-who').textContent = 'Sending as ' + me.name + ' · ' + me.email;
    }).catch(function(){ g('q-acct').hidden = false; });
    g('q-loading').hidden = true; g('q-body').hidden = false;
    calc();
  }
  fetch('/assets/catalog.json').then(function(r){ return r.json(); }).then(start)
    .catch(function(){ g('q-loading').textContent = 'The parts catalog did not load. Refresh the page to try again.'; });
})();
