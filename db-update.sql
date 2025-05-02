ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS telegram_registration_token TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS telegram_token_expiry TIMESTAMP;
