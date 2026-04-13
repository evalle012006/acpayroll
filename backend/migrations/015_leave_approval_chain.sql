BEGIN;

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS area_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS area_approved_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS regional_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS regional_approved_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS division_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS division_approved_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.leave_requests
SET status = 'Pending Area Manager'
WHERE status IS NULL
   OR status = ''
   OR status = 'Pending';

COMMIT;