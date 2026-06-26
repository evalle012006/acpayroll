BEGIN;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  'admin',
  '',
  'travel_plan',
  a.action_name,
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('view'),
    ('create'),
    ('edit'),
    ('approve'),
    ('reject'),
    ('delete')
) a(action_name)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET allowed = true, updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  'TREAD DEPARTMENT',
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
) r(role)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET allowed = true, updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  'OPERATION DEPARTMENT',
  'travel_plan',
  'view',
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) r(role)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET allowed = true, updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  'ACCOUNTING DEPARTMENT',
  'consolidation',
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
    ('create'),
    ('edit'),
    ('delete')
) a(action_name)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET allowed = true, updated_at = NOW();

COMMIT;