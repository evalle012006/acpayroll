BEGIN;

-- =====================================================
-- ADD BRANCH MANAGER APPROVAL COLUMNS
-- =====================================================

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS branch_approved_by BIGINT;

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS branch_approved_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_leave_requests_branch_approved_by
ON public.leave_requests(branch_approved_by);

COMMIT;