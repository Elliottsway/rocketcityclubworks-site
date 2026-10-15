-- Rocket City ClubWorks service tickets (Cloudflare D1, database "rccw").
-- New database: run this file, then every file in db/migrations/ in order.
-- Existing database: run only the migrations it has not had yet.

-- Customer accounts. Customers sign in with a 6-digit code emailed to them (no passwords).
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,       -- lowercased
  name          TEXT NOT NULL,
  phone         TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  created_by    TEXT NOT NULL DEFAULT 'self', -- self | shop (added by Jackson for walk-ins and phone orders)
  shop_notes    TEXT                          -- private: only Jackson sees these
);

-- Pending sign-in / sign-up codes (hashed). One row per email; a new code replaces the old one.
CREATE TABLE IF NOT EXISTS login_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  name       TEXT,                           -- sign-up details, used when the code is confirmed
  phone      TEXT
);

-- Signed-in browsers. Only a hash of the cookie value is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_customer ON sessions(customer_id);

CREATE TABLE IF NOT EXISTS tickets (
  id            TEXT PRIMARY KEY,           -- private, unguessable id used in links
  number        INTEGER NOT NULL UNIQUE,    -- shown as RC-1001
  customer_id   TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'quote', -- quote (instant price) | request (service request form) | shop (opened by Jackson)
  title         TEXT,
  status        TEXT NOT NULL,              -- submitted | awaiting_approval | approved | paid | parts_ordered | in_progress | ready | completed | cancelled
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  customer_note TEXT,
  spec          TEXT NOT NULL,              -- JSON: what they picked or described
  lines         TEXT NOT NULL,              -- JSON: [{id, desc, qty, unit_cents, kind, taxable, part_no, track, order_id}]
  shop_note     TEXT,                       -- Jackson's note shown to the customer
  eta           TEXT,                       -- estimated ready date (YYYY-MM-DD) shown to the customer
  tax_rate      REAL NOT NULL DEFAULT 0,
  total_cents   INTEGER NOT NULL DEFAULT 0,
  paid_cents    INTEGER NOT NULL DEFAULT 0, -- only ever raised by payments Square has confirmed
  version       INTEGER NOT NULL DEFAULT 1, -- bumps every time the price changes
  approved_version INTEGER,
  square_order_id TEXT,
  square_link_url TEXT,
  ref           TEXT
);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets(status, updated_at);
CREATE INDEX IF NOT EXISTS tickets_customer ON tickets(customer_id, created_at);
CREATE INDEX IF NOT EXISTS tickets_order ON tickets(square_order_id);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  TEXT NOT NULL,
  at         TEXT NOT NULL,
  who        TEXT NOT NULL,                 -- customer | shop | system
  kind       TEXT NOT NULL,                 -- submitted | message | priced | status | approved | paid | parts | internal
  text       TEXT
);
CREATE INDEX IF NOT EXISTS events_ticket ON events(ticket_id, id);

-- Every Square payment, verified against Square's API before it counts.
CREATE TABLE IF NOT EXISTS payments (
  square_payment_id TEXT PRIMARY KEY,
  ticket_id    TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  at           TEXT NOT NULL
);

-- Parts orders placed with suppliers (GolfWorks). Ticket lines point at these by order_id.
CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor     TEXT NOT NULL DEFAULT 'GolfWorks',
  order_no   TEXT,
  status     TEXT NOT NULL DEFAULT 'placed', -- placed | shipped | delivered
  carrier    TEXT,                           -- UPS | FedEx | USPS | Other
  tracking   TEXT,
  eta        TEXT,                           -- expected delivery date
  note       TEXT,
  placed_at  TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Simple rate limiting (sign-in codes, tickets, messages).
CREATE TABLE IF NOT EXISTS hits (
  key TEXT NOT NULL,
  at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hits_key ON hits(key, at);
