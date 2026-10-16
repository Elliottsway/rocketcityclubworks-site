/* Rocket City ClubWorks price list: the ONE place prices live.
   The home page, the /menu page and the quote builder all read from here.
   Numbers are customer prices. Never put trade cost or margin in this file:
   the repo and the site are public.

   price: a number shows as $5 or $7.19; a string shows as written ("Quote", "Free", "from $20").
   Nothing is stocked: grips and parts are ordered from GolfWorks per job and arrive in ~2 business days. */
window.RCCW = {
  asOf: "October 2026",
  phone: "+12055889164",
  phoneLabel: "(205) 588-9164",
  email: "jackson@rocketcityclubworks.com",

  // Labor rules used by the quote builder and the "popular jobs" prices.
  // Labor is where the shop earns: parts sell at GolfWorks retail, only 6-14% over trade cost.
  rules: {
    regripOurs: 5,      // per club, grips ordered for the customer (same labor either way)
    regripOursBag: 50,  // full bag, grips ordered
    regripOwn: 5,       // per club, customer's own grips
    regripOwnBag: 50,   // full bag, customer's own grips
    bagMax: 14,         // clubs covered by a full-bag price
    putterGrip: 5,
    loftCheck: 15,      // check only, up to 14 clubs
    loftPer: 5,         // check and adjust, per club
    loftSet: 50,        // check and adjust a set
    loftSetMax: 12,
    reshaftSteel: 20,
    reshaftGraphite: 25,
    reshaftWood: 25,
    ironSetMin: 6,      // reshaft this many irons/wedges or more for set pricing
    ironSetSteel: 17,   // 6 x $17 = $102, never less than 5 x $20
    ironSetGraphite: 22,
    shorten: 10,        // per club (keep in step with the Repairs list below)
    extend: 15,         // per club, + extension piece
    looseHead: 20,      // re-epoxy + new ferrule
    stampFrom: 20,
    paintPer: 8,
    paintSet: 60,       // up to 10 clubs
    partsFee: 10,       // per order of special-order parts (covers GolfWorks ground shipping)
    partsFreeOver: 100, // parts fee waived when parts total this much or more
    rush: 25,           // overnight parts; replaces the parts fee
    partsDays: "3–4 business days",
    rushDays: "2 business days"
  },

  services: [
    { id: "regrip", title: "Regripping", items: [
      { name: "Regrip, per club", note: "Your grips or ours · + grip if we order it", price: 5 },
      { name: "Full bag, up to 14 clubs", note: "Your grips or ours · + grips if we order them", price: 50 },
      { name: "Putter grip install", note: "+ grip if we order it", price: 5 },
      { name: "Build-up wraps & logo alignment", price: "Free" },
      { name: "Parts fee, grips & parts we order", note: "Per order · free when parts total $100+", price: 10 }
    ]},
    { id: "loft", title: "Loft & lie", items: [
      { name: "Check only", note: "Irons & wedges, up to 14 clubs", price: 15 },
      { name: "Check & adjust", note: "Per club", price: 5 },
      { name: "Check & adjust a set", note: "Up to 12 clubs", price: 50 }
    ]},
    { id: "shafts", title: "Shafts & builds", items: [
      { name: "Reshaft iron or wedge, steel", note: "+ shaft, ferrule & grip", price: 20 },
      { name: "Reshaft iron or wedge, graphite", note: "+ shaft, ferrule & grip", price: 25 },
      { name: "Iron set reshaft, 6+ clubs", note: "Per club · steel $17, graphite $22", price: "from $17" },
      { name: "Reshaft driver, wood or hybrid", note: "+ shaft & grip · + adapter if new", price: 25 },
      { name: "Install or move an adapter", note: "Your shaft · + adapter if new", price: 20 },
      { name: "Custom club build", note: "+ heads, shafts, grips & ferrules", price: "Quote" }
    ]},
    { id: "repairs", title: "Repairs", items: [
      { name: "Shorten a club", note: "Grip saved when possible · + grip if not", price: 10 },
      { name: "Extend a club", note: "+ extension & grip", price: 15 },
      { name: "Loose head or rattle", note: "Re-epoxied, new ferrule included", price: 20 },
      { name: "Broken club repair", note: "Priced once we see the break", price: "Quote" },
      { name: "Custom ferrules, per club", note: "+ ferrule · $5 with a reshaft or build", price: 15 }
    ]},
    { id: "personal", title: "Paint fill & stamping", items: [
      { name: "Paint fill, per club", note: "Set of up to 10 $60 · paint included", price: 8 },
      { name: "Custom stamping", note: "Initials, numbers or short text", price: "from $20" }
    ]},
    { id: "tradein", title: "Trade-in", items: [
      { name: "Trade in shafts, adapters & heads", note: "Credit toward any service", price: "Quote" },
      { name: "Pre-owned shafts & adapters", note: "Lower-cost repair option, when available", price: "Quote" }
    ]}
  ],

  turnaround: [
    { big: "Next day", small: "Your own grips, loft & lie, most repairs" },
    { big: "3–4 days", small: "Grips & parts we order (2 days to arrive)" },
    { big: "Rush 2 days", small: "Overnight parts, $25 instead of $10" }
  ],

  // Sorted cheapest first. Shown with installed price (grip + labor) on the menu. All ordered per job.
  grips: [
    { name: "SuperStroke Crossline 2.0", price: 6.19 },
    { name: "Golf Pride Tour Velvet", note: "Standard or midsize", price: 7.19 },
    { name: "Golf Pride Tour Velvet Plus4", price: 7.19 },
    { name: "Ping ID8", price: 7.99 },
    { name: "Winn Dri-Tac Wrap", price: 8.99 },
    { name: "Winn Dri-Tac", note: "Standard", price: 9.79 },
    { name: "Golf Pride CP2 Wrap / CP2 Pro", price: 11.19 },
    { name: "Golf Pride Tour Wrap 2G", price: 11.19 },
    { name: "Golf Pride MCC / MCC Plus4", note: "Standard or midsize", price: 13.19 },
    { name: "Golf Pride Z-Grip Cord", price: 13.19 },
    { name: "Golf Pride MCC Align", price: 15.19 }
  ],

  balls: [
    { name: "Maxfli SoftFli / StraightFli", note: "Per dozen", price: 19.99 },
    { name: "Maxfli Tour, Tour X, Tour S", note: "Per dozen", price: 39.99 }
  ],

  shafts: [
    { id: "driver", title: "Driver & wood shafts", items: [
      { name: "Project X Cypher 2.0", price: 41.99 },
      { name: "Project X HZRDUS Black G4 / Red G4", price: 79.99 },
      { name: "Aldila NV 55 / 65 / 75", price: 88.00 },
      { name: "Mitsubishi Kai'li White / Blue", price: 89.99 },
      { name: "Mitsubishi Tensei AV", note: "White, Blue, Orange, Red", price: 129.99 },
      { name: "Project X HZRDUS Black G5", price: 225.00 },
      { name: "Project X Denali Frost", note: "Red, Blue, Black", price: 225.00 },
      { name: "Fujikura Ventus TR / Velocore+", note: "Red, Blue, Black, White", price: 350.00 },
      { name: "Mitsubishi Tensei 1K Pro", price: 360.00 },
      { name: "Graphite Design Tour AD", note: "VF, DI, CQ, FI, GC", price: 379.00 }
    ]},
    { id: "iron", title: "Iron shafts", items: [
      { name: "N.S. Pro 950GH", price: 28.50 },
      { name: "True Temper Elevate 85", price: 29.99 },
      { name: "Dynamic Gold S300 / X100", price: 32.99 },
      { name: "KBS Tour", price: 39.95 },
      { name: "Dynamic Gold 95 / 105 / 120", price: 40.99 },
      { name: "N.S. Pro Modus3 Tour 105–130", price: 42.50 },
      { name: "Mitsubishi Tensei AV Silver", note: "Graphite", price: 44.99 },
      { name: "Dynamic Gold Tour Issue", price: 46.99 },
      { name: "Project X LZ", price: 53.99 },
      { name: "KBS C-Taper", price: 56.95 }
    ]},
    { id: "wedge", title: "Wedge & hybrid shafts", items: [
      { name: "N.S. Pro Modus3 Wedge", price: 43.50 },
      { name: "Mitsubishi Tensei AV Silver Hybrid", price: 44.99 },
      { name: "KBS Hi-Rev 2.0 / Tour Wedge", price: 45.95 },
      { name: "Dynamic Gold Tour Issue Spinner", price: 46.99 },
      { name: "UST Recoil Dart Hybrid", price: 75.00 },
      { name: "KBS Max HL Graphite Hybrid", price: 84.95 },
      { name: "Fujikura Ventus Velocore+ Hybrid", price: 200.00 }
    ]},
    { id: "adapters", title: "Adapters", items: [
      { name: "Titleist SureFit", note: "910, 913, 915", price: 19.99 },
      { name: "Mizuno", note: "Quick Switch, ST-series drivers", price: "from $19.99" },
      { name: "TaylorMade", note: "Driver, fairway & Rescue", price: "from $19.99" },
      { name: "Callaway", note: "Driver, fairway, hybrid", price: 26.99 },
      { name: "Ping", note: "G30 through G440", price: 26.99 },
      { name: "Srixon ZXi", price: 26.99 },
      { name: "Cobra", note: "Incl. FutureFit33", price: 28.99 },
      { name: "PXG", price: 30.00 },
      { name: "Tour Edge & others", note: "We'll source it", price: "Quote" }
    ]}
  ],

  // Bundle deals: no codes. The quote builder applies them automatically when an order qualifies.
  bundles: {
    launchBag: { price: 40, endsISO: "2027-01-01", ends: "December 31, 2026" }, // full bag with grips we order, + free loft & lie check
    tuneUpOff: 10  // full-bag regrip (10+ clubs) + loft & lie adjust on 6+ irons in one visit
  }
};
