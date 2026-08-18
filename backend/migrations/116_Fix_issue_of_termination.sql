BEGIN;

INSERT INTO public.role_permissions
(
    role,
    department,
    module_name,
    action_name,
    allowed,
    created_at,
    updated_at
)
VALUES

-- VP
(
    'vice president',
    'OPERATION DEPARTMENT',
    'termination_request',
    'view',
    true,
    NOW(),
    NOW()
),
(
    'vice president',
    'OPERATION DEPARTMENT',
    'termination_request',
    'create',
    true,
    NOW(),
    NOW()
),

-- SVP
(
    'senior vice president',
    'OPERATION DEPARTMENT',
    'termination_request',
    'view',
    true,
    NOW(),
    NOW()
),
(
    'senior vice president',
    'OPERATION DEPARTMENT',
    'termination_request',
    'create',
    true,
    NOW(),
    NOW()
)

ON CONFLICT
(
    role,
    COALESCE(department, ''),
    module_name,
    action_name
)
DO UPDATE SET
    allowed = true,
    updated_at = NOW();

COMMIT;