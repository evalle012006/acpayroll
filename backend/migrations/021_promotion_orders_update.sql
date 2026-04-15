BEGIN;

ALTER TABLE public.promotion_orders
ADD COLUMN IF NOT EXISTS old_salary numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_salary numeric(12,2) DEFAULT 0,

ADD COLUMN IF NOT EXISTS prev_branch_id integer,
ADD COLUMN IF NOT EXISTS prev_branch_code varchar(100),
ADD COLUMN IF NOT EXISTS prev_branch_name varchar(255),

ADD COLUMN IF NOT EXISTS present_branch_id integer,
ADD COLUMN IF NOT EXISTS present_branch_code varchar(100),
ADD COLUMN IF NOT EXISTS present_branch_name varchar(255),

ADD COLUMN IF NOT EXISTS attachment_path text,
ADD COLUMN IF NOT EXISTS attachment_name text,
ADD COLUMN IF NOT EXISTS attachment_mime text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_orders_prev_branch_id_fkey'
  ) THEN
    ALTER TABLE public.promotion_orders
    ADD CONSTRAINT promotion_orders_prev_branch_id_fkey
    FOREIGN KEY (prev_branch_id)
    REFERENCES public.branches(id)
    ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_orders_present_branch_id_fkey'
  ) THEN
    ALTER TABLE public.promotion_orders
    ADD CONSTRAINT promotion_orders_present_branch_id_fkey
    FOREIGN KEY (present_branch_id)
    REFERENCES public.branches(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotion_orders_employee_id
  ON public.promotion_orders(employee_id);

CREATE INDEX IF NOT EXISTS idx_promotion_orders_prev_branch_id
  ON public.promotion_orders(prev_branch_id);

CREATE INDEX IF NOT EXISTS idx_promotion_orders_present_branch_id
  ON public.promotion_orders(present_branch_id);

COMMIT;