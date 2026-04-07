BEGIN;

ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS region varchar(150),
ADD COLUMN IF NOT EXISTS division varchar(150);

UPDATE public.branches
SET region = COALESCE(region, ''),
    division = COALESCE(division, '');

COMMIT;