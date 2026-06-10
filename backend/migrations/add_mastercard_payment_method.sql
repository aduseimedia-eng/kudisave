DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  IF to_regclass('account_balances') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'account_balances'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%account_type%'
    LOOP
      EXECUTE format('ALTER TABLE account_balances DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;

    ALTER TABLE account_balances
      ADD CONSTRAINT account_balances_account_type_check
      CHECK (
        account_type IN (
          'Cash',
          'Bank',
          'Visa Card',
          'Mastercard',
          'MTN MoMo',
          'Telecel Cash',
          'AirtelTigo Money'
        )
      ) NOT VALID;
  END IF;

  IF to_regclass('expenses') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'expenses'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%payment_method%'
    LOOP
      EXECUTE format('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;

    ALTER TABLE expenses
      ADD CONSTRAINT expenses_payment_method_check
      CHECK (
        payment_method IN (
          'Cash',
          'MTN MoMo',
          'Telecel Cash',
          'Visa Card',
          'Mastercard',
          'Bank Transfer',
          'AirtelTigo Money'
        )
      ) NOT VALID;
  END IF;

  IF to_regclass('payment_methods') IS NOT NULL THEN
    INSERT INTO payment_methods (name) VALUES ('Mastercard') ON CONFLICT DO NOTHING;
  END IF;
END $$;
