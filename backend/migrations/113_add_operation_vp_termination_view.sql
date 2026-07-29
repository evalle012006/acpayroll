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
(
  'vice president',
  'OPERATION DEPARTMENT',
  'termination_request',
  'view',
  TRUE,
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
  allowed = TRUE,
  updated_at = NOW();

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
    'vice president',
    'OPERATION DEPARTMENT',
    'termination_request',
    'view',
    true,
    NOW(),
    NOW()
)
ON CONFLICT
(
    role,
    COALESCE(department,''),
    module_name,
    action_name
)
DO UPDATE
SET
    allowed = true,
    updated_at = NOW();

COMMIT;