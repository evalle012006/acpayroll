BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branches_code_key'
    ) THEN
        ALTER TABLE public.branches
        ADD CONSTRAINT branches_code_key UNIQUE (code);
    END IF;
END $$;

ALTER TABLE public.users
ALTER COLUMN branch_id TYPE integer
USING (
    CASE
        WHEN branch_id IS NULL THEN NULL
        WHEN trim(branch_id) ~ '^[0-9]+$' THEN trim(branch_id)::integer
        ELSE NULL
    END
);

COMMIT;