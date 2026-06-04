BEGIN;

CREATE TABLE IF NOT EXISTS public.backup_staff_accounts_payable_before_or_transfer AS
SELECT *
FROM public.staff_accounts_payable;

INSERT INTO public.other_receivables (
  employee_id,
  employee_no,
  employee_name,
  branch,
  area,
  region,
  division,
  department,
  description,
  amount,
  release_date,
  attachment_path,
  attachment_name,
  attachment_mime,
  status,
  created_by,
  created_at,
  approved_by,
  approved_at,
  rejected_by,
  rejected_at,
  rejection_reason,
  updated_at
)
SELECT
  sap.employee_id,
  sap.employee_no,
  sap.staff_name,
  sap.branch,
  sap.area,
  sap.region,
  sap.division,
  sap.department,
  sap.description,
  sap.amount,
  COALESCE(sap.release_date, sap.approved_at::date, sap.created_at::date),
  sap.attachment_path,
  sap.attachment_name,
  sap.attachment_mime,
  sap.status,
  sap.created_by,
  sap.created_at,
  sap.approved_by,
  sap.approved_at,
  sap.rejected_by,
  sap.rejected_at,
  sap.rejection_reason,
  NOW()
FROM public.staff_accounts_payable sap
WHERE LOWER(COALESCE(sap.status, '')) = 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM public.other_receivables ore
    WHERE ore.employee_no = sap.employee_no
      AND COALESCE(ore.description, '') = COALESCE(sap.description, '')
      AND COALESCE(ore.amount, 0) = COALESCE(sap.amount, 0)
  );

UPDATE public.staff_accounts_payable
SET
  status = 'Void',
  rejected_at = NOW(),
  rejection_reason = 'Transferred to Other Receivable',
  updated_at = NOW()
WHERE LOWER(COALESCE(status, '')) = 'approved';

UPDATE public.staff_balances
SET
  staff_accounts_payable = 0,
  other_receivable = 0,
  updated_at = NOW();

UPDATE public.staff_balances sb
SET
  other_receivable = COALESCE(x.total_other_receivable, 0),
  staff_accounts_payable = 0,
  updated_at = NOW()
FROM (
  SELECT
    employee_no,
    SUM(COALESCE(amount, 0)) AS total_other_receivable
  FROM public.other_receivables
  WHERE LOWER(COALESCE(status, '')) = 'approved'
  GROUP BY employee_no
) x
WHERE sb.employee_no = x.employee_no;

COMMIT;