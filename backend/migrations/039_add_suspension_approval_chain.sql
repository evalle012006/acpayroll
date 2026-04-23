BEGIN;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS approval_stage VARCHAR(100),
ADD COLUMN IF NOT EXISTS area_manager_status VARCHAR(30) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS regional_manager_status VARCHAR(30) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS admin_status VARCHAR(30) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS area_manager_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS area_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS regional_manager_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS regional_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS assistant_vice_president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS assistant_vice_president_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS admin_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS approved_attachment_mime TEXT;

UPDATE public.suspension_orders
SET
  approval_stage = COALESCE(NULLIF(TRIM(approval_stage), ''), 'area manager'),
  area_manager_status = COALESCE(NULLIF(TRIM(area_manager_status), ''), 'Pending'),
  regional_manager_status = COALESCE(NULLIF(TRIM(regional_manager_status), ''), 'Pending'),
  assistant_vice_president_status = COALESCE(NULLIF(TRIM(assistant_vice_president_status), ''), 'Pending'),
  admin_status = COALESCE(NULLIF(TRIM(admin_status), ''), 'Pending')
WHERE
  approval_stage IS NULL
  OR area_manager_status IS NULL
  OR regional_manager_status IS NULL
  OR assistant_vice_president_status IS NULL
  OR admin_status IS NULL;

COMMIT;