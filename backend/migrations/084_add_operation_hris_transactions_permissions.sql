BEGIN;

DELETE FROM public.role_permissions
WHERE module_name = 'hris_transactions'
  AND action_name = 'view'
  AND department = 'OPERATION DEPARTMENT'
  AND role IN (
    'branch manager',
    'area manager',
    'regional manager',
    'assistant vice president',
    'vice president',
    'senior vice president'
  );

INSERT INTO public.role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('branch manager', 'OPERATION DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
('area manager', 'OPERATION DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
('regional manager', 'OPERATION DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
('assistant vice president', 'OPERATION DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
('vice president', 'OPERATION DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW()),
('senior vice president', 'OPERATION DEPARTMENT', 'hris_transactions', 'view', true, NOW(), NOW());

COMMIT;