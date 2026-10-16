BEGIN;

INSERT INTO public.role_permissions (
    department,
    role,
    module_name,
    action_name,
    allowed,
    created_at,
    updated_at
)
SELECT
    'ACCOUNTING DEPARTMENT',
    v.role,
    'staff_report',
    'delete',
    TRUE,
    NOW(),
    NOW()
FROM (
    VALUES
        ('area manager'),
        ('assistant vice president'),
        ('vice president'),
        ('senior vice president')
) AS v(role)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE LOWER(TRIM(rp.department)) = 'accounting department'
      AND LOWER(TRIM(rp.role)) = v.role
      AND LOWER(TRIM(rp.module_name)) = 'staff_report'
      AND LOWER(TRIM(rp.action_name)) = 'delete'
);

COMMIT;