BEGIN;

-- Keep the primary key id as integer.
-- Add a readable leave number instead.

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS leave_no VARCHAR(50);

UPDATE public.leave_requests
SET leave_no = COALESCE(
  NULLIF(leave_no, ''),
  'LR-' || TO_CHAR(COALESCE(date_created, NOW()), 'YYYYMMDD') || '-' || LPAD(id::text, 6, '0')
)
WHERE leave_no IS NULL OR leave_no = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_requests_leave_no
ON public.leave_requests(leave_no);

COMMIT;