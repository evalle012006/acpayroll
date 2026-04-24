BEGIN;

ALTER TABLE public.reimbursement_requests
ADD COLUMN IF NOT EXISTS approval_stage VARCHAR(100) DEFAULT 'area manager',
ADD COLUMN IF NOT EXISTS area_manager_status VARCHAR(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS regional_manager_status VARCHAR(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS assistant_vice_president_status VARCHAR(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS admin_status VARCHAR(20) DEFAULT 'Pending';

COMMIT;