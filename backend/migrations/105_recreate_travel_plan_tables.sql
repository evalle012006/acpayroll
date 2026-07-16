BEGIN;

-- =====================================================
-- DELETE OLD TRAVEL PLAN TABLES
-- =====================================================

DROP TABLE IF EXISTS public.travel_plan_photos CASCADE;
DROP TABLE IF EXISTS public.travel_plan_notes CASCADE;
DROP TABLE IF EXISTS public.travel_plans CASCADE;
DROP TABLE IF EXISTS public.calendar_activities CASCADE;

-- =====================================================
-- DELETE OLD TRAVEL PLAN PERMISSIONS
-- =====================================================

DELETE FROM public.role_permissions
WHERE LOWER(TRIM(COALESCE(module_name, ''))) = 'travel_plan';

-- =====================================================
-- RECREATE TRAVEL PLANS
-- =====================================================

CREATE TABLE public.travel_plans (
  id SERIAL PRIMARY KEY,

  title TEXT NOT NULL,
  plan_date DATE NOT NULL,

  employee_name TEXT,
  position TEXT,

  branch_name TEXT,
  description TEXT,

  review TEXT,
  findings TEXT,

  photo_url TEXT,
  photo_uploaded_at TIMESTAMP,
  photo_latitude NUMERIC,
  photo_longitude NUMERIC,

  check_in_photo_url TEXT,
  check_in_at TIMESTAMP,
  check_in_latitude NUMERIC,
  check_in_longitude NUMERIC,

  check_out_photo_url TEXT,
  check_out_at TIMESTAMP,
  check_out_latitude NUMERIC,
  check_out_longitude NUMERIC,

  created_by INTEGER,

  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  submitted_at TIMESTAMP,
  submitted_by INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- RECREATE TRAVEL PLAN PHOTOS
-- =====================================================

CREATE TABLE public.travel_plan_photos (
  id SERIAL PRIMARY KEY,

  travel_plan_id INTEGER NOT NULL
    REFERENCES public.travel_plans(id)
    ON DELETE CASCADE,

  photo_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  photo_url TEXT NOT NULL,

  latitude NUMERIC,
  longitude NUMERIC,

  captured_at TIMESTAMP,
  uploaded_by INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- RECREATE TRAVEL PLAN NOTES
-- =====================================================

CREATE TABLE public.travel_plan_notes (
  id SERIAL PRIMARY KEY,

  travel_plan_id INTEGER NOT NULL
    REFERENCES public.travel_plans(id)
    ON DELETE CASCADE,

  note_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,

  involved_staff TEXT,
  content TEXT,

  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT travel_plan_notes_type_check
  CHECK (
    UPPER(TRIM(note_type)) IN ('REVIEW', 'FINDINGS')
  )
);

-- =====================================================
-- RECREATE CALENDAR ACTIVITIES
-- =====================================================

CREATE TABLE public.calendar_activities (
  id SERIAL PRIMARY KEY,

  title TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,

  days INTEGER,
  subject TEXT,
  venue TEXT,
  description TEXT,

  created_by INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT calendar_activities_date_check
  CHECK (date_to >= date_from)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_travel_plans_plan_date
ON public.travel_plans(plan_date);

CREATE INDEX idx_travel_plans_employee_name
ON public.travel_plans(employee_name);

CREATE INDEX idx_travel_plans_branch_name
ON public.travel_plans(branch_name);

CREATE INDEX idx_travel_plans_status
ON public.travel_plans(status);

CREATE INDEX idx_travel_plan_photos_plan_id
ON public.travel_plan_photos(travel_plan_id);

CREATE INDEX idx_travel_plan_photos_type
ON public.travel_plan_photos(photo_type);

CREATE INDEX idx_travel_plan_notes_plan_id
ON public.travel_plan_notes(travel_plan_id);

CREATE INDEX idx_travel_plan_notes_type
ON public.travel_plan_notes(note_type);

CREATE INDEX idx_calendar_activities_date_from
ON public.calendar_activities(date_from);

CREATE INDEX idx_calendar_activities_date_to
ON public.calendar_activities(date_to);

-- =====================================================
-- ADMIN PERMISSIONS
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
  'admin',
  '',
  'travel_plan',
  actions.action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('approve'),
    ('reject'),
    ('delete'),
    ('upload')
) actions(action_name)
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
-- OPERATION DEPARTMENT PERMISSIONS
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
  roles.role_name,
  'OPERATION DEPARTMENT',
  'travel_plan',
  actions.action_name,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    ('area manager'),
    ('acting area manager'),
    ('regional manager'),
    ('acting regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) roles(role_name)
CROSS JOIN (
  VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('upload')
) actions(action_name)
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
-- TREAD DEPARTMENT PERMISSIONS
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
  roles.role_name,
  'TREAD DEPARTMENT',
  'travel_plan',
  actions.action_name,
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
) roles(role_name)
CROSS JOIN (
  VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('edit'),
    ('upload')
) actions(action_name)
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