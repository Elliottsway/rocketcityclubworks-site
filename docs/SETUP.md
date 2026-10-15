# Service tickets: how the site works

The site is a Cloudflare **Worker** (`rocketcityclubworks-site`). It serves the static pages from this repo and runs the service-ticket API in `src/`. Pushing to `main` deploys it through Workers Builds, using `wrangler.jsonc`. `.assetsignore` keeps code and docs off the public site.

## Pages

| Page | Who | What |
|---|---|---|
| `/account/` | Customers | Sign up / sign in with a 6-digit email code, see all their tickets, submit a saved instant-price quote |
| `/request/` | Customers | Service request form (needs an account) |
| `/menu/#quote` | Customers | Instant price; "Submit for review" saves the quote and sends them to sign in |
| `/ticket/?t=…` | Customers | One ticket: status, ready date, parts and shipping, price, Approve & pay, messages |
| `/admin/` | Jackson | Tickets, Parts orders, Customers (passphrase login) |

## Ticket flow

1. **Submitted:** the customer sends a quote or request. Jackson gets an email.
2. **Priced:** Jackson edits the lines and taps **Save & send price to customer**. The customer gets an email.
3. **Approved:** the customer taps **Approve & pay** and goes to Square checkout for the amount due.
4. **Paid:** this is set only after the site checks the payment with Square's API. Two things trigger that check:
   - the signed webhook arrives, or
   - the customer returns from checkout.

   The payment must be COMPLETED, at our location, for this ticket's Square order. The amount recorded comes from Square, not from the webhook body.
5. **Parts:** parts on fully paid tickets appear under **Parts orders → Ready to order**.
   - Copy the list into GolfWorks and record the order number.
   - Adding tracking marks the parts shipped and emails the customer.
   - **Mark delivered** marks them received.
6. **On the bench → Ready → Picked up:** set from the ticket's status menu. "Ready" emails the customer.

**Building a ticket by hand:** in a ticket, use **Add from your price list or the GolfWorks catalog**.
- **Labor and fees** come from `assets/prices.js`.
- **Grips, putter grips and shafts** come from `assets/catalog.json`, with their options.
- **Adapters** come from `assets/parts.js`.
- Picking an item fills in the full name, the GolfWorks part number and the retail price. The **+ Labor / Part / Fee / Discount** buttons still add custom lines.

**Payments & refunds:** a paid ticket shows each Square payment (card, receipt link, receipt #, Square fee, refunds) live from Square, with a **Refund** button for part or all of each payment.
- Refunds made in Square's own dashboard show up the next time the ticket is opened.
- The customer page shows money refunded.
- The customer's page in the dashboard lists every payment across their tickets.

**Photos:** customers and Jackson can add photos to a ticket.
- Photos are shrunk in the browser (longest side 1600px, JPEG) and kept in D1 (`photos`, `photo_data`).
- Only the ticket's customer and Jackson can view them.
- To move them to R2 later, add an R2 binding and change `uploadPhoto` / `servePhoto` in `src/extras.js`.

**Costs & reports (private):**
- Each line has a private "cost $" field that customers never see.
- Part costs fill in automatically from the `part_costs` table: GolfWorks trade prices loaded straight into D1, never in this public repo, scaled to the price charged.
- **Reports** shows sales (before tax, net of refunds), parts cost, Square fees, GolfWorks shipping, gross profit and margin, plus top items by section and month by month. Results can be downloaded as CSV.

**Cash & other payments:** "Record cash / Venmo / other payment" on a ticket counts toward paid, so parts go on the order list. Entries made by mistake can be removed.

**Hourly jobs** (cron in `wrangler.jsonc`, code in `src/extras.js`), emails only 8am–8pm Central:
- **Approve / pay reminder:** every 24 hours while a price waits, up to 5.
- **Pickup reminder:** every 12 hours while a ticket is Ready with no pickup scheduled, up to 10. Customers schedule pickup on their ticket.
- **Thank-you email:** sent a day after "Picked up". It adds `THANKS_CREDIT_CENTS` credit to the customer for their next service (not tied to leaving a review) and includes the `GOOGLE_REVIEW_URL` link when it's set. Jackson applies the credit from the ticket.
- **FedEx auto-tracking:** for shipped orders, once the `FEDEX_API_KEY` and `FEDEX_SECRET_KEY` secrets exist. It updates the expected date and marks orders delivered.

**Bench ticket:** `/admin/print/?t=…` is a 4×6 label (Jadens 668BT) with a QR code back to the ticket.

If the price goes up after payment, the ticket returns to "waiting on customer". The customer then pays only the balance, and the new parts stay off the order list until that payment clears.

## Cloudflare resources

| What | Name |
|---|---|
| Worker | `rocketcityclubworks-site` (custom domain rocketcityclubworks.com) |
| D1 database | `rccw` (binding `DB`), schema in `db/schema.sql`, changes in `db/migrations/` (apply each new one with `wrangler d1 execute rccw --remote --file=…` before merging the code that needs it) |
| Plain vars | in `wrangler.jsonc` (`SITE_URL`, `NOTIFY_TO`, `MAIL_FROM`, `TAX_RATE`, `SQUARE_ENV`, `SQUARE_WEBHOOK_URL`) |
| Secrets | `ADMIN_PASSWORD`, `RESEND_API_KEY`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY` (set with `wrangler secret put`, never in the repo) |

- **Email** goes through Resend from `shop@rocketcityclubworks.com`. The domain is verified with DNS records in Cloudflare (`resend._domainkey`, `send`, `_dmarc`). Replies go to jackson@rocketcityclubworks.com.
- **Square webhook:** `https://rocketcityclubworks.com/api/square/webhook`, events `payment.created` and `payment.updated`.
- **Sales tax:** change `TAX_RATE` in `wrangler.jsonc` (e.g. `"0.09"`) once registered. Existing tickets keep their rate, which can be changed per ticket in the dashboard.

## Local testing

Make a copy of the repo outside git and add a `.dev.vars` with test values (`DEV_SHOW_CODE=1` shows sign-in codes on screen; point `SQUARE_API_BASE` at a mock). Then run:

```sh
npx wrangler d1 execute rccw --local --file=db/schema.sql
npx wrangler dev
```
