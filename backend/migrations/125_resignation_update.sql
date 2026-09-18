BEGIN;

-- ============================================================
-- RESIGNATION:
-- HR INITIAL -> AVP SIGNATURE -> HR FINAL
-- ============================================================

ALTER TABLE public.resignation_requests
  ADD COLUMN IF NOT EXISTS hr_initial_approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS hr_initial_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hr_initial_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS hr_initial_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS hr_initial_attachment_mime TEXT,

  ADD COLUMN IF NOT EXISTS avp_signature_approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS avp_signature_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avp_signature_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS avp_signature_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS avp_signature_attachment_mime TEXT,

  ADD COLUMN IF NOT EXISTS hr_final_approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS hr_final_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hr_final_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS hr_final_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS hr_final_attachment_mime TEXT;

-- ------------------------------------------------------------
-- Foreign keys
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'resignation_requests_hr_initial_approved_by_fkey'
  ) THEN
    ALTER TABLE public.resignation_requests
      ADD CONSTRAINT resignation_requests_hr_initial_approved_by_fkey
      FOREIGN KEY (hr_initial_approved_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'resignation_requests_avp_signature_approved_by_fkey'
  ) THEN
    ALTER TABLE public.resignation_requests
      ADD CONSTRAINT resignation_requests_avp_signature_approved_by_fkey
      FOREIGN KEY (avp_signature_approved_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'resignation_requests_hr_final_approved_by_fkey'
  ) THEN
    ALTER TABLE public.resignation_requests
      ADD CONSTRAINT resignation_requests_hr_final_approved_by_fkey
      FOREIGN KEY (hr_final_approved_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;