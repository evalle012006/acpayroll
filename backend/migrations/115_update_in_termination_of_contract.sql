BEGIN;

INSERT INTO role_permissions
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
(
  'branch manager',
  'OPERATION DEPARTMENT',
  'termination_request',
  'view',
  true,
  NOW(),
  NOW()
),
(
  'area manager',
  'OPERATION DEPARTMENT',
  'termination_request',
  'view',
  true,
  NOW(),
  NOW()
),
(
  'regional manager',
  'OPERATION DEPARTMENT',
  'termination_request',
  'view',
  true,
  NOW(),
  NOW()
),
(
  'assistant vice president',
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
  'view',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.user_department_scopes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  department TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_department_scopes
ON public.user_department_scopes (
  user_id,
  LOWER(TRIM(department))
);

-- Give every existing user their current department as their first scope.
INSERT INTO public.user_department_scopes (
  user_id,
  department,
  created_at,
  updated_at
)
SELECT
  id,
  department,
  NOW(),
  NOW()
FROM public.users
WHERE NULLIF(TRIM(COALESCE(department, '')), '') IS NOT NULL
ON CONFLICT DO NOTHING;

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
(
  'assistant vice president',
  'IT DEPARTMENT',
  'leave_request',
  'approve',
  true,
  NOW(),
  NOW()
)
ON CONFLICT
(role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET
  allowed=true,
  updated_at=NOW();

COMMIT;