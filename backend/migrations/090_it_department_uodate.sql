BEGIN;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
        r.role,
        'IT DEPARTMENT',
        'staff_information',
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
    'IT DEPARTMENT',
    'deployment_order',
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
    'IT DEPARTMENT',
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
    'IT DEPARTMENT',
    'compensation_rates',
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
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
        r.role,
        'IT DEPARTMENT',
        'dashboard',
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
        ('view_all')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
        allowed = true,
        updated_at = NOW();
    
COMMIT;