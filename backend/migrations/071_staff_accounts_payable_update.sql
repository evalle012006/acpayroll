BEGIN;

-- =====================================================
-- STAFF ACCOUNTS PAYABLE
-- =====================================================

ALTER TABLE public.staff_accounts_payable
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- =====================================================
-- AWOL REPORTS
-- =====================================================

ALTER TABLE public.awol_reports
ADD COLUMN IF NOT EXISTS report_type VARCHAR(100)
DEFAULT 'AWOL Report';

-- Remove old constraint
ALTER TABLE public.awol_reports
DROP CONSTRAINT IF EXISTS awol_reports_status_chk;

-- Fix existing data first
UPDATE public.awol_reports
SET status = 'Approved'
WHERE status IS NULL;

UPDATE public.awol_reports
SET status = TRIM(status)
WHERE status IS NOT NULL;

UPDATE public.awol_reports
SET status = 'Approved'
WHERE status NOT IN (
  'Waiting Area Manager Approval',
  'Waiting Regional Manager Approval',
  'Waiting Assistant Vice President Approval',
  'Waiting Vice President Approval',
  'Waiting Final File Upload',
  'Approved',
  'Rejected',
  'Voided'
);

-- Recreate constraint
ALTER TABLE public.awol_reports
ADD CONSTRAINT awol_reports_status_chk
CHECK (
  status IN (
    'Waiting Area Manager Approval',
    'Waiting Regional Manager Approval',
    'Waiting Assistant Vice President Approval',
    'Waiting Vice President Approval',
    'Waiting Final File Upload',
    'Approved',
    'Rejected',
    'Voided'
  )
);

-- =====================================================
-- STAFF ACCOUNTS PAYABLE HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.staff_accounts_payable_history (
    id SERIAL PRIMARY KEY,

    payable_id BIGINT,

    employee_no VARCHAR(100),

    month_label VARCHAR(20),

    deducted_amount NUMERIC DEFAULT 0,

    previous_balance NUMERIC DEFAULT 0,

    new_balance NUMERIC DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sap_history_payable
ON public.staff_accounts_payable_history(payable_id);

CREATE INDEX IF NOT EXISTS idx_sap_history_employee
ON public.staff_accounts_payable_history(employee_no);

CREATE INDEX IF NOT EXISTS idx_sap_history_month
ON public.staff_accounts_payable_history(month_label);

-- =====================================================
-- STAFF ATTACHMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.staff_attachments (
    id SERIAL PRIMARY KEY,

    staff_id INTEGER NOT NULL
        REFERENCES public.staff(id)
        ON DELETE CASCADE,

    file_label TEXT,

    file_name VARCHAR(255),

    original_name VARCHAR(255),

    filename TEXT,

    file_path TEXT,

    file_key TEXT,

    mime_type VARCHAR(255),

    file_size INTEGER DEFAULT 0,

    uploaded_by INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_attachments_staff
ON public.staff_attachments(staff_id);

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS file_label TEXT,
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS filename TEXT,
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_key TEXT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS uploaded_by INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

COMMIT;