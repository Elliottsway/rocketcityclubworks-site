# Rocket City ClubWorks site

Jackson Stewart's golf club repair shop in Huntsville, AL. Static pages plus a service-ticket API on one Cloudflare Worker. `docs/SETUP.md` explains how everything works; read it before changing the ticket flow.

## Deploy
- Pushing to `main` deploys through Cloudflare Workers Builds (`wrangler.jsonc`). Never run `wrangler deploy` by hand.
- Work on a branch, open a PR, merge when tests pass.
- `.assetsignore` keeps code, docs, `tools/` and secrets off the public site. Anything new that isn't a page or asset goes in it.

## Database (D1 `rccw`)
- Schema is `db/schema.sql` plus numbered files in `db/migrations/`. Add a new numbered file; never edit one that has been applied.
- Apply a new migration to the remote database (`wrangler d1 execute rccw --remote --file=…`) before merging the code that needs it. Migrations only add; no destructive changes without Jackson's OK.

## Prices and pages
- `assets/prices.js` is the one place prices live. After changing prices or service-page copy, run `node tools/build-pages.mjs` and commit the result. It rebuilds the service pages, FAQ, sitemap, `llms.txt`, the home page's structured data, and every `data-p` fallback price.

## Never
- Never put trade costs, margins or the GolfWorks booklet in this repo or on the site. Private costs live only in the D1 `part_costs` table.
- Never commit secrets. Secrets are Worker secrets: `ADMIN_PASSWORD`, `RESEND_API_KEY`, `SQUARE_*`, `FEDEX_*`, `DROPOFF_NOTE` / `DROPOFF_LOCATION`.
- Never set `DEV_SHOW_CODE`, `DEV_ANY_HOUR` or `DEV_ADMIN` in Cloudflare. They are for local `.dev.vars` only.
- Don't put the phone number or email back as a call to action. Customers are sent to the instant price (`/menu/#quote`) and Request service (`/request/`).
- New lines of business (new services, products, pricing, policies) need Jackson's approval. Improvements to what exists don't.

## Testing locally
- Copy the repo outside git, add a `.dev.vars` with test values (`DEV_SHOW_CODE=1`, `DEV_ANY_HOUR=1`, `SQUARE_API_BASE` pointing at a mock Square), apply the schema and migrations with `--local`, then run `wrangler dev`. Keep log files outside the copied folder, or wrangler reloads in a loop.
- The hourly job runs at `/cdn-cgi/handler/scheduled` when wrangler dev is started with `--test-scheduled`.
- Check pages at 390px and desktop width; nothing may scroll sideways on a phone.

## Writing
- Customer-facing copy: short, plain, friendly, from the golfer's side. No em-dash asides.
- Emails go through `notifyCustomer` / `notifyShop` in `src/lib.js` and never throw.
