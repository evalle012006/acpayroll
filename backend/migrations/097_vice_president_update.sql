BEGIN;

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('vice president', 'OPERATION DEPARTMENT', 'other_receivable', 'view', true, NOW(), NOW()),
    ('vice president', 'OPERATION DEPARTMENT', 'other_receivable', 'view_all', true, NOW(), NOW()),
    ('vice president', 'OPERATION DEPARTMENT', 'other_receivable', 'create', true, NOW(), NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = EXCLUDED.allowed,
    updated_at = NOW();

INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('vice president','OPERATION DEPARTMENT','staff_accounts_payable','view',true,NOW(),NOW()),
    ('vice president','OPERATION DEPARTMENT','staff_accounts_payable','view_all',true,NOW(),NOW()),
    ('vice president','OPERATION DEPARTMENT','staff_accounts_payable','create',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = TRUE,
    updated_at = NOW();


INSERT INTO role_permissions
    (role, department, module_name, action_name, allowed, created_at, updated_at)
    VALUES
    ('vice president','OPERATION DEPARTMENT','sbf_order','view',true,NOW(),NOW()),
    ('vice president','OPERATION DEPARTMENT','sbf_order','view_all',true,NOW(),NOW()),
    ('vice president','OPERATION DEPARTMENT','sbf_order','create',true,NOW(),NOW()),
    ('vice president','OPERATION DEPARTMENT','sbf_order','approve',true,NOW(),NOW()),
    ('vice president','OPERATION DEPARTMENT','sbf_order','reject',true,NOW(),NOW())
    ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
    DO UPDATE SET
    allowed = TRUE,
    updated_at = NOW();

COMMIT;