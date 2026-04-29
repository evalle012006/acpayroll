BEGIN;

ALTER TABLE public.promotion_orders
ADD COLUMN IF NOT EXISTS applicant_role varchar(100),
ADD COLUMN IF NOT EXISTS approval_stage varchar(100),
ADD COLUMN IF NOT EXISTS branch_manager_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS area_manager_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS regional_manager_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS assistant_vice_president_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS vice_president_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS tread_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS final_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS approved_attachment_path text,
ADD COLUMN IF NOT EXISTS approved_attachment_name text,
ADD COLUMN IF NOT EXISTS approved_attachment_mime text;

COMMIT;