BEGIN;

ALTER TABLE public.loan_requests
ADD COLUMN IF NOT EXISTS approved_term INTEGER;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('area manager', 'OPERATION DEPARTMENT', 'board_resolution', 'view', true, NOW(), NOW()),
    ('area manager', 'OPERATION DEPARTMENT', 'board_resolution', 'view_all', true, NOW(), NOW()),
    ('area manager', 'OPERATION DEPARTMENT', 'board_resolution', 'create', true, NOW(), NOW()),
    ('area manager', 'OPERATION DEPARTMENT', 'board_resolution', 'edit', true, NOW(), NOW()),
    ('area manager', 'OPERATION DEPARTMENT', 'board_resolution', 'approve', true, NOW(), NOW()),
    ('area manager', 'OPERATION DEPARTMENT', 'board_resolution', 'reject', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

COMMIT;