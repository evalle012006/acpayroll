BEGIN;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS attachment_path text;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS area varchar(150);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS region varchar(150);

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS regional_manager_approved_by integer;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS regional_manager_approved_at timestamp without time zone;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS avp_approved_by integer;

ALTER TABLE public.resignation_requests
ADD COLUMN IF NOT EXISTS avp_approved_at timestamp without time zone;

COMMIT;