# rocketcityclubworks.com

Static site for Rocket City ClubWorks, served by Cloudflare Pages.

- `index.html` — home page (services, prices, parts, offers, FAQ, request form)
- `menu/index.html` — phone-first service and price menu. Card QR codes point here: `/menu/?ref=card`
- `404.html`, `favicon.svg`, `apple-touch-icon.png`, `og-image.png`, `robots.txt`, `sitemap.xml`

No build step. Cloudflare Pages settings: framework preset **None**, build command empty, output directory `/`.

Prices live in two places: the price list in `index.html` and `menu/index.html`. Change both together.
The `?ref=` value on the menu URL is added to the pre-filled text (for example `(CARD)`), so you can tell which flyer or card brought someone in.
