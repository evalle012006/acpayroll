BEGIN;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'OFFICE OF THE PRESIDENT',
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
        ('dashboard'),
        ('department')
    ) m(module_name)
    CROSS JOIN (
    VALUES
        ('view'),
        ('view_all'),
        ('create'),
        ('edit'),
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
        'OFFICE OF THE PRESIDENT',
        'department',
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
        'OFFICE OF THE PRESIDENT',
        'staff_information',
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

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'HR DEPARTMENT',
    'branch',
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



COMMIT;