BEGIN;

ALTER TABLE reimbursement_requests
ADD COLUMN IF NOT EXISTS branch_manager_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS vice_president_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS senior_vice_president_status varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS approval_chain text,
ADD COLUMN IF NOT EXISTS attachment_name text;

COMMIT;