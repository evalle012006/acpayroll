BEGIN;

-- =========================================
-- 1. DROP OLD FOREIGN KEY (wrong type)
-- =========================================
ALTER TABLE public.leave_attachments
DROP CONSTRAINT IF EXISTS leave_attachments_leave_request_id_fkey;

-- =========================================
-- 2. ALTER leave_requests.id → VARCHAR
-- =========================================
ALTER TABLE public.leave_requests
ALTER COLUMN id TYPE VARCHAR(50)
USING id::VARCHAR(50);

-- =========================================
-- 3. ALTER leave_attachments.leave_request_id → VARCHAR
-- =========================================
ALTER TABLE public.leave_attachments
ALTER COLUMN leave_request_id TYPE VARCHAR(50)
USING leave_request_id::VARCHAR(50);

-- =========================================
-- 4. RECREATE FOREIGN KEY (correct type)
-- =========================================
ALTER TABLE public.leave_attachments
ADD CONSTRAINT leave_attachments_leave_request_id_fkey
FOREIGN KEY (leave_request_id)
REFERENCES public.leave_requests(id)
ON DELETE CASCADE;

-- =========================================
-- 5. OPTIONAL: ADD INDEX (performance)
-- =========================================
CREATE INDEX IF NOT EXISTS idx_leave_attachments_leave_request_id
ON public.leave_attachments(leave_request_id);

COMMIT;