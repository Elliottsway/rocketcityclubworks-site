/* Parts data and pricing shared by the instant price (menu) and Jackson's dashboard.
   Retail prices only. Never put trade cost or margin here: the repo and the site are public. */
(function(){
  // Shaft adapters (sleeves) from the GolfWorks 2026 booklet, retail. "fits" is the head list GolfWorks gives;
  // customers also name their head so Jackson can confirm the sleeve before ordering.
  var ADAPTERS = [
    { brand: 'TaylorMade', id: 'TM0023', name: 'TaylorMade driver/fairway adapter', fits: 'Qi10, Stealth, SIM, M1–M6, R15, SLDR', use: 'wood', price: 24.99 },
    { brand: 'TaylorMade', id: 'TM0030', name: 'TaylorMade Rescue adapter', fits: 'Stealth, SIM2, GAPR, M1, M3, R15, RBZ Rescue', use: 'hybrid', price: 22.99 },
    { brand: 'TaylorMade', id: 'BB9054', name: 'TaylorMade R1 driver adapter (GolfWorks)', fits: 'R1 driver', use: 'driver', price: 19.99 },
    { brand: 'Titleist', id: 'BB9058', name: 'Titleist SureFit adapter (GolfWorks)', fits: '913 & 915 drivers, 910 driver & fairways', use: 'wood', price: 19.99 },
    { brand: 'Callaway', id: 'CA0020', name: 'Callaway Opti-Fit driver/fairway adapter', fits: 'Most Callaway adjustable drivers & fairways', use: 'wood', price: 26.99 },
    { brand: 'Callaway', id: 'CA0029', name: 'Callaway OptiFit 4 fairway adapter (2026+)', fits: 'Quantum and 2026+ fairways', use: 'fairway', price: 26.99 },
    { brand: 'Callaway', id: 'CA0024', name: 'Callaway Epic Flash fairway adapter', fits: 'Epic Flash & Epic Flash Sub Zero fairways', use: 'fairway', price: 26.99 },
    { brand: 'Callaway', id: 'CA0025', name: 'Callaway Opti-Fit hybrid adapter', fits: 'Callaway adjustable hybrids', use: 'hybrid', price: 26.99 },
    { brand: 'Callaway', id: 'CA0021', name: 'Callaway Big Bertha Alpha hybrid adapter', fits: 'Big Bertha Alpha hybrids', use: 'hybrid', price: 26.99 },
    { brand: 'Ping', id: 'PGC016', name: 'Ping G440 driver/fairway adapter', fits: 'G440 drivers & fairways', use: 'wood', price: 26.99 },
    { brand: 'Ping', id: 'PGC017', name: 'Ping G440 hybrid adapter', fits: 'G440 hybrids', use: 'hybrid', price: 26.99 },
    { brand: 'Ping', id: 'PGC005', name: 'Ping G410/G425/G430 driver/fairway adapter', fits: 'G410, G425, G430 drivers & fairways', use: 'wood', price: 26.99 },
    { brand: 'Ping', id: 'PGC006', name: 'Ping G410/G425/G430 hybrid adapter', fits: 'G410, G425, G430 hybrids', use: 'hybrid', price: 26.99 },
    { brand: 'Ping', id: 'PGC002', name: 'Ping G-series adapter', fits: 'G30, G, G400 and earlier adjustable Ping heads', use: 'wood', price: 26.99 },
    { brand: 'Cobra', id: 'CB9042', name: 'Cobra FutureFit33 driver/fairway adapter', fits: 'FutureFit33 drivers & fairways', use: 'wood', price: 28.99 },
    { brand: 'Cobra', id: 'CB9043', name: 'Cobra FutureFit33 hybrid adapter', fits: 'FutureFit33 hybrids', use: 'hybrid', price: 28.99 },
    { brand: 'Cobra', id: 'CB9040', name: 'Cobra driver/fairway adapter (.335)', fits: 'MyFly-era Cobra drivers & fairways', use: 'wood', price: 28.99 },
    { brand: 'Cobra', id: 'CB9041', name: 'Cobra hybrid adapter', fits: 'MyFly-era Cobra hybrids', use: 'hybrid', price: 28.99 },
    { brand: 'Mizuno', id: 'BB9133', name: 'Mizuno ST-Z / ST-G driver adapter (GolfWorks)', fits: 'ST-series drivers', use: 'driver', price: 21.99 },
    { brand: 'Mizuno', id: 'BB9072', name: 'Mizuno Quick Switch adapter (GolfWorks)', fits: 'JPX 850 driver', use: 'driver', price: 19.99 },
    { brand: 'Srixon', id: 'SG1004', name: 'Srixon ZXi adapter (.335)', fits: 'ZXi drivers & fairways', use: 'wood', price: 26.99 },
    { brand: 'PXG', id: 'PX0001', name: 'PXG driver/fairway adapter', fits: 'PXG drivers & fairways', use: 'wood', price: 30.00 },
    { brand: 'PXG', id: 'PX0002', name: 'PXG hybrid adapter', fits: 'PXG hybrids', use: 'hybrid', price: 30.00 }
  ];
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

  window.RCCWparts = { ADAPTERS: ADAPTERS, priceFor: priceFor };
})();
