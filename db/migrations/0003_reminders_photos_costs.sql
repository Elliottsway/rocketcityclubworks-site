-- Reminders, pickup scheduling, photos, costs and margins, manual payments, customer credit (2026-10-15).

-- When the ticket entered its current status (kept up to date by the triggers below).
ALTER TABLE tickets ADD COLUMN status_at TEXT;
ALTER TABLE tickets ADD COLUMN pickup_at TEXT;          -- scheduled pickup, free text from Jackson or the customer
UPDATE tickets SET status_at = updated_at WHERE status_at IS NULL;
CREATE TRIGGER IF NOT EXISTS tickets_status_at_ins AFTER INSERT ON tickets
  BEGIN UPDATE tickets SET status_at = NEW.created_at WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS tickets_status_at_upd AFTER UPDATE OF status ON tickets WHEN NEW.status <> OLD.status
  BEGIN UPDATE tickets SET status_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;

-- Automatic emails already sent (approval/payment reminders, pickup reminders, review requests).
CREATE TABLE IF NOT EXISTS reminders (
  ticket_id TEXT NOT NULL,
  kind      TEXT NOT NULL,                 -- approve | pickup | review
  sent_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reminders_ticket ON reminders(ticket_id, kind, sent_at);

-- Photos on tickets. Shrunk in the browser before upload (about 200-400 KB each).
CREATE TABLE IF NOT EXISTS photos (
  id        TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  who       TEXT NOT NULL,                 -- customer | shop
  at        TEXT NOT NULL,
  mime      TEXT NOT NULL,
  size      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_ticket ON photos(ticket_id, at);
CREATE TABLE IF NOT EXISTS photo_data (
  id   TEXT PRIMARY KEY,
  data BLOB NOT NULL
);

-- Private trade cost per GolfWorks part (never shown to customers, never in the public repo).
-- ratio = trade / retail for the part's base row, used to estimate cost for any size/color.
CREATE TABLE IF NOT EXISTS part_costs (
  part_no    TEXT PRIMARY KEY,
  cost_cents INTEGER NOT NULL,
  retail_cents INTEGER NOT NULL,
  ratio      REAL NOT NULL
);

-- Cash, Venmo, etc. recorded by hand, and Square's processing fee.
ALTER TABLE payments ADD COLUMN method TEXT NOT NULL DEFAULT 'square';
ALTER TABLE payments ADD COLUMN fee_cents INTEGER;
ALTER TABLE payments ADD COLUMN note TEXT;

-- What GolfWorks charged to ship each order.
ALTER TABLE orders ADD COLUMN shipping_cents INTEGER;

-- Thank-you credit toward a customer's next service.
ALTER TABLE customers ADD COLUMN credit_cents INTEGER NOT NULL DEFAULT 0;
