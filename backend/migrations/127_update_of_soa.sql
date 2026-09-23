BEGIN;

INSERT INTO role_permissions (
    role,
    department,
    module_name,
    action_name,
    allowed,
    created_at,
    updated_at
)
SELECT
    'branch manager',
    'OPERATION DEPARTMENT',
    'statement_of_account',
    'edit',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions
    WHERE LOWER(TRIM(role)) = 'branch manager'
      AND UPPER(TRIM(department)) = 'OPERATION DEPARTMENT'
      AND module_name = 'statement_of_account'
      AND action_name = 'edit'
);

COMMIT;