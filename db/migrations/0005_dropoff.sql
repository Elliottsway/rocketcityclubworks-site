-- Drop-off step (2026-10-16): when the customer plans to bring their clubs, and when Jackson actually has them.
ALTER TABLE tickets ADD COLUMN dropoff_at TEXT;      -- requested drop-off time, free text ("Sat, Oct 18, Morning")
ALTER TABLE tickets ADD COLUMN clubs_in_at TEXT;     -- set when Jackson marks the clubs received
