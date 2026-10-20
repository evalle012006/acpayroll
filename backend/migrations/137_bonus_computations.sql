BEGIN;

ALTER TABLE public.bonus_computations
    ADD COLUMN IF NOT EXISTS is_manual_override
    BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.bonus_computations
    SET is_manual_override = TRUE
    WHERE computation_year = 2026
    AND is_manual_override = FALSE;

ALTER TABLE public.bonus_computations
    ADD COLUMN IF NOT EXISTS manual_base_month_13 NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS manual_base_month_14 NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS manual_base_month_15 NUMERIC(15,2);

UPDATE public.bonus_computations
    SET
        manual_base_month_13 = month_13,
        manual_base_month_14 = month_14,
        manual_base_month_15 = month_15
    WHERE is_manual_override = TRUE
    AND manual_base_month_13 IS NULL
    AND manual_base_month_14 IS NULL
    AND manual_base_month_15 IS NULL;

    SELECT
        computation_year,
        COUNT(*) AS total_manual_records,
        COUNT(*) FILTER (
            WHERE manual_base_month_13 IS NOT NULL
            AND manual_base_month_14 IS NOT NULL
            AND manual_base_month_15 IS NOT NULL
        ) AS records_with_baseline
    FROM public.bonus_computations
    WHERE is_manual_override = TRUE
    GROUP BY computation_year;

CREATE TABLE IF NOT EXISTS public.bonus_computations_backup_20261020
    AS
    SELECT *
    FROM public.bonus_computations;

COMMIT;