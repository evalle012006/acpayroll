BEGIN ;

ALTER TABLE public.suspension_extension_history
  ADD COLUMN IF NOT EXISTS previous_deductions JSONB,
  ADD COLUMN IF NOT EXISTS updated_deductions JSONB,
  ADD COLUMN IF NOT EXISTS previous_total_deduction NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS new_total_deduction NUMERIC(14,2);

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS reapplication_date DATE;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS rejected_stage TEXT;

COMMIT;