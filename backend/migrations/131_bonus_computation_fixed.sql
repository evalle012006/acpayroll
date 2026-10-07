BEGIN;

-- =========================================================
-- BONUS RUN TYPE
-- =========================================================

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

-- =========================================================
-- BONUS RUN UNIQUE INDEX
-- =========================================================

DROP INDEX IF EXISTS public.idx_bonus_runs_branch_month;

CREATE UNIQUE INDEX IF NOT EXISTS
idx_bonus_runs_branch_month_type
ON public.bonus_runs (
    branch_id,
    bonus_month,
    bonus_type
);

COMMIT;