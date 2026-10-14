# Work tickets & Square payments — setup

The site is still a static Cloudflare Pages site. The ticket system adds:

- `functions/` (Pages Functions, the `/api/*` routes)
- a D1 database
- a few secrets

No secret values belong in this repo.

## How it works

1. **Quote.** A customer builds a quote on `/menu/` and taps **Submit for review**. This creates a ticket (RC-1001, RC-1002, …) and opens its private page at `/ticket/?t=<random id>`.
2. **Review.** Jackson signs in at `/admin/`, adjusts the line items, and taps **Save & send for approval**. Text or email the ticket link to the customer.
3. **Approve and pay.** The customer taps **Approve & pay**, which opens Square's checkout. Square's webhook marks the ticket **Paid**.
4. **Track.** Jackson moves the ticket through Parts ordered → On the bench → Ready → Picked up. The customer sees each step on their ticket page.

If parts are added after payment, re-price and send again. The customer then pays only the balance.

## Cloudflare (Pages project → Settings)

| Kind | Name | Value |
| --- | --- | --- |
| D1 binding | `DB` | database `rccw`, created from `db/schema.sql` |
| Variable | `SITE_URL` | `https://rocketcityclubworks.com` |
| Variable | `TAX_RATE` | e.g. `0.09` for 9% (default `0`) |
| Variable | `NOTIFY_TO` / `NOTIFY_FROM` | alert email address / sender on the domain |
| Secret | `ADMIN_PASSWORD` | long passphrase for `/admin/` |
| Secret | `IP_SALT` | any random string (used for rate limits) |
| Secret | `SQUARE_ACCESS_TOKEN` | Square app → Production → Access token |
| Variable | `SQUARE_LOCATION_ID` | Square app → Locations |
| Variable | `SQUARE_ENV` | `production` (or `sandbox` while testing) |
| Secret | `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square app → Webhooks → subscription → Signature key |
| Variable | `SQUARE_WEBHOOK_URL` | `https://rocketcityclubworks.com/api/square/webhook` |

The Square webhook subscription points at the URL above, with the events `payment.created` and `payment.updated`.

**Optional:** put Cloudflare Access in front of `/admin*` and `/api/admin*`, then set:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`
- `ADMIN_EMAILS`

Either sign-in method works.

**Never set `DEV_ADMIN` in Cloudflare.** It turns off the admin login and is only for local testing.

Don't commit a `wrangler.toml`. It would override the bindings set in the dashboard.

## Database

```sh
npx wrangler d1 create rccw
npx wrangler d1 execute rccw --remote --file db/schema.sql
```

## Local testing

Make a copy of the site outside the repo. Add a `wrangler.toml` with a D1 binding and `[vars]` (`DEV_ADMIN = "1"`, test Square values), then run:

```sh
npx wrangler pages dev . --port 8788
```
