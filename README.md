# rocketcityclubworks.com

Static site for Rocket City ClubWorks, served by Cloudflare Pages. No build step: framework preset **None**, build command empty, output directory `/`.

- `index.html`: home page (popular jobs with prices, how it works, offers, FAQ, request form)
- `menu/index.html`: full service and price menu with the instant-price quote builder. Card QR codes point here: `/menu/?ref=card`
- `assets/prices.js`: **every price lives here.** Both pages and the quote builder read from it
- `assets/site.css`, `assets/site.js`: shared styles and behavior
- `404.html`, `favicon.png`, `favicon-32.png`, `apple-touch-icon.png`, `og-image.png`, `robots.txt`, `sitemap.xml`

## Changing prices
Edit `assets/prices.js` and update `asOf`. Nothing else needs to change.
This repo is public: never put trade cost or margin in it. Keep those in a private sheet.

## Offers
Bundle deals live in `prices.js` under `bundles`. The launch deal hides itself after `endsISO`.

## Parts & turnaround
Nothing is stocked. Grips and parts are ordered from GolfWorks per job (before 11:30am CT) and arrive in ~2 business days; a $10 parts fee per order covers shipping (free at $100+). Rush = overnight parts, $25.

## Tracking where customers come from
The `?ref=` value on any page URL is added to the pre-filled text (for example `(CARD)`), so you can tell which card, flyer or post brought someone in.
