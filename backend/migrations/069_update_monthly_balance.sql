BEGIN;

CREATE TABLE IF NOT EXISTS public.schedule_balance_snapshots (
  id SERIAL PRIMARY KEY,

  snapshot_month DATE NOT NULL,

  staff_id INTEGER,
  employee_no VARCHAR(100),

  fullname TEXT,
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,

  position TEXT,

  branch_id INTEGER,
  branch_code VARCHAR(100),
  branch_name VARCHAR(255),

  area VARCHAR(255),
  region VARCHAR(255),
  division VARCHAR(255),

  cbu NUMERIC DEFAULT 0,
  cashbond NUMERIC DEFAULT 0,
  utility NUMERIC DEFAULT 0,

  salary_loan NUMERIC DEFAULT 0,
  salary_advance NUMERIC DEFAULT 0,
  motorcycle_loan NUMERIC DEFAULT 0,
  special_advance NUMERIC DEFAULT 0,
  cash_advance NUMERIC DEFAULT 0,

  other_receivable NUMERIC DEFAULT 0,
  staff_accounts_payable NUMERIC DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedule_balance_snapshots_month_staff_unique'
  ) THEN

    ALTER TABLE public.schedule_balance_snapshots
    ADD CONSTRAINT schedule_balance_snapshots_month_staff_unique
    UNIQUE (snapshot_month, staff_id);

  END IF;
END $$;

COMMIT;