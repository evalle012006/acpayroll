BEGIN;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'IT DEPARTMENT',
    'staff',
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
        ('edit'),
        ('create'),
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

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'IT DEPARTMENT',
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
        ('delete'),
        ('bypass'),
        ('void'),
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
    'IT DEPARTMENT',
    'board_resolution',
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
    'system_update',
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

COMMIT;