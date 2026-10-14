/* Rocket City ClubWorks price list: the ONE place prices live.
   The home page, the /menu page and the quote builder all read from here.
   Numbers are customer prices. Never put trade cost or margin in this file:
   the repo and the site are public.

   price: a number shows as $3 or $7.19; a string shows as written ("Quote", "Free", "from $15").
   stock: true marks grips kept on hand for next-day work. */
window.RCCW = {
  asOf: "October 2026",
  phone: "+12055889164",
  phoneLabel: "(205) 588-9164",
  email: "jackson@rocketcityclubworks.com",

  // Labor rules used by the quote builder and the "popular jobs" prices.
  // Labor is where the shop earns: parts sell at GolfWorks retail, which is only 6-14% over trade cost.
  rules: {
    regripOurs: 4,      // per club, grips bought here
    regripOursBag: 40,  // full bag, grips bought here
    regripOwn: 5,       // per club, customer's own grips
    regripOwnBag: 50,   // full bag, customer's own grips
    bagMax: 14,         // clubs covered by a full-bag price
    putterGrip: 5,
    loftCheck: 15,      // check only, up to 14 clubs
    loftPer: 5,         // check and adjust, per club
    loftSet: 45,        // check and adjust a set
    loftSetMax: 12,
    reshaftSteel: 20,
    reshaftGraphite: 25,
    reshaftWood: 25,
    ironSetMin: 6,      // reshaft this many irons/wedges or more for set pricing
    ironSetSteel: 15,
    ironSetGraphite: 20,
    cleanPer: 3,
    cleanSet: 25,       // up to 14 clubs
    paintPer: 8,
    paintSet: 50,       // up to 10 clubs
    rush: 15,           // a same-day special order ships on its own; covers the $9.99+ shipment
    shipSmall: 10,      // special-order shafts, heads and adapters under $75
    shipFreeOver: 75
  },

  services: [
    { id: "regrip", title: "Regripping", items: [
      { name: "Regrip, grips bought here", note: "Per club · + grip", price: 4 },
      { name: "Full bag, grips bought here", note: "Up to 14 clubs · + grips", price: 40 },
      { name: "Regrip, your own grips", note: "Per club · ready next day", price: 5 },
      { name: "Full bag, your own grips", note: "Up to 14 clubs · ready next day", price: 50 },
      { name: "Putter grip install", note: "+ grip if bought here", price: 5 },
      { name: "Build-up wraps & logo alignment", price: "Free" }
    ]},
    { id: "loft", title: "Loft & lie", items: [
      { name: "Check only", note: "Irons & wedges, up to 14 clubs", price: 15 },
      { name: "Check & adjust", note: "Per club", price: 5 },
      { name: "Check & adjust a set", note: "Up to 12 clubs", price: 45 }
    ]},
    { id: "shafts", title: "Shafts & builds", items: [
      { name: "Reshaft iron or wedge, steel", note: "+ shaft, ferrule & grip", price: 20 },
      { name: "Reshaft iron or wedge, graphite", note: "+ shaft, ferrule & grip", price: 25 },
      { name: "Iron set reshaft, 6+ clubs", note: "Per club · steel $15, graphite $20", price: "from $15" },
      { name: "Reshaft driver, wood or hybrid", note: "+ shaft & grip · + adapter if new", price: 25 },
      { name: "Install or move an adapter", note: "Your shaft · + adapter if new", price: 20 },
      { name: "Custom club build", note: "+ heads, shafts, grips & ferrules", price: "Quote" }
    ]},
    { id: "repairs", title: "Repairs", items: [
      { name: "Shorten a club", note: "+ grip if the old one can't be saved", price: 5 },
      { name: "Extend a club", note: "+ extension & grip", price: 10 },
      { name: "Loose head or rattle", note: "+ ferrule if replaced", price: 12 },
      { name: "Custom ferrules, per club", note: "+ ferrule · $5 with a reshaft or build", price: 15 }
    ]},
    { id: "refinish", title: "Refinishing", items: [
      { name: "Deep clean, per club", note: "Full bag $25", price: 3 },
      { name: "Refurbish", note: "Groove clean, polish & buff", price: 15 },
      { name: "Paint fill, per club", note: "Set of up to 10 $50 · paint included", price: 8 },
      { name: "Custom stamping", note: "Initials, numbers or short text", price: "from $15" }
    ]},
    { id: "tradein", title: "Trade-in", items: [
      { name: "Trade in shafts, adapters & heads", note: "Credit toward any service", price: "Quote" },
      { name: "Pre-owned shafts & adapters", note: "Lower-cost repair option, when in stock", price: "Quote" }
    ]}
  ],

  turnaround: [
    { big: "Next day", small: "Your own grips or grips we stock" },
    { big: "3–5 days", small: "Special-order grips, ordered Mon & Thu" },
    { big: "Rush +$15", small: "Special order shipped same day, 2–3 days" }
  ],

  // Sorted cheapest first. Shown with installed price (grip + labor) on the menu.
  grips: [
    { name: "SuperStroke Crossline 2.0", price: 6.19 },
    { name: "Golf Pride Tour Velvet", note: "Standard or midsize", price: 7.19, stock: true },
    { name: "Golf Pride Tour Velvet Plus4", price: 7.19 },
    { name: "Ping ID8", price: 7.99 },
    { name: "Winn Dri-Tac Wrap", price: 8.99 },
    { name: "Winn Dri-Tac", note: "Standard", price: 9.79 },
    { name: "Golf Pride CP2 Wrap / CP2 Pro", price: 11.19 },
    { name: "Golf Pride Tour Wrap 2G", price: 11.19 },
    { name: "Golf Pride MCC / MCC Plus4", note: "Standard or midsize", price: 13.19, stock: true },
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
      { name: "Callaway", note: "Driver, fairway, hybrid", price: 26.99 },
      { name: "Ping", note: "G410, G425, G430, G440", price: 26.99 },
      { name: "Srixon ZXi", price: 26.99 },
      { name: "Cobra", note: ".335 and .370", price: 28.99 },
      { name: "PXG", price: 30.00 },
      { name: "TaylorMade, Titleist & others", price: "Quote" }
    ]}
  ],

  // Bundle deals: no codes. The quote builder applies them automatically when an order qualifies.
  bundles: {
    launchBag: { price: 35, endsISO: "2027-03-01", ends: "March 1, 2027" }, // full bag with grips bought here, + free loft & lie check
    tuneUpOff: 20  // full-bag regrip + loft & lie set adjust + full-bag deep clean together
  }
};
