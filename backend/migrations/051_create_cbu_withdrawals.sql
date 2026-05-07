BEGIN;

CREATE TABLE IF NOT EXISTS public.cbu_withdrawals (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',

  disbursement_date DATE,

  attachment_path TEXT,
  attachment_name TEXT,
  approved_attachment_path TEXT,
  approved_attachment_name TEXT,

  approval_stage VARCHAR(100) DEFAULT 'Branch Manager',
  branch_manager_status VARCHAR(50) DEFAULT 'Pending',
  area_manager_status VARCHAR(50) DEFAULT 'Pending',
  regional_manager_status VARCHAR(50) DEFAULT 'Pending',
  avp_status VARCHAR(50) DEFAULT 'Pending',
  vp_status VARCHAR(50) DEFAULT 'Pending',
  svp_status VARCHAR(50) DEFAULT 'Pending',
  final_status VARCHAR(50) DEFAULT 'Pending',

  approved_by INTEGER,
  approved_at TIMESTAMP,
  rejected_by INTEGER,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbu_withdrawals_employee_id
ON public.cbu_withdrawals(employee_id);

CREATE INDEX IF NOT EXISTS idx_cbu_withdrawals_status
ON public.cbu_withdrawals(status);

COMMIT;