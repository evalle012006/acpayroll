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
USING (
    CASE
        WHEN branch_id IS NULL THEN NULL
        ELSE trim(branch_id::varchar)
    END
);


UPDATE public.users u
SET branch_id = b.code
FROM public.branches b
WHERE u.branch_id IS NOT NULL
  AND trim(u.branch_id) ~ '^[0-9]+$'
  AND b.id = trim(u.branch_id)::integer;


UPDATE public.users
SET branch_id = NULL
WHERE branch_id IS NOT NULL
  AND trim(branch_id) = '';


UPDATE public.users u
SET branch_id = NULL
WHERE u.branch_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.code = u.branch_id
  );


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