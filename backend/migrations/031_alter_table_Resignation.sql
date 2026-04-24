BEGIN;

ALTER TABLE public.resignation_requests
ALTER COLUMN request_no TYPE VARCHAR(100);

ALTER TABLE public.resignation_requests
ALTER COLUMN employee_no TYPE VARCHAR(100);

ALTER TABLE public.resignation_requests
ALTER COLUMN branch_code TYPE VARCHAR(100);

ALTER TABLE public.resignation_requests
ALTER COLUMN branch_name TYPE VARCHAR(200);

ALTER TABLE public.resignation_requests
ALTER COLUMN area TYPE VARCHAR(150);

ALTER TABLE public.resignation_requests
ALTER COLUMN region TYPE VARCHAR(150);

ALTER TABLE public.resignation_requests
ALTER COLUMN status TYPE VARCHAR(100);

COMMIT;