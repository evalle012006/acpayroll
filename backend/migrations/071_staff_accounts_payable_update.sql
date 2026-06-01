BEGIN;

ALTER TABLE public.staff_accounts_payable
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE public.awol_reports
ADD COLUMN IF NOT EXISTS report_type VARCHAR(100) DEFAULT 'AWOL Report';

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

ALTER TABLE public.awol_reports
DROP CONSTRAINT IF EXISTS awol_reports_status_chk;

UPDATE public.awol_reports
SET status = TRIM(status)
WHERE status IS NOT NULL;

ALTER TABLE public.awol_reports
ADD CONSTRAINT awol_reports_status_chk
CHECK (
  TRIM(status) IN (
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

CREATE TABLE IF NOT EXISTS public.staff_attachments (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  original_name VARCHAR(255),
  file_key TEXT,
  mime_type VARCHAR(255),
  uploaded_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS file_key TEXT;

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255);

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS uploaded_by INTEGER;

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_staff_attachments_staff
ON public.staff_attachments(staff_id);

COMMIT;