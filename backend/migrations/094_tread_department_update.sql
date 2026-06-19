BEGIN;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  'TREAD DEPARTMENT',
  m.module_name,
  a.action_name,
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('branch manager'),
    ('acting branch manager'),
    ('area manager'),
    ('acting area manager'),
    ('regional manager'),
    ('acting regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) r(role)
CROSS JOIN (
  VALUES
    ('department'),
    ('staff_information')
) m(module_name)
CROSS JOIN (
  VALUES
    ('view'),
    ('view_all')
) a(action_name)
ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'TREAD DEPARTMENT',
    'suspension_order',
    a.action_name,
    true,
    NOW(),
    NOW()
    FROM (
    VALUES
        ('branch manager'),
        ('acting branch manager'),
        ('area manager'),
        ('acting area manager'),
        ('regional manager'),
        ('acting regional manager'),
        ('assistant vice president'),
        ('vice president'),
        ('senior vice president')
    ) r(role)
    CROSS JOIN (
    VALUES
        ('view'),
        ('view_all')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();


BEGIN;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'ACCOUNTING DEPARTMENT',
    'other_receivable',
    a.action_name,
    true,
    NOW(),
    NOW()
    FROM (
    VALUES
        ('branch manager'),
        ('acting branch manager'),
        ('area manager'),
        ('acting area manager'),
        ('regional manager'),
        ('acting regional manager'),
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
        ('void'),
        ('delete'),
        ('bypass'),
        ('upload_final_file')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

    COMMIT;

COMMIT;