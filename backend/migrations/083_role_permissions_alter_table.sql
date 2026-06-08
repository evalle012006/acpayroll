BEGIN;

INSERT INTO role_permissions
(role, module_name, action_name, allowed, department, created_at, updated_at)
VALUES
('branch manager', 'comp_rate', 'view', true, 'ACCOUNTING DEPARTMENT', NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('branch manager', 'ACCOUNTING DEPARTMENT', 'dashboard', 'view', true, NOW(), NOW()),
('branch manager', 'ACCOUNTING DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
('branch manager', 'ACCOUNTING DEPARTMENT', 'payslip', 'view', true, NOW(), NOW()),
('branch manager', 'ACCOUNTING DEPARTMENT', 'system_update', 'view', true, NOW(), NOW())
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = EXCLUDED.allowed,
  updated_at = NOW();

UPDATE role_permissions
SET
  allowed = true,
  updated_at = NOW()
WHERE role = 'branch manager'
  AND department = 'ACCOUNTING DEPARTMENT'
  AND module_name = 'comp_rate'
  AND action_name = 'view';

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('branch manager', 'ACCOUNTING DEPARTMENT', 'staff_balance', 'view', true, NOW(), NOW()),
('branch manager', 'ACCOUNTING DEPARTMENT', 'staff_loan_opening_balance', 'view', true, NOW(), NOW()),
('branch manager', 'ACCOUNTING DEPARTMENT', 'suspension_order', 'view', true, NOW(), NOW())
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = EXCLUDED.allowed,
  updated_at = NOW();

  INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('branch manager', 'ACCOUNTING DEPARTMENT', 'staff', 'edit', true, NOW(), NOW())
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

COMMIT;