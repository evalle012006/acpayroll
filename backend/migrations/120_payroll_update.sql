BEGIN;

ALTER TABLE public.schedule_balance_snapshots
ADD COLUMN IF NOT EXISTS sss_loan INTEGER;

CREATE TABLE public.pagibig_remittances (
  id SERIAL PRIMARY KEY,

  payroll_month VARCHAR(7) NOT NULL,

  staff_id INTEGER,
  employee_no VARCHAR(100) NOT NULL,
  employee_name TEXT NOT NULL,
  position TEXT,

  branch_id INTEGER,
  branch_name TEXT,

  hdmf NUMERIC(12,2) NOT NULL DEFAULT 0,
  sss NUMERIC(12,2) NOT NULL DEFAULT 0,
  philhealth NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,

  contribution NUMERIC(12,2) NOT NULL DEFAULT 0,

  status VARCHAR(30) NOT NULL DEFAULT 'pending',

  remittance_date DATE,
  reference_no VARCHAR(255),
  remarks TEXT,

  created_by INTEGER,
  updated_by INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (payroll_month, employee_no)
);

ALTER TABLE public.demotion_orders
  ADD COLUMN IF NOT EXISTS prev_division TEXT,
  ADD COLUMN IF NOT EXISTS prev_region TEXT,
  ADD COLUMN IF NOT EXISTS prev_area TEXT,
  ADD COLUMN IF NOT EXISTS prev_department TEXT,

  ADD COLUMN IF NOT EXISTS to_division TEXT,
  ADD COLUMN IF NOT EXISTS to_region TEXT,
  ADD COLUMN IF NOT EXISTS to_area TEXT,
  ADD COLUMN IF NOT EXISTS to_department TEXT;

  ALTER TABLE public.resignation_requests
ALTER COLUMN effective_date DROP NOT NULL;

COMMIT;