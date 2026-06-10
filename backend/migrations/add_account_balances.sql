CREATE TABLE IF NOT EXISTS account_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_key VARCHAR(120),
  account_type VARCHAR(50) NOT NULL,
  account_name VARCHAR(80),
  payment_method VARCHAR(50),
  account_mask VARCHAR(12),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (account_type IN (
    'Cash',
    'Bank',
    'Visa Card',
    'Mastercard',
    'MTN MoMo',
    'Telecel Cash',
    'AirtelTigo Money'
  ))
);

ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS account_key VARCHAR(120);
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS account_name VARCHAR(80);
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS account_mask VARCHAR(12);

UPDATE account_balances
SET
  account_name = COALESCE(NULLIF(account_name, ''), account_type),
  payment_method = COALESCE(
    NULLIF(payment_method, ''),
    CASE
      WHEN account_type = 'Bank' THEN 'Bank Transfer'
      ELSE account_type
    END
  ),
  account_key = COALESCE(
    NULLIF(account_key, ''),
    'default-' || regexp_replace(lower(account_type), '[^a-z0-9]+', '-', 'g')
  )
WHERE account_key IS NULL
   OR account_name IS NULL
   OR payment_method IS NULL;

ALTER TABLE account_balances ALTER COLUMN account_key SET NOT NULL;
ALTER TABLE account_balances ALTER COLUMN account_name SET DEFAULT 'Account';

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'account_balances'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%account_type%'
  LOOP
    EXECUTE format('ALTER TABLE account_balances DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_balances_user_id ON account_balances(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_user_account_key ON account_balances(user_id, account_key);
