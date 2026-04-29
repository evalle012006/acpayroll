BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS applicant_role VARCHAR(100);

COMMIT;