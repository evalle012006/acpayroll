BEGIN;

ALTER TABLE public.suspension_orders
ADD COLUMN IF NOT EXISTS division VARCHAR(255);

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('area manager', 'TREAD DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),

    ('area manager', 'IT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES

    -- IT DEPARTMENT
    ('area manager', 'IT DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),

    -- TREAD DEPARTMENT
    ('area manager', 'TREAD DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'schedule_balance', 'view', true, NOW(), NOW())

    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES

    ('area manager', 'IT DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),

    ('area manager', 'TREAD DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'payslip', 'view', true, NOW(), NOW())

    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES

    ('area manager', 'IT DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'department', 'view', true, NOW(), NOW()),

    ('area manager', 'IT DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),

    ('area manager', 'IT DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),

    ('area manager', 'TREAD DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'department', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'department', 'view', true, NOW(), NOW()),

    ('area manager', 'TREAD DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'system_update', 'view', true, NOW(), NOW()),

    ('area manager', 'TREAD DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW())

    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES

    ('area manager', 'IT DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('regional manager', 'IT DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'IT DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('vice president', 'IT DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('senior vice president', 'IT DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),

    ('area manager', 'TREAD DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('regional manager', 'TREAD DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'TREAD DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('vice president', 'TREAD DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
    ('senior vice president', 'TREAD DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW())

    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('area manager', 'IT DEPARTMENT', 'comp_rate', 'view', true, NOW(), NOW()),
    ('area manager', 'IT DEPARTMENT', 'comp_rate', 'view_all', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('area manager', 'TREAD DEPARTMENT', 'comp_rate', 'view', true, NOW(), NOW()),
    ('area manager', 'TREAD DEPARTMENT', 'comp_rate', 'view_all', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW();

COMMIT;