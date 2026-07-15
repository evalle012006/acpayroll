BEGIN;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

UPDATE public.users
SET status = 'Active'
WHERE status IS NULL
   OR TRIM(status) = '';

ALTER TABLE public.users
ALTER COLUMN status SET DEFAULT 'Active';

COMMIT;