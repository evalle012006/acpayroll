BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_unique_role_dept_module_action
ON public.role_permissions (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
);

COMMIT;