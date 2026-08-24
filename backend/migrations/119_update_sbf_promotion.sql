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
SELECT
  r.role,
  'OPERATION DEPARTMENT',
  'sbf_order',
  'view',
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) AS r(role)
ON CONFLICT (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

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
  'vice president',
  'OPERATION DEPARTMENT',
  'sbf_order',
  'create',
  true,
  NOW(),
  NOW()
),
(
  'senior vice president',
  'OPERATION DEPARTMENT',
  'sbf_order',
  'create',
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

COMMIT;