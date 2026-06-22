BEGIN;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  'HR DEPARTMENT',
  'demotion',
  a.action_name,
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
) r(role)
CROSS JOIN (
  VALUES
  ('view'),
  ('view_all'),
  ('create'),
  ('edit'),
  ('approve'),
  ('reject'),
  ('delete'),
  ('upload_approved'),
  ('upload_final_file')
) a(action_name)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'HR DEPARTMENT',
    'sbf_order',
    a.action_name,
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
    ) r(role)
    CROSS JOIN (
    VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('approve'),
    ('reject'),
    ('delete')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'HR DEPARTMENT',
    'inactive_accounts',
    a.action_name,
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
    ) r(role)
    CROSS JOIN (
    VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('approve'),
    ('reject'),
    ('delete')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'HR DEPARTMENT',
    'staff_report',
    a.action_name,
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
    ) r(role)
    CROSS JOIN (
    VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('approve'),
    ('reject'),
    ('delete'),
    ('upload_approved'),
    ('upload_final_file')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

UPDATE loan_requests
    SET approval_stage = 'regional manager',
        regional_manager_status = 'Pending',
        assistant_vice_president_status = 'Pending',
        admin_status = 'Pending',
        status = 'Pending'
    WHERE id = 123;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  'HR DEPARTMENT',
  'suspension_order',
  a.action_name,
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
) r(role)
CROSS JOIN (
  VALUES
  ('view'),
  ('view_all'),
  ('create'),
  ('edit'),
  ('approve'),
  ('reject'),
  ('delete'),
  ('upload_approved')
) a(action_name)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

COMMIT;