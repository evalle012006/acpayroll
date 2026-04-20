BEGIN;

ALTER TABLE public.reimbursement_requests
ADD COLUMN IF NOT EXISTS request_type VARCHAR(100);

ALTER TABLE public.reimbursement_requests
ADD COLUMN IF NOT EXISTS reimbursement_date DATE;

COMMIT;