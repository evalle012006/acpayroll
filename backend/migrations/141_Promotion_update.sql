BEGIN;

ALTER TABLE public.promotion_orders

ADD COLUMN IF NOT EXISTS current_area TEXT,
ADD COLUMN IF NOT EXISTS current_region TEXT,
ADD COLUMN IF NOT EXISTS current_division TEXT,
ADD COLUMN IF NOT EXISTS current_department TEXT,

ADD COLUMN IF NOT EXISTS proposed_area TEXT,
ADD COLUMN IF NOT EXISTS proposed_region TEXT,
ADD COLUMN IF NOT EXISTS proposed_division TEXT,
ADD COLUMN IF NOT EXISTS proposed_department TEXT;

COMMIT;