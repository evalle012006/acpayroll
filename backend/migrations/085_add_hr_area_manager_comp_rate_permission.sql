BEGIN;

INSERT INTO public.role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
(
  'area manager',
  'HR DEPARTMENT',
  'comp_rate',
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
  allowed = EXCLUDED.allowed,
  updated_at = NOW();

  INSERT INTO public.role_permissions
  (role, department, module_name, action_name, allowed, created_at, updated_at)
  VALUES
  ('area manager', 'HR DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
  ('area manager', 'HR DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
  ('area manager', 'HR DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
  ('area manager', 'HR DEPARTMENT', 'exit_staff_order', 'view', true, NOW(), NOW()),
  ('area manager', 'HR DEPARTMENT', 'report', 'view', true, NOW(), NOW()),
  ('area manager', 'HR DEPARTMENT', 'system_update', 'view', true, NOW(), NOW())
  ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
  DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

    INSERT INTO public.role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('branch manager', 'HR DEPARTMENT', 'staff', 'view', true, NOW(), NOW()),
    ('branch manager', 'HR DEPARTMENT', 'staff', 'view_all', true, NOW(), NOW()),
    ('branch manager', 'HR DEPARTMENT', 'staff', 'edit', true, NOW(), NOW()),

    ('area manager', 'HR DEPARTMENT', 'staff', 'view', true, NOW(), NOW()),
    ('area manager', 'HR DEPARTMENT', 'staff', 'view_all', true, NOW(), NOW()),
    ('area manager', 'HR DEPARTMENT', 'staff', 'edit', true, NOW(), NOW()),

    ('regional manager', 'HR DEPARTMENT', 'staff', 'view', true, NOW(), NOW()),
    ('regional manager', 'HR DEPARTMENT', 'staff', 'view_all', true, NOW(), NOW()),
    ('regional manager', 'HR DEPARTMENT', 'staff', 'edit', true, NOW(), NOW()),

    ('assistant vice president', 'HR DEPARTMENT', 'staff', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'HR DEPARTMENT', 'staff', 'view_all', true, NOW(), NOW()),
    ('assistant vice president', 'HR DEPARTMENT', 'staff', 'edit', true, NOW(), NOW()),

    ('vice president', 'HR DEPARTMENT', 'staff', 'view', true, NOW(), NOW()),
    ('vice president', 'HR DEPARTMENT', 'staff', 'view_all', true, NOW(), NOW()),
    ('vice president', 'HR DEPARTMENT', 'staff', 'edit', true, NOW(), NOW()),

    ('senior vice president', 'HR DEPARTMENT', 'staff', 'view', true, NOW(), NOW()),
    ('senior vice president', 'HR DEPARTMENT', 'staff', 'view_all', true, NOW(), NOW()),
    ('senior vice president', 'HR DEPARTMENT', 'staff', 'edit', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
      allowed = EXCLUDED.allowed,
      updated_at = NOW();

    ALTER TABLE loan_requests
    ALTER COLUMN approval_stage TYPE VARCHAR(100);

    ALTER TABLE loan_requests
    ALTER COLUMN status TYPE VARCHAR(100);

    ALTER TABLE loan_requests
    ALTER COLUMN applicant_role TYPE VARCHAR(100);

  COMMIT;