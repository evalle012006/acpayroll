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
DROP CONSTRAINT IF EXISTS users_branch_id_fkey;

ALTER TABLE public.users
ALTER COLUMN branch_id TYPE varchar(50)
USING branch_id::varchar;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_branch_id_fkey'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_branch_id_fkey
        FOREIGN KEY (branch_id)
        REFERENCES public.branches(code)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;