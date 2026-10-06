BEGIN;

CREATE TABLE IF NOT EXISTS public.bonus_computations (
    id BIGSERIAL PRIMARY KEY,

    staff_id BIGINT NOT NULL
        REFERENCES public.staff(id)
        ON DELETE CASCADE,

    computation_year INTEGER NOT NULL,

    computation_month INTEGER NOT NULL
        CHECK (computation_month BETWEEN 1 AND 12),

    month_13 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_14 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_15 NUMERIC(15,2) NOT NULL DEFAULT 0,

    created_by BIGINT NULL,
    updated_by BIGINT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bonus_computations_staff_year_month_unique
        UNIQUE (
            staff_id,
            computation_year,
            computation_month
        ),

    CONSTRAINT bonus_computations_year_check
        CHECK (
            computation_year BETWEEN 2000 AND 2100
        ),

    CONSTRAINT bonus_computations_month_13_check
        CHECK (month_13 >= 0),

    CONSTRAINT bonus_computations_month_14_check
        CHECK (month_14 >= 0),

    CONSTRAINT bonus_computations_month_15_check
        CHECK (month_15 >= 0)
);

CREATE INDEX IF NOT EXISTS
    idx_bonus_computations_staff_id
ON public.bonus_computations(staff_id);

CREATE INDEX IF NOT EXISTS
    idx_bonus_computations_year
ON public.bonus_computations(computation_year);

CREATE INDEX IF NOT EXISTS
    idx_bonus_computations_staff_year
ON public.bonus_computations(
    staff_id,
    computation_year
);

ALTER TABLE public.bonus_computations
    ADD COLUMN total_compensation numeric NOT NULL DEFAULT 0,
    ADD COLUMN deductions numeric NOT NULL DEFAULT 0;

ALTER TABLE public.bonus_runs
ADD COLUMN IF NOT EXISTS bonus_type varchar(20);

UPDATE public.bonus_runs
SET bonus_type = '13th Month'
WHERE bonus_type IS NULL;

ALTER TABLE public.bonus_runs
ALTER COLUMN bonus_type SET DEFAULT '13th Month';

ALTER TABLE public.bonus_runs
ALTER COLUMN bonus_type SET NOT NULL;

ALTER TABLE public.bonus_runs
DROP CONSTRAINT IF EXISTS bonus_runs_bonus_type_check;

ALTER TABLE public.bonus_runs
ADD CONSTRAINT bonus_runs_bonus_type_check
CHECK (
  bonus_type IN (
    '13th Month',
    '14th Month',
    '15th Month'
  )
);

DROP INDEX IF EXISTS public.idx_bonus_runs_branch_month;

CREATE UNIQUE INDEX idx_bonus_runs_branch_month_type
ON public.bonus_runs (
  branch_id,
  bonus_month,
  bonus_type
);

COMMIT;