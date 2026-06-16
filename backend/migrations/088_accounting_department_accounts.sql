BEGIN;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
        r.role,'ACCOUNTING DEPARTMENT', m.module_name,'view', true, NOW(), NOW()
        
        FROM (
            VALUES
                ('area manager'),
                ('regional manager'),
                ('assistant vice president'),
                ('vice president'),
                ('senior vice president')
        ) AS r(role)
        CROSS JOIN (
            VALUES
                ('dashboard'),
                ('hris_transactions'),
                ('payslip'),
                ('system_update')
        ) AS m(module_name)
        ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
        DO UPDATE
        SET allowed = true,
            updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'OPERATION DEPARTMENT',
    'dashboard',
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
    ) AS r(role)
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    (
    'vice president',
    'OPERATION DEPARTMENT',
    'payslip',
    'view',
    true,
    NOW(),
    NOW()
    )
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','OPERATION DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','department','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','exit_staff_order','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','system_update','view',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','OPERATION DEPARTMENT','staff_balance','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','staff_balance','view_all',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','OPERATION DEPARTMENT','regularization_order','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','regularization_order','view_all',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
        'senior vice president',
        'OPERATION DEPARTMENT',
        m.module_name,
        a.action_name,
        true,
        NOW(),
        NOW()
    FROM (
        VALUES
        ('report'),
        ('board_resolution'),
        ('other_receivable'),
        ('staff_accounts_payable'),
        ('sbf_order'),
        ('statement_of_account'),
        ('suspension_order'),
        ('deployment_order'),
        ('promotion_order')
    ) AS m(module_name)
    CROSS JOIN (
        VALUES
        ('view'),
        ('view_all'),
        ('create')
    ) AS a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','OPERATION DEPARTMENT','staff_report','view',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','staff_report','view_all',true,NOW(),NOW()),
    ('senior vice president','OPERATION DEPARTMENT','staff_report','create',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','ACCOUNTING DEPARTMENT','staff_balance','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','staff_balance','view_all',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','ACCOUNTING DEPARTMENT','department','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','exit_staff_order','view',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','ACCOUNTING DEPARTMENT','regularization_order','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','regularization_order','create',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','regularization_order','approve',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','regularization_order','reject',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','regularization_order','view_all',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','ACCOUNTING DEPARTMENT','consolidation','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','consolidation','create',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','consolidation','edit',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','consolidation','delete',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','ACCOUNTING DEPARTMENT','area_configuration','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','area_configuration','create',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','area_configuration','edit',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','area_configuration','delete',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('senior vice president','ACCOUNTING DEPARTMENT','promotion_order','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','promotion_order','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','deployment_order','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','deployment_order','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','suspension_order','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','suspension_order','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','statement_of_account','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','statement_of_account','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','sbf_order','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','sbf_order','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','other_receivable','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','other_receivable','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','board_resolution','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','board_resolution','create',true,NOW(),NOW()),

    ('senior vice president','ACCOUNTING DEPARTMENT','staff_report','view',true,NOW(),NOW()),
    ('senior vice president','ACCOUNTING DEPARTMENT','staff_report','create',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES

    -- BRANCH MANAGER
    ('branch manager','AUDIT DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('branch manager','AUDIT DEPARTMENT','branch_payroll','view',true,NOW(),NOW()),
    ('branch manager','AUDIT DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('branch manager','AUDIT DEPARTMENT','system_update','view',true,NOW(),NOW()),

    -- AREA MANAGER
    ('area manager','AUDIT DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','department','view',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','department','view_all',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','branch_payroll','view',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','report','view',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','report','view_all',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','exit_staff_order','view',true,NOW(),NOW()),
    ('area manager','AUDIT DEPARTMENT','system_update','view',true,NOW(),NOW()),

    -- REGIONAL MANAGER
    ('regional manager','AUDIT DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','department','view',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','department','view_all',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','branch_payroll','view',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','report','view',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','report','view_all',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','exit_staff_order','view',true,NOW(),NOW()),
    ('regional manager','AUDIT DEPARTMENT','system_update','view',true,NOW(),NOW()),

    -- ASSISTANT VICE PRESIDENT
    ('assistant vice president','AUDIT DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','department','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','department','view_all',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','branch_payroll','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','report','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','report','view_all',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','exit_staff_order','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','system_update','view',true,NOW(),NOW()),

    -- VICE PRESIDENT
    ('vice president','AUDIT DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','department','view',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','department','view_all',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','branch_payroll','view',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','report','view',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','report','view_all',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','exit_staff_order','view',true,NOW(),NOW()),
    ('vice president','AUDIT DEPARTMENT','system_update','view',true,NOW(),NOW()),

    -- SENIOR VICE PRESIDENT
    ('senior vice president','AUDIT DEPARTMENT','dashboard','view',true,NOW(),NOW()),
    ('senior vice president','AUDIT DEPARTMENT','branch_payroll','view',true,NOW(),NOW()),
    ('senior vice president','AUDIT DEPARTMENT','payslip','view',true,NOW(),NOW()),
    ('senior vice president','AUDIT DEPARTMENT','exit_staff_order','view',true,NOW(),NOW()),
    ('senior vice president','AUDIT DEPARTMENT','system_update','view',true,NOW(),NOW())

    ON CONFLICT DO NOTHING;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'AUDIT DEPARTMENT',
    'regularization_order',
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
    VALUES
    ('assistant vice president','AUDIT DEPARTMENT','other_receivable','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','other_receivable','view_all',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','staff_accounts_payable','view',true,NOW(),NOW()),
    ('assistant vice president','AUDIT DEPARTMENT','staff_accounts_payable','view_all',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'AUDIT DEPARTMENT',
    m.module_name,
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
    ('other_receivable'),
    ('staff_accounts_payable')
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
    'ACCOUNTING DEPARTMENT',
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
    ('edit')
    ) a(action_name)
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    SELECT
    r.role,
    'ACCOUNTING DEPARTMENT',
    'staff',
    'upload_approved',
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
    'AUDIT DEPARTMENT',
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
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

COMMIT;