BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS vice_president_status VARCHAR(50) DEFAULT 'Pending';

COMMIT;