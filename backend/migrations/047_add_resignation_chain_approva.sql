BEGIN;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS branch_manager_approved_by integer,
ADD COLUMN IF NOT EXISTS branch_manager_approved_at timestamp,
ADD COLUMN IF NOT EXISTS area_manager_approved_by integer,
ADD COLUMN IF NOT EXISTS area_manager_approved_at timestamp,
ADD COLUMN IF NOT EXISTS vp_approved_by integer,
ADD COLUMN IF NOT EXISTS vp_approved_at timestamp,
ADD COLUMN IF NOT EXISTS svp_approved_by integer,
ADD COLUMN IF NOT EXISTS svp_approved_at timestamp,
ADD COLUMN IF NOT EXISTS president_approved_by integer,
ADD COLUMN IF NOT EXISTS president_approved_at timestamp;


COMMIT;