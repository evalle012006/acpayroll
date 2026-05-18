BEGIN;

CREATE TABLE IF NOT EXISTS public.monthly_balance_postings (
  id SERIAL PRIMARY KEY,
  month_label VARCHAR(20) NOT NULL,
  employee_no VARCHAR(100) NOT NULL,
  cbu NUMERIC DEFAULT 0,
  cashbond NUMERIC DEFAULT 0,
  utility NUMERIC DEFAULT 0,
  posted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (month_label, employee_no)
);

COMMIT;