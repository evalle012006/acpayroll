BEGIN;

CREATE TABLE IF NOT EXISTS public.transportation_history (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL,
  staff_id INTEGER NOT NULL,
  employee_no VARCHAR(100),
  history_month VARCHAR(7) NOT NULL, -- YYYY-MM

  postage NUMERIC(12,2) DEFAULT 0,
  transportation NUMERIC(12,2) DEFAULT 0,
  additional_target NUMERIC(12,2) DEFAULT 0,
  repairing NUMERIC(12,2) DEFAULT 0,
  additional_monitoring NUMERIC(12,2) DEFAULT 0,
  motorcycle_loan NUMERIC(12,2) DEFAULT 0,
  other_deduction NUMERIC(12,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT transportation_history_unique
    UNIQUE (branch_id, staff_id, history_month)
);

CREATE INDEX IF NOT EXISTS idx_transportation_history_branch_month
  ON public.transportation_history(branch_id, history_month);

CREATE INDEX IF NOT EXISTS idx_transportation_history_staff_month
  ON public.transportation_history(staff_id, history_month);

COMMIT;