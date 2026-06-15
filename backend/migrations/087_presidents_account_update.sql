BEGIN;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('president', 'OFFICE OF THE PRESIDENT', 'leave_request', 'view', true, NOW(), NOW()),
('president', 'OFFICE OF THE PRESIDENT', 'staff_balance', 'view', true, NOW(), NOW())
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = EXCLUDED.allowed,
  updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT r.role, 'OFFICE OF THE PRESIDENT', 'staff_report', a.action_name, true, NOW(), NOW()
FROM (
  VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president'),
    ('president')
) AS r(role)
CROSS JOIN (
  VALUES ('view'), ('create')
) AS a(action_name)
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('president', 'OFFICE OF THE PRESIDENT', 'cbu_withdrawal', 'create', true, NOW(), NOW()),
('president', 'OFFICE OF THE PRESIDENT', 'cbu_withdrawal', 'view', true, NOW(), NOW()),
('president', 'OFFICE OF THE PRESIDENT', 'demotion_order', 'create', true, NOW(), NOW())
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT r.role, 'OFFICE OF THE PRESIDENT', 'suspension_order', a.action_name, true, NOW(), NOW()
FROM (
  VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president'),
    ('president')
) AS r(role)
CROSS JOIN (
  VALUES ('view'), ('create')
) AS a(action_name)
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

COMMIT;