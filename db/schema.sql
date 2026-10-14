-- Work tickets for Rocket City ClubWorks (Cloudflare D1).
-- Apply with: wrangler d1 execute rccw --remote --file=db/schema.sql

CREATE TABLE IF NOT EXISTS tickets (
  id            TEXT PRIMARY KEY,          -- private, unguessable id used in the customer link
  number        INTEGER NOT NULL UNIQUE,   -- shown as RC-1001
  status        TEXT NOT NULL,             -- submitted | awaiting_approval | approved | paid | parts_ordered | in_progress | ready | completed | cancelled
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  customer_note TEXT,                      -- what the customer wrote when submitting
  spec          TEXT NOT NULL,             -- JSON: what they picked in the instant price (grips, sizes, shafts, colors...)
  lines         TEXT NOT NULL,             -- JSON: priced line items [{desc, qty, unit_cents, kind, taxable}]
  shop_note     TEXT,                      -- Jackson's note shown to the customer
  tax_rate      REAL NOT NULL DEFAULT 0,   -- sales tax on taxable (parts) lines, e.g. 0.09
  total_cents   INTEGER NOT NULL DEFAULT 0,
  paid_cents    INTEGER NOT NULL DEFAULT 0,
  version       INTEGER NOT NULL DEFAULT 1, -- bumps every time the shop changes the price
  approved_version INTEGER,
  square_order_id TEXT,
  square_link_url TEXT,
  ref           TEXT,                      -- ?ref= tag (CARD, COUNTER...)
  ip_hash       TEXT
);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets(status, updated_at);
CREATE INDEX IF NOT EXISTS tickets_order ON tickets(square_order_id);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  TEXT NOT NULL,
  at         TEXT NOT NULL,
  who        TEXT NOT NULL,                -- customer | shop | system
  kind       TEXT NOT NULL,                -- submitted | message | priced | status | approved | paid
  text       TEXT
);
CREATE INDEX IF NOT EXISTS events_ticket ON events(ticket_id, id);

CREATE TABLE IF NOT EXISTS payments (
  square_payment_id TEXT PRIMARY KEY,      -- dedupes webhook retries
  ticket_id  TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  at         TEXT NOT NULL
);
