BEGIN;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS description TEXT;

COMMIT;