// Builds the service pages, FAQ, sitemap, llms.txt and the home page's structured data from assets/prices.js,
// and refreshes every <span data-p="..."> fallback price in the HTML so search engines see current prices.
// Run after changing prices or page copy:  node tools/build-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://rocketcityclubworks.com';
const TODAY = new Date().toISOString().slice(0, 10);

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/prices.js'), 'utf8'), ctx);
const D = ctx.window.RCCW, R = D.rules, B = D.bundles;
const money = (n) => (typeof n === 'number' ? '$' + (n % 1 ? n.toFixed(2) : String(n)) : n);
const grip = (name) => D.grips.find((g) => g.name === name);
const installed = (name) => Math.round((grip(name).price + R.regripOurs) * 100) / 100;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const shaftRange = (id) => { const p = D.shafts.find((s) => s.id === id).items.map((i) => i.price); return `${money(Math.min(...p))}–${money(Math.max(...p))}`; };
const launchLive = new Date() < new Date(B.launchBag.endsISO + 'T00:00:00');
const tv = installed('Golf Pride Tour Velvet'), tvBag = Math.round((13 * grip('Golf Pride Tour Velvet').price) * 100) / 100;
const tvBagParts = tvBag >= R.partsFreeOver ? 0 : R.partsFee;

// A price row in the same style as the menu. data-p keeps it in step with prices.js at runtime too.
const row = (name, note, price, key) => `<div class="row"><span class="nm">${name}${note ? `<span class="nt">${note}</span>` : ''}</span><span class="lead"></span><span class="pr">${key ? `<span data-p="${key}">${money(price)}</span>` : money(price)}</span></div>`;
const P = (key) => `<span data-p="${key}">${money(R[key])}</span>`;

// ---------- pages ----------
const PAGES = [
  {
    slug: 'golf-club-regripping', nav: 'Regripping', title: 'Golf Club Regripping in Huntsville, AL',
    h1: 'Golf club regripping in Huntsville &amp; Madison',
    desc: `Regrip golf clubs in Huntsville and Madison, AL: ${money(R.regripOwn)} per club labor, full bag ${money(R.regripOwnBag)}, Tour Velvet installed ${money(tv)}. Next day with your own grips. Instant price online.`,
    lede: `Fresh grips are the cheapest upgrade in golf. Bring your own and they're back in your bag tomorrow, or pick from Golf Pride, Winn, SuperStroke and Ping and we order them for your clubs.`,
    service: 'Golf club regripping',
    prices: [
      row('Regrip, per club', 'Your grips or ours · + grip if we order it', R.regripOurs, 'regripOurs'),
      row('Full bag, up to 14 clubs', 'Your grips or ours · + grips if we order them', R.regripOursBag, 'regripOursBag'),
      row('Putter grip install', '+ grip if we order it', R.putterGrip, 'putterGrip'),
      row('Golf Pride Tour Velvet, installed', 'Standard or midsize · grip + labor', tv, 'installed:Golf Pride Tour Velvet'),
      row('Golf Pride MCC, installed', 'Standard or midsize · grip + labor', installed('Golf Pride MCC / MCC Plus4'), 'installed:Golf Pride MCC / MCC Plus4'),
      row('SuperStroke Crossline 2.0, installed', 'Grip + labor', installed('SuperStroke Crossline 2.0'), 'installed:SuperStroke Crossline 2.0'),
      row('Build-up wraps &amp; logo alignment', '', 'Free'),
      row('Parts fee, grips we order', `Per order · free when parts total ${money(R.partsFreeOver)}+`, R.partsFee, 'partsFee'),
    ],
    extra: launchLive ? `<p class="callout"><b>Launch price:</b> full-bag regrip with grips ordered through us is <b>${money(B.launchBag.price)}</b> labor (normally ${money(R.regripOursBag)}) plus a free loft &amp; lie check, through ${B.launchBag.ends}. The instant price applies it for you.</p>` : '',
    turnaround: [['Next day', 'Your own grips'], [D.rules.partsDays, 'Grips we order'], [D.rules.rushDays, 'Rush, overnight grips']],
    faq: [
      ['How much does it cost to regrip a full set of golf clubs?', `Labor is ${money(R.regripOursBag)} for a full bag of up to 14 clubs, your grips or ours. With 13 Golf Pride Tour Velvet grips ordered for you, that's ${money(tvBag)} in grips + ${money(R.regripOursBag)} labor${tvBagParts ? ` + the ${money(R.partsFee)} parts fee` : ''}, plus sales tax on the grips. The instant price shows the exact total for your grips.`],
      ['How often should I regrip my clubs?', 'About once a year, or every 40 rounds, if you play regularly. Regrip sooner if your grips look shiny, feel hard or slick, or show worn spots where your thumbs sit.'],
      ['Can I bring my own grips?', `Yes. Labor is the same either way (${money(R.regripOwn)} per club, ${money(R.regripOwnBag)} for a full bag) and own-grip jobs are ready the next day.`],
      ['What grip size should I get?', 'Most golfers fit a standard or midsize grip. Bring a current club and we check your hand size and how you hold it. Build-up wraps to fine-tune the size are free.'],
      ['How long until I can play them?', 'Right away. Grips are installed with solvent that sets in a few hours, so they are ready by pickup.'],
    ],
    related: ['loft-and-lie', 'reshafting'],
  },
  {
    slug: 'reshafting', nav: 'Reshafting', title: 'Golf Club Reshafting in Huntsville, AL',
    h1: 'Golf club reshafting: irons, drivers &amp; woods',
    desc: `Reshaft irons, wedges, drivers and woods in Huntsville, AL. Steel ${money(R.reshaftSteel)}, graphite ${money(R.reshaftGraphite)} per club labor, iron sets ${money(R.ironSetSteel)}/club. Shafts from True Temper, KBS, Project X, Fujikura and more.`,
    lede: 'New shafts in your favorite heads: steel or graphite, irons to driver. We help you pick the shaft, order it for your clubs, and build each club to your length and grip.',
    service: 'Golf club reshafting',
    prices: [
      row('Reshaft iron or wedge, steel', '+ shaft, ferrule &amp; grip', R.reshaftSteel, 'reshaftSteel'),
      row('Reshaft iron or wedge, graphite', '+ shaft, ferrule &amp; grip', R.reshaftGraphite, 'reshaftGraphite'),
      row(`Iron set reshaft, ${R.ironSetMin}+ clubs, steel`, 'Per club', R.ironSetSteel, 'ironSetSteel'),
      row(`Iron set reshaft, ${R.ironSetMin}+ clubs, graphite`, 'Per club', R.ironSetGraphite, 'ironSetGraphite'),
      row('Reshaft driver, wood or hybrid', '+ shaft &amp; grip · + adapter if new', R.reshaftWood, 'reshaftWood'),
      row('Install or move an adapter', 'Your shaft · + adapter if new', 20),
      row('Iron shafts', 'True Temper, KBS, Nippon, Project X', shaftRange('iron')),
      row('Driver &amp; wood shafts', 'Project X, Mitsubishi, Fujikura, Aldila, Graphite Design', shaftRange('driver')),
    ],
    extra: '',
    turnaround: [['3–5 days', 'Shafts we order (epoxy cures overnight)'], ['Next day', 'Your own shafts'], [D.rules.rushDays, 'Rush, overnight parts']],
    faq: [
      ['How much does it cost to reshaft a set of irons?', `Labor is ${money(R.ironSetSteel)} per club for steel or ${money(R.ironSetGraphite)} for graphite when you reshaft ${R.ironSetMin} or more, plus the shafts, ferrules and grips. Iron shafts run ${shaftRange('iron')} each. The instant price adds it up for your set.`],
      ['Can you reshaft my driver with a different shaft?', `Yes. Driver reshafts are ${money(R.reshaftWood)} labor plus the shaft and grip. We confirm your adapter and tip size before ordering, and can move your current adapter to the new shaft.`],
      ['Can I bring my own shaft?', 'Yes. Labor is the same, and with no parts to order your clubs are usually ready the next day.'],
      ['Steel or graphite?', 'Steel is heavier and gives most players a lower, more controlled flight. Graphite is lighter and easier on the hands and joints. Tell us your swing speed and miss and we suggest a few shafts.'],
      ['How long does a reshaft take?', 'Three to five business days when we order the shaft, since the epoxy cures overnight. Rush overnight parts cut that to about two.'],
    ],
    related: ['custom-golf-clubs', 'golf-club-regripping'],
  },
  {
    slug: 'loft-and-lie', nav: 'Loft &amp; lie', title: 'Loft and Lie Adjustment in Huntsville, AL',
    h1: 'Loft &amp; lie check and adjustment in Huntsville',
    desc: `Loft and lie check ${money(R.loftCheck)} for up to 14 clubs, adjust ${money(R.loftPer)} per club or ${money(R.loftSet)} for a set in Huntsville and Madison, AL. Next-day service.`,
    lede: 'Lofts and lies drift with play, especially on forged irons. We measure every iron and wedge against spec on a loft and lie machine, show you the numbers, and bend them back where they belong.',
    service: 'Loft and lie adjustment',
    prices: [
      row('Check only', 'Irons &amp; wedges, up to 14 clubs', R.loftCheck, 'loftCheck'),
      row('Check &amp; adjust', 'Per club', R.loftPer, 'loftPer'),
      row('Check &amp; adjust a set', `Up to ${R.loftSetMax} clubs`, R.loftSet, 'loftSet'),
    ],
    extra: `<p class="callout"><b>Season tune-up:</b> regrip 10+ clubs and adjust loft &amp; lie on 6+ irons in one visit and save ${money(B.tuneUpOff)}.${launchLive ? ` The launch full-bag regrip includes a free check through ${B.launchBag.ends}.` : ''}</p>`,
    turnaround: [['Next day', 'Most loft &amp; lie jobs'], ['About 20 min', 'A check while you wait, by appointment']],
    faq: [
      ['How often should I check loft and lie?', 'Once a year for most golfers, or after a season of range mats or a few hard hits off hardpan. Forged irons move more than cast ones.'],
      ['Can cast irons be bent?', 'Usually a degree or two. We check the head before bending and tell you first if a club is at risk.'],
      ['What does lie angle change?', 'A lie that is too upright tends to start the ball left (for right-handed golfers) and too flat starts it right. Getting it right helps shots start on line.'],
      ['Do you adjust wedges and putters?', 'Wedges, yes, as part of the set. Ask about putters on your request.'],
    ],
    related: ['golf-club-regripping', 'reshafting'],
  },
  {
    slug: 'golf-club-repair', nav: 'Club repair', title: 'Golf Club Repair in Huntsville, AL',
    h1: 'Broken golf club repair &amp; hard-to-find parts',
    desc: `Golf club repair in Huntsville and Madison, AL: loose heads ${money(20)}, shortening ${money(10)}, extensions, ferrules, paint fill and stamping, and hard-to-find replacement parts.`,
    lede: 'Loose heads, rattles, snapped shafts, clubs that are too long or too short, worn paint, and the adapter or part nobody else can find. Send photos with your request and we tell you what it takes.',
    service: 'Golf club repair',
    prices: [
      row('Loose head or rattle', 'Re-epoxied, new ferrule included', 20),
      row('Shorten a club', 'Grip saved when possible · + grip if not', 10),
      row('Extend a club', '+ extension &amp; grip', 15),
      row('Custom ferrules, per club', `+ ferrule · ${money(5)} with a reshaft or build`, 15),
      row('Paint fill, per club', `Set of up to 10 ${money(R.paintSet)} · paint included`, R.paintPer, 'paintPer'),
      row('Custom stamping', 'Initials, numbers or short text', 'from $20'),
      row('Broken club repair', 'Priced once we see the break', 'Quote'),
      row('Find a part', 'Adapters, sleeves, weights, heads', 'Quote'),
    ],
    extra: '',
    turnaround: [['Next day', 'Most repairs'], [D.rules.partsDays, 'When parts are ordered']],
    faq: [
      ['Can you fix a club with a loose or rattling head?', `Usually, yes. We pull the head, clean out the old epoxy, re-epoxy it and add a new ferrule for ${money(20)}. Most are ready the next day.`],
      ['My shaft snapped. Can it be repaired?', 'A broken shaft gets replaced, not glued. We match the shaft you had or suggest an upgrade, and price it on your ticket before any work starts.'],
      ['Can you shorten or lengthen my clubs?', `Yes. Shortening is ${money(10)} per club and extending is ${money(15)} plus the extension and grip. Junior cut-downs welcome.`],
      ['Can you find a replacement adapter or part?', 'Most adapters, sleeves and weights can be ordered. Pick "Find a part" on the request form with your club model and a photo.'],
    ],
    related: ['reshafting', 'custom-golf-clubs'],
  },
  {
    slug: 'custom-golf-clubs', nav: 'Custom builds', title: 'Custom Golf Clubs Built in Huntsville, AL',
    h1: 'Custom golf club builds in Huntsville',
    desc: 'Custom golf clubs built to your length, shaft and grip in Huntsville, AL. Component heads priced instantly, genuine new or like-new brand heads sourced for less than buying new.',
    lede: 'Clubs built one at a time to your length, shaft, grip and swing weight. Choose a component head with an instant price, or a genuine brand head that we source new or like-new so the finished club costs less than buying off the rack.',
    service: 'Custom golf club building',
    prices: [
      row('Build labor', 'Assembly, length, swing weight, grip', 'Instant price'),
      row('Component heads', 'Priced instantly in the instant price', 'Instant price'),
      row('Brand heads (new or like-new)', 'Sourced and verified genuine, priced on your ticket', 'Quote'),
      row('Head sourcing deposit', 'Brand heads only · 10% of the estimate · counts toward the build · refundable', '$25–$75'),
    ],
    extra: '<p class="callout"><b>How brand heads work:</b> brand heads aren\'t sold to the public, so Jackson finds a genuine new or like-new head, checks it, and sends photos, serial and source with your final price. A small refundable sourcing deposit starts the search, and you hear back within 48 hours.</p>',
    turnaround: [['1–2 weeks', 'Most builds, depending on parts'], ['48 hours', 'Report back on a brand-head search']],
    faq: [
      ['Is a custom build cheaper than buying new?', 'Often, yes. With sourced like-new brand heads or component heads, a build to your exact specs can cost less than a new off-the-rack set. Your quote shows the new retail price for comparison.'],
      ['Do you do club fitting?', 'We don\'t have a fitting studio. We build to the specs you have from a fitting, the clubs you play now, or simple measurements we take at drop-off.'],
      ['How does the sourcing deposit work?', 'For brand heads we ask for 10% of the build estimate ($25 minimum, $75 maximum). It counts toward the build and is refunded in full if we can\'t find a genuine head at the quoted price or you turn down the one we find.'],
      ['Can I bring my own heads?', 'Yes. We build them with new shafts and grips, priced as reshaft labor per club.'],
    ],
    related: ['reshafting', 'golf-club-regripping'],
  },
  {
    slug: 'madison-al', nav: 'Madison, AL', title: 'Golf Club Repair for Madison, AL Golfers',
    h1: 'Golf club repair for Madison, AL golfers',
    desc: `Regrips, reshafts, loft and lie and club repair for Madison, AL. ${money(R.regripOwn)} per club regrip labor, next day with your own grips, meet-ups in Madison by appointment.`,
    lede: 'Rocket City ClubWorks is a short drive from Madison in northwest Huntsville. Price your job online, pay on your ticket, and drop off on our porch by appointment or meet up in Madison.',
    service: 'Golf club repair and regripping',
    prices: [
      row('Regrip, per club', 'Your grips or ours · + grip if we order it', R.regripOurs, 'regripOurs'),
      row('Full-bag regrip', 'Up to 14 clubs', R.regripOursBag, 'regripOursBag'),
      row('Loft &amp; lie, check &amp; adjust a set', `Up to ${R.loftSetMax} clubs`, R.loftSet, 'loftSet'),
      row('Reshaft iron or wedge, steel', '+ shaft, ferrule &amp; grip', R.reshaftSteel, 'reshaftSteel'),
      row('Reshaft driver or wood', '+ shaft &amp; grip', R.reshaftWood, 'reshaftWood'),
      row('Loose head or rattle', 'Re-epoxied, new ferrule included', 20),
    ],
    extra: '',
    turnaround: [['Next day', 'Your own grips, loft &amp; lie, most repairs'], [D.rules.partsDays, 'Parts we order']],
    faq: [
      ['Do you meet up in Madison?', `Yes, by appointment, ${D.hours.short}. Pick meet-up on your ticket and we set a time and place that works, or drop off on our porch in northwest Huntsville.`],
      ['How do I get a price?', `Use the instant price for regrips, reshafts, loft and lie and builds, or send a request with photos for repairs. Jackson replies ${D.hours.short}.`],
      ['How do I pay?', 'By card, Apple Pay or Google Pay on your service ticket, through Square. Nothing is charged until you approve the final price.'],
    ],
    related: ['golf-club-regripping', 'golf-club-repair'],
  },
];

// ---------- shared chrome ----------
const head = ({ title, desc, url, ld }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rocket City ClubWorks">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#091E13">
<meta name="color-scheme" content="dark">
<script>document.documentElement.classList.add("js")</script>
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yellowtail&family=Big+Shoulders+Display:wght@800;900&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/pages.css">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap">
    <a class="mark" href="/" aria-label="Rocket City ClubWorks home"><span class="s">Rocket City</span><span class="c">ClubWorks</span></a>
    <nav aria-label="Main"><a href="/">Home</a><a href="/menu/">Prices</a><a href="/golf-club-regripping/">Regripping</a><a href="/reshafting/">Reshafting</a><a href="/faq/">FAQ</a><a href="/request/">Request service</a></nav>
    <div class="cta"><a class="ghost" href="/account/">My account</a><a class="solid" href="/menu/#quote">Instant price</a></div>
  </div>
</header>`;

const foot = `
<footer class="foot">
  <div class="wrap">
    <a class="mark" href="/" aria-label="Rocket City ClubWorks home"><span class="s">Rocket City</span><span class="c">ClubWorks</span></a>
    <div class="links">
      <a href="/menu/#quote">Instant price</a>
      <a href="/request/">Request service</a>
      <a href="/account/">My account</a>
      <a href="/menu/">Service &amp; price menu</a>
    </div>
    <div class="links">
${PAGES.map((p) => `      <a href="/${p.slug}/">${p.nav}</a>`).join('\n')}
      <a href="/faq/">FAQ</a>
    </div>
    <div class="small">© ${new Date().getFullYear()} Rocket City ClubWorks · Huntsville, Alabama · Prices as of <span data-asof>${D.asOf}</span></div>
  </div>
</footer>

<div class="bar">
  <div class="in">
    <a class="text" href="/menu/#quote">Instant price</a>
    <a class="alt" href="/request/">Request service</a>
  </div>
</div>

<script src="/assets/prices.js"></script>
<script src="/assets/site.js"></script>
</body>
</html>
`;

const BIZ = { '@id': `${SITE}/#business` };
const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const faqLd = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });
const faqHtml = (faq) => `<div class="faq">${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
const byslug = Object.fromEntries(PAGES.map((p) => [p.slug, p]));

function servicePage(p) {
  const url = `${SITE}/${p.slug}/`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Service', name: p.service, serviceType: p.service, url, description: strip(p.desc),
      provider: BIZ, areaServed: [{ '@type': 'City', name: 'Huntsville, AL' }, { '@type': 'City', name: 'Madison, AL' }] },
    crumbs([['Home', SITE + '/'], [strip(p.nav), url]]),
    faqLd(p.faq),
  ];
  return head({ title: `${p.title} | Rocket City ClubWorks`, desc: p.desc, url, ld }) + `
<main id="main">
<section class="title svc">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${p.nav}</span></nav>
    <h1>${p.h1}</h1>
    <p>${p.lede}</p>
    <div class="ctas"><a class="btn light" href="/menu/#quote">Instant price</a><a class="btn line" href="/request/">Request service</a></div>
  </div>
</section>
<div class="wrap svcgrid">
  <section class="card blk"><h2>Prices</h2>${p.prices.join('')}<p class="note">Labor prices. Parts sell at regular retail and are ordered for your job. Alabama sales tax applies to parts. Prices as of <span data-asof>${D.asOf}</span>.</p>${p.extra}</section>
  <section class="card blk"><h2>Turnaround</h2><div class="tat">${p.turnaround.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}</div>
    <h2 style="margin-top:22px">How it works</h2>
    <ol class="how"><li><b>Price it.</b> Build an instant price or send a request with photos.</li><li><b>Approve &amp; pay.</b> Jackson confirms parts and fit, then you approve and pay on your ticket.</li><li><b>Drop off &amp; pick up.</b> Porch drop-off in northwest Huntsville or a meet-up around Huntsville and Madison, by appointment.</li></ol></section>
  <section class="card blk wide"><h2>Questions</h2>${faqHtml(p.faq)}</section>
  <section class="wide more2"><span>Related:</span>${p.related.map((s) => `<a href="/${s}/">${byslug[s].nav}</a>`).join('')}<a href="/menu/">Every price</a><a href="/faq/">All FAQs</a></section>
</div>
</main>` + foot;
}

// The FAQ page gathers the home page FAQ and every service page's questions.
function faqPage(homeFaq) {
  const url = `${SITE}/faq/`;
  const groups = [['General', homeFaq], ...PAGES.filter((p) => p.slug !== 'madison-al').map((p) => [p.nav, p.faq])];
  const all = groups.flatMap((g) => g[1]);
  return head({ title: 'Golf Club Repair FAQ | Rocket City ClubWorks', url,
    desc: 'Answers about regripping, reshafting, loft and lie, repairs, custom builds, turnaround, drop-off and payment at Rocket City ClubWorks in Huntsville, AL.',
    ld: [crumbs([['Home', SITE + '/'], ['FAQ', url]]), faqLd(all)] }) + `
<main id="main">
<section class="title svc"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>FAQ</span></nav><h1>Questions &amp; answers</h1>
  <p>Everything about prices, turnaround, drop-off and payment. Don't see yours? Send a request and Jackson replies ${D.hours.short}.</p>
  <div class="ctas"><a class="btn light" href="/menu/#quote">Instant price</a><a class="btn line" href="/request/">Request service</a></div></div></section>
<div class="wrap svcgrid">
${groups.map(([t, f]) => `  <section class="card blk wide"><h2>${t}</h2>${faqHtml(f)}</section>`).join('\n')}
</div>
</main>` + foot;
}

// ---------- write ----------
// 1) Refresh fallback prices in every page's data-p spans.
const htmlFiles = ['index.html', 'menu/index.html', 'ticket/index.html', 'request/index.html', 'account/index.html'];
const fill = (key) => {
  if (key.startsWith('installed:')) return grip(key.slice(10)) ? money(installed(key.slice(10))) : null;
  if (key.startsWith('grip:')) return grip(key.slice(5)) ? money(grip(key.slice(5)).price) : null;
  return R[key] != null ? money(R[key]) : null;
};
for (const f of htmlFiles) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8').replace(/(<(\w+)[^>]*\bdata-p="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, key, txt, close) => { const v = fill(key); return v ? open + v + close : m; });
  fs.writeFileSync(p, s);
}

// 2) Home page FAQ → FAQPage; business → LocalBusiness with the service catalog.
const homePath = path.join(ROOT, 'index.html');
let home = fs.readFileSync(homePath, 'utf8');
const homeFaq = [...home.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [m[1], m[2]]);
const offers = D.services.flatMap((s) => s.items.filter((i) => typeof i.price === 'number').map((i) => ({
  '@type': 'Offer', itemOffered: { '@type': 'Service', name: i.name, ...(i.note ? { description: i.note } : {}) },
  priceSpecification: { '@type': 'UnitPriceSpecification', price: i.price, priceCurrency: 'USD' } })));
const business = {
  '@context': 'https://schema.org', '@type': ['LocalBusiness', 'SportingGoodsStore'], '@id': `${SITE}/#business`,
  name: 'Rocket City ClubWorks', url: SITE + '/', logo: `${SITE}/apple-touch-icon.png`, image: `${SITE}/og-image.png`,
  description: 'Local golf club repair and build shop in Huntsville, AL: regripping, reshafting, loft and lie, club repair, hard-to-find parts and custom builds, with instant online pricing and online booking.',
  telephone: '+1-205-588-9164', email: D.email, priceRange: '$', currenciesAccepted: 'USD', paymentAccepted: 'Credit card, Apple Pay, Google Pay',
  founder: { '@type': 'Person', name: 'Jackson Stewart' },
  address: { '@type': 'PostalAddress', addressLocality: 'Huntsville', addressRegion: 'AL', postalCode: '35806', addressCountry: 'US' },
  areaServed: ['Huntsville', 'Madison', 'Harvest', 'Meridianville', 'Hazel Green', 'Owens Cross Roads', 'Athens', 'Decatur'].map((n) => ({ '@type': 'City', name: n + ', AL' })),
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: D.hours.weekday[0], closes: D.hours.weekday[1] },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday'], opens: D.hours.weekend[0], closes: D.hours.weekend[1] }],
  hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Golf club services', itemListElement: offers },
  sameAs: [],
};
const ldBlock = `<script type="application/ld+json" id="ld-business">${JSON.stringify(business)}</script>\n<script type="application/ld+json" id="ld-faq">${JSON.stringify(faqLd(homeFaq))}</script>`;
home = home.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\n?(<script type="application\/ld\+json" id="ld-faq">[\s\S]*?<\/script>\n?)?/, () => ldBlock + '\n');
fs.writeFileSync(homePath, home);

// 3) Service pages and FAQ.
for (const p of PAGES) { fs.mkdirSync(path.join(ROOT, p.slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, p.slug, 'index.html'), servicePage(p)); }
fs.mkdirSync(path.join(ROOT, 'faq'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'faq/index.html'), faqPage(homeFaq));

// 4) Sitemap and llms.txt.
const urls = ['/', '/menu/', ...PAGES.map((p) => `/${p.slug}/`), '/faq/', '/request/'];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, 'llms.txt'), `# Rocket City ClubWorks

> Golf club repair and custom build shop in Huntsville, Alabama, run by club builder Jackson Stewart. Serves Huntsville, Madison and nearby North Alabama. Regripping, reshafting, loft and lie, broken club repair, hard-to-find parts and custom builds. Customers get an instant price online, request service online, approve and pay by card on an online service ticket, and drop off or pick up by appointment in northwest Huntsville or meet up around Huntsville and Madison.

Key facts (prices as of ${D.asOf}; labor only, parts at regular retail, Alabama sales tax on parts):
- Regrip: ${money(R.regripOurs)} per club, ${money(R.regripOursBag)} full bag up to ${R.bagMax} clubs, your grips or ours. Golf Pride Tour Velvet installed: ${money(tv)} per club.
- Turnaround: next day with your own grips; ${R.partsDays} when grips or parts are ordered; rush ${R.rushDays}.
- Loft and lie: check ${money(R.loftCheck)} (up to 14 clubs); adjust ${money(R.loftPer)} per club or ${money(R.loftSet)} for a set up to ${R.loftSetMax}.
- Reshaft: steel ${money(R.reshaftSteel)}, graphite ${money(R.reshaftGraphite)}, driver/wood ${money(R.reshaftWood)} per club; iron sets of ${R.ironSetMin}+ ${money(R.ironSetSteel)} steel / ${money(R.ironSetGraphite)} graphite per club.
- Custom builds: component heads priced instantly; genuine new or like-new brand heads sourced to beat buying new (refundable sourcing deposit, 10% of estimate, $25–$75).
- Drop-off, pickup and replies: ${D.hours.short} (Central), by appointment. Requests and instant prices online any time.
- No fitting studio. Payment by card, Apple Pay or Google Pay through Square.

## Pages
- [Instant price and full price menu](${SITE}/menu/)
- [Request service](${SITE}/request/)
${PAGES.map((p) => `- [${strip(p.title)}](${SITE}/${p.slug}/)`).join('\n')}
- [FAQ](${SITE}/faq/)
`);
console.log('built', PAGES.length, 'service pages, faq, sitemap, llms.txt;', homeFaq.length, 'home FAQs;', offers.length, 'offers');
