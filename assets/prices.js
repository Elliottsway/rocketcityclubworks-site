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
  email: "RocketCityClubWorks@gmail.com",

  // Labor rules used by the quote builder and the "popular jobs" prices.
  rules: {
    regripOurs: 3,      // per club, grips bought here
    regripOursBag: 35,  // full bag, grips bought here
    regripOwn: 5,       // per club, customer's own grips
    regripOwnBag: 40,   // full bag, customer's own grips
    bagMax: 13,         // clubs covered by a full-bag price
    putterGrip: 5,
    loftCheck: 15,      // check only, up to 10 clubs
    loftPer: 5,         // check and adjust, per club
    loftSet: 45,        // check and adjust, up to 10 clubs
    loftSetMax: 10,
    reshaftSteel: 20,
    reshaftGraphite: 25,
    reshaftWood: 25,
    cleanPer: 3,
    cleanSet: 30,
    rush: 10,
    shipSmall: 10,      // special-order parts under $75
    shipFreeOver: 75
  },

  services: [
    { id: "regrip", title: "Regripping", items: [
      { name: "Regrip, grips bought here", note: "Per club · + grip", price: 3 },
      { name: "Full bag, grips bought here", note: "Up to 13 clubs · + grips", price: 35 },
      { name: "Regrip, your own grips", note: "Per club · ready next day", price: 5 },
      { name: "Full bag, your own grips", note: "Up to 13 clubs · ready next day", price: 40 },
      { name: "Putter grip install", note: "+ grip if bought here", price: 5 },
      { name: "Build-up wraps & logo alignment", price: "Free" }
    ]},
    { id: "loft", title: "Loft & lie", items: [
      { name: "Check only", note: "Irons & wedges, up to 10 clubs", price: 15 },
      { name: "Check & adjust", note: "Per club", price: 5 },
      { name: "Check & adjust a full set", note: "Up to 10 clubs", price: 45 }
    ]},
    { id: "shafts", title: "Shafts & builds", items: [
      { name: "Reshaft iron or wedge, steel", note: "+ shaft, ferrule & grip", price: 20 },
      { name: "Reshaft iron or wedge, graphite", note: "+ shaft, ferrule & grip", price: 25 },
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
      { name: "Deep clean, per club", note: "Full set $30", price: 3 },
      { name: "Refurbish", note: "Groove clean, polish & buff", price: 15 },
      { name: "Paint fill, per club", note: "Iron set $50 · paint included", price: 8 },
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
    { big: "Rush +$10", small: "Special order shipped same day, 2–3 days" }
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

  offers: {
    ends: "March 1, 2027",
    endsISO: "2027-03-01",  // offers hide themselves after this date
    list: [
      { code: "ROCKET15", title: "15% off labor, first order", note: "Any service · parts at regular price" },
      { code: "FULLBAG", title: "Full bag regrip for $30", note: "Grips bought here · free loft & lie check" },
      { code: "CLUBWORKS5", title: "$5 off for you and a friend", note: "They book with the code and your name" }
    ]
  }
};
