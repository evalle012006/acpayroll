BEGIN;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS days_of_suspension integer;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS basic_salary numeric(12,2) DEFAULT 0;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS ecola numeric(12,2) DEFAULT 0;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS transportation numeric(12,2) DEFAULT 0;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS deduction_basic numeric(12,2) DEFAULT 0;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS deduction_ecola numeric(12,2) DEFAULT 0;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS deduction_transportation numeric(12,2) DEFAULT 0;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS total_deduction numeric(12,2) DEFAULT 0;

UPDATE public.suspension_orders
SET
  days_of_suspension = COALESCE(days_of_suspension, 0),
  basic_salary = COALESCE(basic_salary, 0),
  ecola = COALESCE(ecola, 0),
  transportation = COALESCE(transportation, 0),
  deduction_basic = COALESCE(deduction_basic, 0),
  deduction_ecola = COALESCE(deduction_ecola, 0),
  deduction_transportation = COALESCE(deduction_transportation, 0),
  total_deduction = COALESCE(total_deduction, 0);

ALTER TABLE public.suspension_orders
ALTER COLUMN basic_salary SET DEFAULT 0;

ALTER TABLE public.suspension_orders
ALTER COLUMN ecola SET DEFAULT 0;

ALTER TABLE public.suspension_orders
ALTER COLUMN transportation SET DEFAULT 0;

ALTER TABLE public.suspension_orders
ALTER COLUMN deduction_basic SET DEFAULT 0;

ALTER TABLE public.suspension_orders
ALTER COLUMN deduction_ecola SET DEFAULT 0;

ALTER TABLE public.suspension_orders
ALTER COLUMN deduction_transportation SET DEFAULT 0;

ALTER TABLE public.suspension_orders
ALTER COLUMN total_deduction SET DEFAULT 0;

COMMIT;