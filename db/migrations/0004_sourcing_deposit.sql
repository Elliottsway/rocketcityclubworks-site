-- Head sourcing deposit for custom builds (2026-10-15).
-- 10% of the build estimate ($25 min, $75 max). It counts toward the build, and it is refunded in full
-- if no genuine head is found at the quoted price or the customer turns down the head Jackson finds.
ALTER TABLE tickets ADD COLUMN deposit_cents INTEGER;          -- amount asked for (NULL = no deposit)
ALTER TABLE tickets ADD COLUMN deposit_requested_at TEXT;
ALTER TABLE tickets ADD COLUMN deposit_order_id TEXT;          -- Square order for the deposit checkout
ALTER TABLE tickets ADD COLUMN deposit_link_url TEXT;
ALTER TABLE tickets ADD COLUMN deposit_paid_at TEXT;
ALTER TABLE tickets ADD COLUMN deposit_due_by TEXT;            -- Jackson reports back by this time (paid + 48 hours)
CREATE INDEX IF NOT EXISTS tickets_deposit_order ON tickets(deposit_order_id);
