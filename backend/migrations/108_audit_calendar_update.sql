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
  role_name,
  'AUDIT DEPARTMENT',
  'travel_plan',
  action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('area manager'),
    ('acting area manager'),
    ('regional manager'),
    ('acting regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) AS roles(role_name)
CROSS JOIN (
  VALUES
    ('view'),
    ('create'),
    ('edit')
) AS actions(action_name)
ON CONFLICT
(
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = TRUE,
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
  'branch manager',
  'AUDIT DEPARTMENT',
  'travel_plan',
  'view',
  true,
  NOW(),
  NOW()
),
(
  'branch manager',
  'AUDIT DEPARTMENT',
  'travel_plan',
  'create',
  true,
  NOW(),
  NOW()
),
(
  'branch manager',
  'AUDIT DEPARTMENT',
  'travel_plan',
  'edit',
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
  allowed = EXCLUDED.allowed,
  updated_at = NOW();

COMMIT;