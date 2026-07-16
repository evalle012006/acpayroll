BEGIN;

ALTER TABLE public.demotion_orders
ADD COLUMN IF NOT EXISTS voided_by INTEGER,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS void_reason TEXT;

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
  roles.role_name,
  roles.department_name,
  'demotion_order',
  actions.action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('admin', ''),
    ('branch manager', 'HR DEPARTMENT'),
    ('area manager', 'HR DEPARTMENT'),
    ('regional manager', 'HR DEPARTMENT'),
    ('assistant vice president', 'HR DEPARTMENT'),
    ('vice president', 'HR DEPARTMENT'),
    ('senior vice president', 'HR DEPARTMENT'),

    ('branch manager', 'IT DEPARTMENT'),
    ('area manager', 'IT DEPARTMENT'),
    ('regional manager', 'IT DEPARTMENT'),
    ('assistant vice president', 'IT DEPARTMENT'),
    ('vice president', 'IT DEPARTMENT'),
    ('senior vice president', 'IT DEPARTMENT'),

    ('branch manager', 'ACCOUNTING DEPARTMENT'),
    ('area manager', 'ACCOUNTING DEPARTMENT'),
    ('regional manager', 'ACCOUNTING DEPARTMENT'),
    ('assistant vice president', 'ACCOUNTING DEPARTMENT'),
    ('vice president', 'ACCOUNTING DEPARTMENT'),
    ('senior vice president', 'ACCOUNTING DEPARTMENT')
) roles(role_name, department_name)
CROSS JOIN (
  VALUES
    ('void'),
    ('delete')
) actions(action_name)
ON CONFLICT (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

COMMIT;