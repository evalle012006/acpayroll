BEGIN;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS finding_type TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS finding_photo_url TEXT;

ALTER TABLE public.travel_plan_notes
ADD COLUMN IF NOT EXISTS due_date DATE;

COMMIT;