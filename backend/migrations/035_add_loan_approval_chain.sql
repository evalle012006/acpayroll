BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS approval_stage varchar(100) DEFAULT 'branch manager',
ADD COLUMN IF NOT EXISTS branch_manager_status varchar(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS area_manager_status varchar(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS regional_manager_status varchar(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS assistant_vice_president_status varchar(20) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS admin_status varchar(20) DEFAULT 'Pending';

COMMIT;