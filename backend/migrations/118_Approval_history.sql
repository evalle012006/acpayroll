BEGIN;

CREATE TABLE IF NOT EXISTS public.sbf_order_approval_history (
  id SERIAL PRIMARY KEY,

  sbf_order_id INTEGER NOT NULL
    REFERENCES public.sbf_orders(id)
    ON DELETE CASCADE,

  action VARCHAR(30) NOT NULL,

  acted_by_user_id INTEGER,
  acted_by_name TEXT,
  acted_by_role TEXT,
  acted_by_department TEXT,

  remarks TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
idx_sbf_order_approval_history_order_id
ON public.sbf_order_approval_history(sbf_order_id);

COMMIT;