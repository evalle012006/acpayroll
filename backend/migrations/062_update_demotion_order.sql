BEGIN;

ALTER TABLE public.demotion_orders
ADD COLUMN IF NOT EXISTS approval_stage VARCHAR(100) DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS area_manager_status VARCHAR(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS regional_manager_status VARCHAR(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS assistant_vice_president_status VARCHAR(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS vice_president_status VARCHAR(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS admin_status VARCHAR(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS attachment_path TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_mime TEXT;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_mime TEXT,
ADD COLUMN IF NOT EXISTS svp_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS svp_approved_at TIMESTAMP;

COMMIT;