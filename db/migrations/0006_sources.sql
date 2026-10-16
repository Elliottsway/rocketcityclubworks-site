-- Where customers come from (2026-10-17): "How did you hear about us?" at sign-up, and the link/QR/ad they arrived from.
ALTER TABLE customers ADD COLUMN source TEXT;   -- their answer, e.g. "Google search", "Golf course / pro shop: Colonial"
ALTER TABLE customers ADD COLUMN ref TEXT;      -- tracking tag from the link they first arrived on (?ref= or utm_source/utm_campaign)
