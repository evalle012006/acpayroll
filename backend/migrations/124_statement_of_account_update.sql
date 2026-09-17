BEGIN;

-- ============================================================
-- STATEMENT OF ACCOUNTS / SETTLEMENT APPROVAL WORKFLOW
--
-- Workflow:
--   hr_initial
--      ↓
--   branch
--      ↓
--   hr_final
--      ↓
--   completed
-- ============================================================


-- ============================================================
-- 1. MAIN WORKFLOW FIELDS
-- ============================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending';

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS approval_stage VARCHAR(50) DEFAULT 'hr_initial';


-- ============================================================
-- 2. HR INITIAL APPROVAL
-- HR uploads the initial settlement document.
-- ============================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_initial_status VARCHAR(50) DEFAULT 'Pending';

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_initial_approved_by INTEGER;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_initial_approved_at TIMESTAMPTZ;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_initial_attachment_path TEXT;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_initial_attachment_name TEXT;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_initial_attachment_mime VARCHAR(255);


-- ============================================================
-- 3. SETTLEMENT BRANCH APPROVAL
-- Selected Settlement Branch uploads its document.
-- ============================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS branch_status VARCHAR(50) DEFAULT 'Pending';

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS branch_approved_by INTEGER;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS branch_approved_at TIMESTAMPTZ;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS branch_attachment_path TEXT;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS branch_attachment_name TEXT;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS branch_attachment_mime VARCHAR(255);


-- ============================================================
-- 4. HR FINAL APPROVAL
-- HR uploads the final settlement document.
-- ============================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_final_status VARCHAR(50) DEFAULT 'Pending';

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_final_approved_by INTEGER;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_final_approved_at TIMESTAMPTZ;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_final_attachment_path TEXT;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_final_attachment_name TEXT;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS hr_final_attachment_mime VARCHAR(255);


-- ============================================================
-- 5. REJECTION INFORMATION
-- Shared rejection information for the workflow.
-- ============================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS rejected_by INTEGER;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;


-- ============================================================
-- 6. COMPLETION INFORMATION
-- ============================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS completed_by INTEGER;

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;


-- ============================================================
-- 7. UPDATE NULL VALUES ON EXISTING RECORDS
--
-- We do NOT mark old records Approved automatically.
-- Existing records without workflow data will start at HR Initial.
-- ============================================================

UPDATE public.settlements
SET
  status = COALESCE(NULLIF(TRIM(status), ''), 'Pending'),
  approval_stage = COALESCE(
    NULLIF(TRIM(approval_stage), ''),
    'hr_initial'
  ),
  hr_initial_status = COALESCE(
    NULLIF(TRIM(hr_initial_status), ''),
    'Pending'
  ),
  branch_status = COALESCE(
    NULLIF(TRIM(branch_status), ''),
    'Pending'
  ),
  hr_final_status = COALESCE(
    NULLIF(TRIM(hr_final_status), ''),
    'Pending'
  );


-- ============================================================
-- 8. DEFAULTS
-- ============================================================

ALTER TABLE public.settlements
ALTER COLUMN status SET DEFAULT 'Pending';

ALTER TABLE public.settlements
ALTER COLUMN approval_stage SET DEFAULT 'hr_initial';

ALTER TABLE public.settlements
ALTER COLUMN hr_initial_status SET DEFAULT 'Pending';

ALTER TABLE public.settlements
ALTER COLUMN branch_status SET DEFAULT 'Pending';

ALTER TABLE public.settlements
ALTER COLUMN hr_final_status SET DEFAULT 'Pending';


-- ============================================================
-- 9. INDEXES
-- Helpful for workflow/status filtering.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_settlements_status
ON public.settlements (status);

CREATE INDEX IF NOT EXISTS idx_settlements_approval_stage
ON public.settlements (approval_stage);

CREATE INDEX IF NOT EXISTS idx_settlements_branch_code
ON public.settlements (settlement_branch_code);


COMMIT;