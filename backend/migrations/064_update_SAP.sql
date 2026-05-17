BEGIN;

ALTER TABLE public.staff_accounts_payable
ADD COLUMN IF NOT EXISTS attachment_path TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_mime TEXT;

COMMIT;