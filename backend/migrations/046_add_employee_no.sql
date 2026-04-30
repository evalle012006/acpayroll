BEGIN;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS employee_no varchar(100),
ADD COLUMN IF NOT EXISTS settlement_branch_id integer,
ADD COLUMN IF NOT EXISTS settlement_branch_code varchar(100),
ADD COLUMN IF NOT EXISTS settlement_branch_name varchar(255),
ADD COLUMN IF NOT EXISTS attachment_path text,
ADD COLUMN IF NOT EXISTS attachment_name text,
ADD COLUMN IF NOT EXISTS attachment_mime text;

UPDATE public.settlements
SET staff_id = COALESCE(staff_id, employee_id)
WHERE staff_id IS NULL;

ALTER TABLE public.settlements
ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.staff
ALTER COLUMN status SET DEFAULT 'Active';

UPDATE public.staff
SET status = 'Active'
WHERE status IS NULL OR status = 'active';

UPDATE public.staff
SET status = 'Inactive'
WHERE status = 'inactive';

COMMIT;