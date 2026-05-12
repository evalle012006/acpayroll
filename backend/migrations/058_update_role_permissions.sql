BEGIN;

ALTER TABLE public.role_permissions
ADD COLUMN IF NOT EXISTS department VARCHAR(150);

ALTER TABLE public.role_permissions
DROP CONSTRAINT IF EXISTS role_permissions_role_module_name_action_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_unique_role_dept_module_action
ON public.role_permissions (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
);

COMMIT;