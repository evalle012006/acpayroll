BEGIN;

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
  ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS photo_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS photo_longitude NUMERIC,

  ADD COLUMN IF NOT EXISTS check_in_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS check_in_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS check_in_longitude NUMERIC,

  ADD COLUMN IF NOT EXISTS check_out_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS check_out_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS check_out_longitude NUMERIC,

  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS submitted_by INTEGER,

  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,

  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.travel_plan_photos (
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

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.travel_plan_notes (
  id SERIAL PRIMARY KEY,
  travel_plan_id INTEGER NOT NULL
    REFERENCES public.travel_plans(id)
    ON DELETE CASCADE,

  note_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  involved_staff TEXT,
  content TEXT,
  created_by INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_travel_plans_plan_date
  ON public.travel_plans(plan_date);

CREATE INDEX IF NOT EXISTS idx_travel_plans_employee_name
  ON public.travel_plans(employee_name);

CREATE INDEX IF NOT EXISTS idx_travel_plans_branch_name
  ON public.travel_plans(branch_name);

CREATE INDEX IF NOT EXISTS idx_travel_plan_photos_plan_id
  ON public.travel_plan_photos(travel_plan_id);

CREATE INDEX IF NOT EXISTS idx_travel_plan_notes_plan_id
  ON public.travel_plan_notes(travel_plan_id);

COMMIT;