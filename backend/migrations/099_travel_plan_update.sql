BEGIN;

CREATE TABLE IF NOT EXISTS public.calendar_activities (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  days INTEGER,
  subject TEXT,
  venue TEXT,
  description TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO role_permissions
  (role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
  r.role,
  d.department,
  'resignation_request',
  a.action_name,
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) r(role)
CROSS JOIN (
  VALUES
    ('HR DEPARTMENT'),
    ('ACCOUNTING DEPARTMENT')
) d(department)
CROSS JOIN (
  VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('approve'),
    ('reject'),
    ('delete'),
    ('upload'),
    ('revoke')
) a(action_name)
ON CONFLICT (role, COALESCE(department, ''), module_name, action_name)
DO UPDATE SET
  allowed = true,
  updated_at = NOW();

  ALTER TABLE public.travel_plans
    ADD COLUMN IF NOT EXISTS employee_name TEXT;

    ALTER TABLE public.travel_plans
    ADD COLUMN IF NOT EXISTS position TEXT;

COMMIT;