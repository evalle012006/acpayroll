BEGIN;

UPDATE awol_reports
SET status = 'Waiting HR Final File'
WHERE status IN (
  'Pending Vice President',
  'Pending',
  'For VP Approval'
);

UPDATE awol_reports
SET status = 'Approved'
WHERE status = 'Final Approved';

ALTER TABLE awol_reports
DROP CONSTRAINT IF EXISTS awol_reports_status_chk;

ALTER TABLE awol_reports
ADD CONSTRAINT awol_reports_status_chk
CHECK (
  status IN (
    'Waiting HR Final File',
    'Approved',
    'Rejected',
    'Voided'
  )
);

ALTER TABLE public.awol_reports
ADD COLUMN IF NOT EXISTS approved_by INTEGER,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

ALTER TABLE public.sbf_orders
ADD COLUMN IF NOT EXISTS attachment_path TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_mime TEXT;

COMMIT;