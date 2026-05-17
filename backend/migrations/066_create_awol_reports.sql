BEGIN;

CREATE TABLE IF NOT EXISTS public.awol_reports (
  id SERIAL PRIMARY KEY,
  report_no VARCHAR(50) UNIQUE NOT NULL,
  employee_id INTEGER NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  branch_id INTEGER,
  branch_code VARCHAR(100),
  branch_name VARCHAR(255),
  area VARCHAR(150),
  region VARCHAR(150),
  division VARCHAR(150),
  date_created DATE NOT NULL,
  awol_date DATE NOT NULL,
  details TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Vice President',
  created_by INTEGER,
  vp_approved_by INTEGER,
  vp_approved_at TIMESTAMP,
  hr_uploaded_by INTEGER,
  hr_uploaded_at TIMESTAMP,
  rejected_by INTEGER,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  request_attachment_path TEXT,
  request_attachment_name TEXT,
  request_attachment_mime TEXT,
  approved_attachment_path TEXT,
  approved_attachment_name TEXT,
  approved_attachment_mime TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT awol_reports_status_chk CHECK (
    status IN (
      'Pending Vice President',
      'Waiting HR Final File',
      'Approved',
      'Rejected'
    )
  )
);

COMMIT;