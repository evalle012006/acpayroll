BEGIN;

WITH target_roles AS (
    SELECT unnest(ARRAY[
        'branch manager',
        'area manager',
        'regional manager',
        'assistant vice president',
        'vice president',
        'senior vice president'
    ]) AS role
),
target_departments AS (
    SELECT unnest(ARRAY[
        'HR DEPARTMENT',
        'ACCOUNTING DEPARTMENT'
    ]) AS department
),
target_permissions AS (
    SELECT
        r.role,
        d.department
    FROM target_roles r
    CROSS JOIN target_departments d
)
INSERT INTO public.role_permissions (
    role,
    department,
    module_name,
    action_name,
    allowed,
    created_at,
    updated_at
)
SELECT
    t.role,
    t.department,
    'staff_report',
    'bypass',
    true,
    NOW(),
    NOW()
FROM target_permissions t
WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE LOWER(TRIM(rp.role)) = t.role
      AND UPPER(TRIM(rp.department)) = t.department
      AND rp.module_name = 'staff_report'
      AND rp.action_name = 'bypass'
);

UPDATE public.role_permissions
SET
    allowed = true,
    updated_at = NOW()
WHERE module_name = 'staff_report'
  AND action_name = 'bypass'
  AND UPPER(TRIM(department)) IN (
      'HR DEPARTMENT',
      'ACCOUNTING DEPARTMENT'
  )
  AND LOWER(TRIM(role)) IN (
      'branch manager',
      'area manager',
      'regional manager',
      'assistant vice president',
      'vice president',
      'senior vice president'
  );

    ALTER TABLE public.awol_reports
        ADD COLUMN IF NOT EXISTS answer_letter_path TEXT,
        ADD COLUMN IF NOT EXISTS answer_letter_name TEXT,
        ADD COLUMN IF NOT EXISTS answer_letter_mime TEXT,
        ADD COLUMN IF NOT EXISTS answer_letter_uploaded_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS answer_letter_uploaded_by INTEGER;

    INSERT INTO public.role_permissions
    (
        role,
        department,
        module_name,
        action_name,
        allowed
    )
    SELECT
        roles.role,
        departments.department,
        'resignation_request',
        'bypass',
        TRUE
    FROM (
        VALUES
            ('branch manager'),
            ('area manager'),
            ('regional manager'),
            ('assistant vice president'),
            ('vice president'),
            ('senior vice president')
    ) AS roles(role)
    CROSS JOIN (
        VALUES
            ('HR DEPARTMENT'),
            ('ACCOUNTING DEPARTMENT')
    ) AS departments(department)
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        WHERE LOWER(TRIM(rp.role)) = roles.role
        AND LOWER(TRIM(rp.department)) =
            LOWER(TRIM(departments.department))
        AND rp.module_name = 'resignation_request'
        AND rp.action_name = 'bypass'
    );

COMMIT;