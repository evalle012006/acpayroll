BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_mime TEXT;

COMMIT;