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

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('assistant vice president', 'AUDIT DEPARTMENT', 'leave_request', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'promotion_order', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'transfer_staff_order', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'demotion_order', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'suspension_order', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'exit_staff_order', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'resignation_request', 'view', true, NOW(), NOW()),
    ('assistant vice president', 'AUDIT DEPARTMENT', 'staff_report', 'view', true, NOW(), NOW());

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('assistant vice president', 'AUDIT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  'president',
  'OFFICE OF THE PRESIDENT',
  module_name,
  'view',
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('dashboard'),
    ('department'),
    ('staff'),
    ('schedule_balance'),
    ('staff_loan_opening_balance'),
    ('hris_transactions'),
    ('loan_request'),
    ('cbu_withdrawal'),
    ('reimbursement_request'),
    ('branch'),
    ('payslip'),
    ('exit_staff_order'),
    ('system_update'),
    ('users'),
    ('permissions')
) AS m(module_name)
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE
SET allowed = true,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('branch manager', 'AUDIT DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('branch manager', 'AUDIT DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE
    SET allowed = true,
        updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('president','OFFICE OF THE PRESIDENT','report','view',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
    DO UPDATE SET allowed = true, updated_at = NOW();

COMMIT;