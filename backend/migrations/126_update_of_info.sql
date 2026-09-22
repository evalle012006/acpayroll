BEGIN;

INSERT INTO role_permissions
    (role, module_name, action_name, allowed, created_at, updated_at, department)
SELECT
    'assistant vice president',
    'sbf_order',
    'create',
    true,
    NOW(),
    NOW(),
    'TREAD DEPARTMENT'
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions
    WHERE LOWER(TRIM(role)) = 'assistant vice president'
      AND LOWER(TRIM(department)) = 'tread department'
      AND LOWER(TRIM(module_name)) = 'sbf_order'
      AND LOWER(TRIM(action_name)) = 'create'
);

COMMIT;