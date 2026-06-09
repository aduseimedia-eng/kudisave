CREATE TABLE IF NOT EXISTS account_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_type VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, account_type),
  CHECK (account_type IN (
    'Cash',
    'Bank',
    'Visa Card',
    'MTN MoMo',
    'Telecel Cash',
    'AirtelTigo Money'
  ))
);

CREATE INDEX IF NOT EXISTS idx_account_balances_user_id ON account_balances(user_id);
