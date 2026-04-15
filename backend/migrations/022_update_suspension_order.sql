BEGIN;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS suspension_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS attachment_path TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_mime TEXT;

COMMIT;