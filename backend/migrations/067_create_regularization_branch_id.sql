BEGIN;

ALTER TABLE public.regularization_orders
ADD COLUMN IF NOT EXISTS regularization_branch_id INTEGER,
ADD COLUMN IF NOT EXISTS regularization_branch_label VARCHAR(255),
ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_mime TEXT;

COMMIT;