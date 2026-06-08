BEGIN;

UPDATE public.role_permissions
SET allowed = true,
    updated_at = NOW()
WHERE role = 'branch manager'
  AND department = 'ACCOUNTING DEPARTMENT'
  AND module_name = 'loan_request'
  AND action_name IN (
    'view',
    'create',
    'approve',
    'reject',
    'upload_approved',
    'view_all'
  );

INSERT INTO public.role_permissions
(role, module_name, action_name, allowed, department, created_at, updated_at)
SELECT v.role, v.module_name, v.action_name, v.allowed, v.department, NOW(), NOW()
FROM (
  VALUES
  ('branch manager', 'loan_request', 'view', true, 'ACCOUNTING DEPARTMENT'),
  ('branch manager', 'loan_request', 'create', true, 'ACCOUNTING DEPARTMENT'),
  ('branch manager', 'loan_request', 'approve', true, 'ACCOUNTING DEPARTMENT'),
  ('branch manager', 'loan_request', 'reject', true, 'ACCOUNTING DEPARTMENT'),
  ('branch manager', 'loan_request', 'upload_approved', true, 'ACCOUNTING DEPARTMENT'),
  ('branch manager', 'loan_request', 'view_all', true, 'ACCOUNTING DEPARTMENT')
) AS v(role, module_name, action_name, allowed, department)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_permissions rp
  WHERE rp.role = v.role
    AND COALESCE(rp.department, '') = COALESCE(v.department, '')
    AND rp.module_name = v.module_name
    AND rp.action_name = v.action_name
);

COMMIT;