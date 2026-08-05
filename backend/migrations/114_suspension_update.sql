BEGIN;

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
  role_data.role,
  'AUDIT DEPARTMENT',
  'staff_report',
  action_data.action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president'),
    ('president')
) AS role_data(role)
CROSS JOIN (
  VALUES
    ('view'),
    ('create'),
    ('approve'),
    ('reject'),
    ('upload_approved')
) AS action_data(action_name)
ON CONFLICT (
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

-- =====================================================
-- AUDIT DEPARTMENT: ANY MANAGER ROLE, FULL ACCESS
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
  roles.role,
  'AUDIT DEPARTMENT',
  'suspension_order',
  actions.action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president'),
    ('president')
) AS roles(role)
CROSS JOIN (
  VALUES
    ('view'),
    ('create'),
    ('edit'),
    ('delete'),
    ('approve'),
    ('reject'),
    ('upload_approved')
) AS actions(action_name)
ON CONFLICT
(
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();


-- =====================================================
-- OPERATION VP: FULL ACCESS
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
  'vice president',
  'OPERATION DEPARTMENT',
  'suspension_order',
  actions.action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('view'),
    ('create'),
    ('edit'),
    ('delete'),
    ('approve'),
    ('reject'),
    ('upload_approved')
) AS actions(action_name)
ON CONFLICT
(
  role,
  COALESCE(department, ''),
  module_name,
  action_name
)
DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.user_impersonation_logs (
  id BIGSERIAL PRIMARY KEY,

  actor_user_id BIGINT NOT NULL,
  actor_username TEXT NOT NULL,

  target_user_id BIGINT NOT NULL,
  target_username TEXT NOT NULL,

  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,

  ip_address TEXT,
  user_agent TEXT,

  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active', 'Ended', 'Expired'))
);

CREATE INDEX IF NOT EXISTS
  idx_user_impersonation_logs_actor
ON public.user_impersonation_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS
  idx_user_impersonation_logs_target
ON public.user_impersonation_logs (target_user_id);

CREATE INDEX IF NOT EXISTS
  idx_user_impersonation_logs_started
ON public.user_impersonation_logs (started_at DESC);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_lor TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_los TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_ldf TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS review_dcs TEXT;

COMMIT;