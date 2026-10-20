BEGIN;

WITH target_roles AS (
    SELECT DISTINCT
        role,
        department
    FROM public.role_permissions
    WHERE LOWER(TRIM(department)) IN (
        'hr department',
        'accounting department',
        'audit department'
    )
      AND module_name = 'staff_report'
),
required_actions AS (
    SELECT unnest(
        ARRAY[
            'view',
            'create',
            'approve',
            'bypass',
            'reject',
            'upload_approved'
        ]
    ) AS action_name
),
required_permissions AS (
    SELECT
        tr.role,
        tr.department,
        'staff_report' AS module_name,
        ra.action_name
    FROM target_roles tr
    CROSS JOIN required_actions ra
)

UPDATE public.role_permissions rp
SET allowed = TRUE
FROM required_permissions req
WHERE LOWER(TRIM(rp.role)) = LOWER(TRIM(req.role))
  AND LOWER(TRIM(rp.department)) = LOWER(TRIM(req.department))
  AND rp.module_name = req.module_name
  AND rp.action_name = req.action_name;

WITH target_roles AS (
    SELECT DISTINCT
        role,
        department
    FROM public.role_permissions
    WHERE LOWER(TRIM(department)) IN (
        'hr department',
        'accounting department',
        'audit department'
    )
      AND module_name = 'staff_report'
),
required_actions AS (
    SELECT unnest(
        ARRAY[
            'view',
            'create',
            'approve',
            'bypass',
            'reject',
            'upload_approved'
        ]
    ) AS action_name
)
INSERT INTO public.role_permissions (
    role,
    department,
    module_name,
    action_name,
    allowed
)
SELECT
    tr.role,
    tr.department,
    'staff_report',
    ra.action_name,
    TRUE
FROM target_roles tr
CROSS JOIN required_actions ra
WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE LOWER(TRIM(rp.role)) = LOWER(TRIM(tr.role))
      AND LOWER(TRIM(rp.department)) = LOWER(TRIM(tr.department))
      AND rp.module_name = 'staff_report'
      AND rp.action_name = ra.action_name
);

COMMIT;