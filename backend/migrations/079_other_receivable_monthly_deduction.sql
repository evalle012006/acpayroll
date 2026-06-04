BEGIN;

ALTER TABLE public.other_receivables
ADD COLUMN IF NOT EXISTS term INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS per_month NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deduction_start_date DATE,
ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

UPDATE public.other_receivables
SET
  term = COALESCE(term, 1),
  per_month = CASE
    WHEN COALESCE(per_month, 0) > 0 THEN per_month
    WHEN COALESCE(term, 0) > 0 THEN COALESCE(amount, 0) / term
    ELSE COALESCE(amount, 0)
  END,
  deduction_start_date = COALESCE(deduction_start_date, release_date, approved_at::date, created_at::date),
  balance = COALESCE(balance, amount, 0),
  updated_at = NOW();

COMMIT;