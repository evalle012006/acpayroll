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

CREATE TABLE IF NOT EXISTS public.staff_attachments (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  file_label TEXT,
  original_name TEXT,
  filename TEXT,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_attachments (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_key TEXT NOT NULL,
    mime_type VARCHAR(255),

    uploaded_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_attachments_staff
ON public.staff_attachments(staff_id);

ALTER TABLE public.staff_attachments
ADD COLUMN IF NOT EXISTS file_key TEXT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS uploaded_by INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE public.staff_attachments
SET file_key = file_url
WHERE file_key IS NULL
  AND file_url IS NOT NULL;

COMMIT;