BEGIN;

CREATE TABLE IF NOT EXISTS public.other_receivables (
  id SERIAL PRIMARY KEY,

  employee_id INTEGER,
  employee_no VARCHAR(100),
  employee_name VARCHAR(255),

  branch VARCHAR(255),
  area VARCHAR(255),
  region VARCHAR(255),
  division VARCHAR(255),
  department VARCHAR(255),

  description TEXT,

  amount NUMERIC(12,2) DEFAULT 0,

  release_date DATE,

  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,

  status VARCHAR(50) DEFAULT 'Pending',

  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  approved_by INTEGER,
  approved_at TIMESTAMP,

  rejected_by INTEGER,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,

  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.staff_accounts_payable
ADD COLUMN IF NOT EXISTS release_date DATE;

COMMIT;