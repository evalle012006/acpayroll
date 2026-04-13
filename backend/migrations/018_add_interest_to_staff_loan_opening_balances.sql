BEGIN;

ALTER TABLE public.staff_loan_opening_balances
ADD COLUMN IF NOT EXISTS interest numeric(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_amount numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.staff_loan_opening_balances
SET
  interest = COALESCE(interest, 0),
  interest_amount = ROUND(COALESCE(original_amount, 0) * (COALESCE(interest, 0) / 100.0), 2),
  total_amount = ROUND(
    COALESCE(original_amount, 0) +
    (COALESCE(original_amount, 0) * (COALESCE(interest, 0) / 100.0)),
    2
  );

COMMIT;