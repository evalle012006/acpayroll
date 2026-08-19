BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS branch_manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS area_manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS regional_manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assistant_vice_president_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS vice_president_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS senior_vice_president_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accounting_approved_at TIMESTAMPTZ;

ALTER TABLE public.cbu_withdrawals
ADD COLUMN IF NOT EXISTS branch_manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS area_manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS regional_manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS avp_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS vp_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS svp_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accounting_approved_at TIMESTAMPTZ;

ALTER TABLE public.reimbursement_requests
ADD COLUMN IF NOT EXISTS branch_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS area_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS regional_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS assistant_vice_president_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS vice_president_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS senior_vice_president_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMP;

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS vice_president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS vice_president_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS senior_vice_president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS senior_vice_president_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS hr_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMPTZ;

ALTER TABLE public.promotion_orders
ADD COLUMN IF NOT EXISTS branch_manager_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS branch_manager_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS area_manager_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS area_manager_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS regional_manager_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS regional_manager_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS assistant_vice_president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS assistant_vice_president_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS vice_president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS vice_president_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS senior_vice_president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS senior_vice_president_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS tread_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS tread_approved_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS final_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ;

COMMIT;