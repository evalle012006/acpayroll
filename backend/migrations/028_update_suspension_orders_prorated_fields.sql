BEGIN;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS prorated_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prorated_ecola NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prorated_transportation NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prorated_repairing NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prorated_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prorated_postage NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.suspension_orders
SET total_deduction =
  COALESCE(prorated_salary, 0) +
  COALESCE(prorated_ecola, 0) +
  COALESCE(prorated_transportation, 0) +
  COALESCE(prorated_repairing, 0) +
  COALESCE(prorated_allowance, 0) +
  COALESCE(prorated_postage, 0)
WHERE
  COALESCE(prorated_salary, 0) <> 0 OR
  COALESCE(prorated_ecola, 0) <> 0 OR
  COALESCE(prorated_transportation, 0) <> 0 OR
  COALESCE(prorated_repairing, 0) <> 0 OR
  COALESCE(prorated_allowance, 0) <> 0 OR
  COALESCE(prorated_postage, 0) <> 0;

COMMIT;