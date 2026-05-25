-- Add base_currency to profiles.
-- base_currency stores the currency the user's financial data was entered in.
-- currency stores the display/view currency (may differ after a currency change).
-- When base_currency IS NULL it is treated as equal to currency (no conversion).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_currency text;
