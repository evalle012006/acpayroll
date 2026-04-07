BEGIN;

ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS region varchar(150),
ADD COLUMN IF NOT EXISTS division varchar(150);

COMMIT;