BEGIN;

ALTER TABLE public.schedule_balance_snapshot_history
DROP COLUMN IF EXISTS reason;

ALTER TABLE public.board_resolution_requests
ADD COLUMN IF NOT EXISTS approved_by INTEGER,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

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
  role_name,
  'HR DEPARTMENT',
  'transfer_staff_order',
  'create',
  TRUE,
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
) AS roles(role_name)
ON CONFLICT (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

COMMIT;