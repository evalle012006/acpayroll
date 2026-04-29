
BEGIN;

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS annual_leave NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sick_leave NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_leave NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS maternity_leave NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS parental_leave NUMERIC DEFAULT 0;

UPDATE public.staff
SET
  annual_leave = COALESCE(annual_leave, 0),
  sick_leave = COALESCE(sick_leave, 0),
  emergency_leave = COALESCE(emergency_leave, 0),
  maternity_leave = COALESCE(maternity_leave, 0),
  parental_leave = COALESCE(parental_leave, 0);

COMMIT;