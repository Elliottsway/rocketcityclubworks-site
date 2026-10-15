-- Payment details and refunds (applied 2026-10-15).
ALTER TABLE payments ADD COLUMN card TEXT;            -- e.g. "VISA •••• 4242"
ALTER TABLE payments ADD COLUMN receipt_url TEXT;
ALTER TABLE payments ADD COLUMN receipt_number TEXT;
ALTER TABLE payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS refunds (
  square_refund_id  TEXT PRIMARY KEY,
  ticket_id         TEXT NOT NULL,
  square_payment_id TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL,
  reason            TEXT,
  status            TEXT,
  at                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_ticket ON payments(ticket_id);
CREATE INDEX IF NOT EXISTS refunds_ticket ON refunds(ticket_id);
