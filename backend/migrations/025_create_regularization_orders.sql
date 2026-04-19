BEGIN;

CREATE TABLE IF NOT EXISTS public.regularization_orders (
  id BIGINT PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,

  employee_id INTEGER NOT NULL,
  employee_no VARCHAR(100),
  employee_name VARCHAR(255) NOT NULL,

  branch_id INTEGER,
  branch_label VARCHAR(255),

  date_created DATE NOT NULL,
  effective_date DATE NOT NULL,

  previous_position VARCHAR(255),
  present_position VARCHAR(255) NOT NULL,

  previous_salary NUMERIC(12,2) DEFAULT 0,
  present_salary NUMERIC(12,2) DEFAULT 0,

  previous_ecola NUMERIC(12,2) DEFAULT 0,
  present_ecola NUMERIC(12,2) DEFAULT 0,

  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,

  remarks TEXT,

  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  rejection_reason TEXT,

  created_by INTEGER,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  rejected_by INTEGER,
  rejected_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regularization_orders_employee_id
  ON public.regularization_orders(employee_id);

CREATE INDEX IF NOT EXISTS idx_regularization_orders_status
  ON public.regularization_orders(status);

CREATE INDEX IF NOT EXISTS idx_regularization_orders_branch_id
  ON public.regularization_orders(branch_id);

COMMIT;