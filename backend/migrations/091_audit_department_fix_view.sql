BEGIN;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  d.department,
  'hris_transactions',
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
CROSS JOIN (
  VALUES
    ('AUDIT DEPARTMENT'),
    ('IT DEPARTMENT'),
    ('HR DEPARTMENT'),
    ('ACCOUNTING DEPARTMENT'),
    ('TREAD DEPARTMENT'),
    ('OFFICE OF THE PRESIDENT'),
    ('PRODUCTION AND LOGISTIC DEPARTMENT')
) d(department)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

  COMMIT;