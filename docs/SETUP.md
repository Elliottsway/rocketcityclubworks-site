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
- **Approve / pay reminder:** 1, 3 and 7 days after the price is sent. The last one offers to close or change the ticket.
- **Pickup reminder:** 1, 3 and 7 days after a ticket is Ready with no pickup scheduled. Customers schedule pickup on their ticket.
- **7am digest:** one email to Jackson listing everything that needs attention today, the same list as the dashboard's **Today** panel. Covers tickets waiting for a price (12h+ is flagged), head searches, prices sent but unpaid 3+ days, clubs not yet in, ready dates due, and pickups.
- **Thank-you email:** sent a day after "Picked up". It adds `THANKS_CREDIT_CENTS` credit to the customer for their next service (not tied to leaving a review) and includes the `GOOGLE_REVIEW_URL` link when it's set. Jackson applies the credit from the ticket.
- **FedEx auto-tracking:** for shipped orders, once the `FEDEX_API_KEY` and `FEDEX_SECRET_KEY` secrets exist. It updates the expected date and marks orders delivered.

**Custom builds:** the instant price has "+ Build a club": head (`assets/heads.json`), shaft, grip and build labor.
- Maltby component heads price instantly from the GolfWorks booklet retail.
- Brand heads (researched list prices) come in as "Jackson to price", with the new retail shown for comparison.
- In the ticket, the **Build pricer** takes your head cost (with shipping), the brand's new price for the same build, a target margin, a minimum profit and a minimum customer saving. It suggests the head price, flags builds that can't beat buying new, and writes the price and cost onto the head line.
- **Head sourcing deposit:** for brand heads, ask for a deposit before you search.
  - Use **Head sourcing deposit** on the ticket. It suggests 10% of the build estimate (brand heads counted at new retail), $25 minimum, $75 maximum. The customer is emailed and sees "Pay deposit & start search" on their ticket (Square checkout). Unpaid requests get a reminder every 24 hours, up to 3.
  - Once it's paid (online, or recorded as cash), you have **48 hours** to report back. The ticket shows "Sourcing your head" and you get an email 12 hours before the deadline and again if it passes.
  - Found the head: price the build and **Save & send price**. The deposit is already in "Paid", so the customer pays only the balance.
  - No approved head: **Refund deposit & close ticket** refunds it in full through Square and cancels the ticket. (A cash deposit is handed back in person.)
  - Once the customer approves a head and it is bought, the deposit is no longer refundable (the customer sees this before paying).
- To refresh heads, rerun the research and `build_heads.py` (kept outside the repo; they use the private booklet).

**Drop-off:** once a ticket is paid, the customer sees **Schedule drop-off** on their ticket.
- The payment email tells them what's next. If the `DROPOFF_NOTE` secret is set (for example the porch address and instructions), it's included. It's a secret so the address never appears in the public repo. Without it, the email says Jackson will send the address.
- Paid tickets with no drop-off planned get one reminder a day, up to 2.
- In the dashboard, the ticket list shows "📦 drop-off …" or "no drop-off yet" until the clubs are in. On the ticket, the **Clubs received** box emails the customer that their clubs are checked in.

**Search pages:** `tools/build-pages.mjs` builds the service pages (`/golf-club-regripping/`, `/reshafting/`, `/loft-and-lie/`, `/golf-club-repair/`, `/custom-golf-clubs/`, `/madison-al/`), `/faq/`, `sitemap.xml`, `llms.txt` and the home page's structured data, all from `assets/prices.js`.
- It also stamps current prices into every `data-p` price in the HTML, so search engines see the same prices as visitors.
- Run `node tools/build-pages.mjs` after changing prices or page copy, and commit the result.

**Where customers come from:** sign-up asks "How did you hear about us?" (optional), and the site remembers the link someone arrived on for 30 days. That covers `?ref=…`, or `utm_source` plus `utm_campaign`, on ads and QR codes. **Reports** show sales by answer and by link. The customer's page in the dashboard shows both.

**Thank-you credit** is applied automatically when you tap **Save & send price**, and customers see their credit on their account page.

**Bench ticket:** `/admin/print/?t=…` is a 4×6 label (Jadens 668BT) with a QR code back to the ticket.

If the price goes up after payment, the ticket returns to "waiting on customer". The customer then pays only the balance, and the new parts stay off the order list until that payment clears.

## Cloudflare resources

| What | Name |
|---|---|
| Worker | `rocketcityclubworks-site` (custom domain rocketcityclubworks.com) |
| D1 database | `rccw` (binding `DB`), schema in `db/schema.sql`, changes in `db/migrations/` (apply each new one with `wrangler d1 execute rccw --remote --file=…` before merging the code that needs it) |
| Plain vars | in `wrangler.jsonc` (`SITE_URL`, `NOTIFY_TO`, `MAIL_FROM`, `TAX_RATE`, `SQUARE_ENV`, `SQUARE_WEBHOOK_URL`) |
| Secrets | `ADMIN_PASSWORD`, `RESEND_API_KEY`, `DROPOFF_NOTE` (optional), `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY` (set with `wrangler secret put`, never in the repo) |

- **Email** goes through Resend from `shop@rocketcityclubworks.com`. The domain is verified with DNS records in Cloudflare (`resend._domainkey`, `send`, `_dmarc`). Replies go to jackson@rocketcityclubworks.com.
- **Square webhook:** `https://rocketcityclubworks.com/api/square/webhook`, events `payment.created` and `payment.updated`.
- **Sales tax:** change `TAX_RATE` in `wrangler.jsonc` (e.g. `"0.09"`) once registered. Existing tickets keep their rate, which can be changed per ticket in the dashboard.

## Local testing

Make a copy of the repo outside git and add a `.dev.vars` with test values (`DEV_SHOW_CODE=1` shows sign-in codes on screen; point `SQUARE_API_BASE` at a mock). Then run:

```sh
npx wrangler d1 execute rccw --local --file=db/schema.sql
npx wrangler dev
```
