BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS loan_purpose VARCHAR(100);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'cbu_withdrawals'
  ) THEN
    ALTER TABLE public.cbu_withdrawals
    ADD COLUMN IF NOT EXISTS disbursement_date DATE,
    ADD COLUMN IF NOT EXISTS attachment_path TEXT,
    ADD COLUMN IF NOT EXISTS attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS approved_attachment_path TEXT,
    ADD COLUMN IF NOT EXISTS approved_attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS approval_stage VARCHAR(100) DEFAULT 'Branch Manager',
    ADD COLUMN IF NOT EXISTS branch_manager_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS area_manager_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS regional_manager_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS avp_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS vp_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS svp_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS final_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS approved_by INTEGER,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS rejected_by INTEGER,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
  END IF;
END $$;

COMMIT;