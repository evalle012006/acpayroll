BEGIN;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS finding_type TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS finding_photo_url TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS passbook_reconciliation TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS past_due_delinquent_report TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS group_collection_record TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS other_findings TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_coh TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_cashbook_vs_voucher TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_bms TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_other_findings TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_photo_url TEXT;

-- =====================================================
-- OFFICE OF THE PRESIDENT - TRAVEL PLAN / CALENDAR
-- =====================================================
-- Add permissions for every role that currently exists
-- under Office of the President.
-- =====================================================

INSERT INTO public.role_permissions
(
  role,
  department,
  module_name,
  action_name,
  allowed,
  created_at,
  updated_at
)
SELECT
  source.role,
  source.department,
  'travel_plan',
  action.action_name,
  TRUE,
  NOW(),
  NOW()
FROM
(
  SELECT DISTINCT
    LOWER(TRIM(u.role)) AS role,
    UPPER(TRIM(u.department)) AS department
  FROM public.users u
  WHERE LOWER(TRIM(COALESCE(u.department, ''))) IN
  (
    'office of the president',
    'office of the president department'
  )
    AND NULLIF(TRIM(COALESCE(u.role, '')), '') IS NOT NULL
) source
CROSS JOIN
(
  VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit')
) AS action(action_name)
WHERE NOT EXISTS
(
  SELECT 1
  FROM public.role_permissions rp
  WHERE LOWER(TRIM(COALESCE(rp.role, ''))) =
        LOWER(TRIM(source.role))

    AND LOWER(TRIM(COALESCE(rp.department, ''))) =
        LOWER(TRIM(source.department))

    AND LOWER(TRIM(COALESCE(rp.module_name, ''))) =
        'travel_plan'

    AND LOWER(TRIM(COALESCE(rp.action_name, ''))) =
        LOWER(TRIM(action.action_name))
);

-- Ensure existing records are enabled.
UPDATE public.role_permissions rp
SET
  allowed = TRUE,
  updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(rp.department, ''))) IN
(
  'office of the president',
  'office of the president department'
)
AND LOWER(TRIM(COALESCE(rp.module_name, ''))) =
    'travel_plan'
AND LOWER(TRIM(COALESCE(rp.action_name, ''))) IN
(
  'view',
  'view_all',
  'create',
  'edit'
);

COMMIT;