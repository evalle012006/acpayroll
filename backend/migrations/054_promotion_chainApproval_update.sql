BEGIN;

ALTER TABLE public.promotion_orders
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS senior_vice_president_status VARCHAR(50) DEFAULT 'Pending';

COMMIT;