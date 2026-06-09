DO $$
DECLARE
  constraint_record RECORD;
BEGIN
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
        'Bank Transfer',
        'AirtelTigo Money'
      )
    ) NOT VALID;
END $$;
