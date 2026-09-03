BEGIN;

ALTER TABLE public.resignation_requests
ALTER COLUMN effective_date DROP NOT NULL;

COMMIT;