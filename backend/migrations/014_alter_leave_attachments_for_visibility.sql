BEGIN;

ALTER TABLE public.leave_attachments
ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(20) NOT NULL DEFAULT 'request',
ADD COLUMN IF NOT EXISTS uploaded_by INTEGER,
ADD COLUMN IF NOT EXISTS uploaded_by_role VARCHAR(100),
ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE INDEX IF NOT EXISTS idx_leave_attachments_type
ON public.leave_attachments(attachment_type);

COMMIT;