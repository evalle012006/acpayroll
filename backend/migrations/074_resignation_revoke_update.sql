BEGIN;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_effective_date DATE;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_branch_id INTEGER;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_branch_code VARCHAR(100);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_branch_name VARCHAR(255);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_area VARCHAR(255);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_region VARCHAR(255);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_division VARCHAR(255);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_position VARCHAR(255);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_department VARCHAR(255);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_remarks TEXT;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_attachment_path TEXT;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_attachment_name TEXT;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_attachment_mime TEXT;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_requested_by INTEGER;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS revoke_requested_at TIMESTAMP;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS senior_vice_president_status VARCHAR(50) DEFAULT 'Pending';

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS approved_amount NUMERIC DEFAULT 0;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS approved_total NUMERIC DEFAULT 0;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS approved_per_month NUMERIC DEFAULT 0;

COMMIT;