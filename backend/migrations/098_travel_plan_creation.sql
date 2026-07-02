BEGIN;

INSERT INTO role_permissions
  (role, department, module_name, action_name, allowed, created_at, updated_at)
  SELECT
    'admin',
    '',
    'travel_plan',
    a.action_name,
    true,
    NOW(),
    NOW()
  FROM (
    VALUES
      ('view'),
      ('create'),
      ('edit'),
      ('approve'),
      ('reject'),
      ('delete')
  ) a(action_name)
  ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
  DO UPDATE SET allowed = true, updated_at = NOW();

INSERT INTO role_permissions
  (role, department, module_name, action_name, allowed, created_at, updated_at)
  SELECT
    r.role,
    'TREAD DEPARTMENT',
    'sbf_order',
    'view',
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
  ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
  DO UPDATE SET allowed = true, updated_at = NOW();

INSERT INTO role_permissions
  (role, department, module_name, action_name, allowed, created_at, updated_at)
  SELECT
    r.role,
    'OPERATION DEPARTMENT',
    'travel_plan',
    'view',
    true,
    NOW(),
    NOW()
  FROM (
    VALUES
      ('area manager'),
      ('regional manager'),
      ('assistant vice president'),
      ('vice president'),
      ('senior vice president')
  ) r(role)
  ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
  DO UPDATE SET allowed = true, updated_at = NOW();

INSERT INTO role_permissions
  (role, department, module_name, action_name, allowed, created_at, updated_at)
  SELECT
    r.role,
    'ACCOUNTING DEPARTMENT',
    'consolidation',
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
      ('view'),
      ('create'),
      ('edit'),
      ('delete')
  ) a(action_name)
  ON CONFLICT (role, COALESCE(department,''), module_name, action_name)
  DO UPDATE SET allowed = true, updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.travel_plans (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    plan_date DATE NOT NULL,
    branch_name TEXT,
    description TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  );

ALTER TABLE public.travel_plans
  ADD COLUMN IF NOT EXISTS review TEXT,
  ADD COLUMN IF NOT EXISTS findings TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS check_in_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS check_out_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS photo_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS photo_longitude NUMERIC,

  ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS check_in_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS check_in_longitude NUMERIC,

  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS check_out_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS check_out_longitude NUMERIC,

  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.travel_plan_photos (
  id SERIAL PRIMARY KEY,
  travel_plan_id INTEGER NOT NULL REFERENCES public.travel_plans(id) ON DELETE CASCADE,

  photo_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  photo_url TEXT NOT NULL,

  latitude NUMERIC,
  longitude NUMERIC,
  captured_at TIMESTAMP,
  uploaded_by INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.travel_plan_notes (
  id SERIAL PRIMARY KEY,
  travel_plan_id INTEGER NOT NULL REFERENCES public.travel_plans(id) ON DELETE CASCADE,
  note_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  involved_staff TEXT,
  content TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.travel_plans
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS submitted_by INTEGER;

COMMIT;