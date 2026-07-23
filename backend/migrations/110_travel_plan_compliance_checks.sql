BEGIN;

-- =====================================================
-- TRAVEL PLAN COMPLIANCE CHECK HISTORY
-- =====================================================
-- Stores every manager who checks a staff compliance.
--
-- Example:
-- Area Manager checks first
-- Regional Manager checks next
-- AVP checks next
--
-- Every check remains visible in the audit trail.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.travel_plan_compliance_checks (
  id BIGSERIAL PRIMARY KEY,

  compliance_id BIGINT NOT NULL,

  checked_by_user_id INTEGER,

  checked_by_name TEXT,
  checked_by_role TEXT NOT NULL,
  checked_by_department TEXT,

  review_level INTEGER NOT NULL DEFAULT 0,

  remarks TEXT,

  checked_at TIMESTAMP WITHOUT TIME ZONE
    NOT NULL DEFAULT (
      NOW() AT TIME ZONE 'Asia/Manila'
    ),

  created_at TIMESTAMP WITHOUT TIME ZONE
    NOT NULL DEFAULT (
      NOW() AT TIME ZONE 'Asia/Manila'
    ),

  CONSTRAINT travel_plan_compliance_checks_compliance_fk
    FOREIGN KEY (compliance_id)
    REFERENCES public.travel_plan_compliances(id)
    ON DELETE CASCADE,

  CONSTRAINT travel_plan_compliance_checks_review_level_chk
    CHECK (
      review_level BETWEEN 1 AND 6
    )
);

-- =====================================================
-- PREVENT THE SAME ROLE FROM CHECKING THE SAME
-- COMPLIANCE MORE THAN ONCE
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  travel_plan_compliance_checks_unique_role_idx
ON public.travel_plan_compliance_checks
(
  compliance_id,
  LOWER(TRIM(checked_by_role))
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS
  travel_plan_compliance_checks_compliance_idx
ON public.travel_plan_compliance_checks
(
  compliance_id
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliance_checks_user_idx
ON public.travel_plan_compliance_checks
(
  checked_by_user_id
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliance_checks_level_idx
ON public.travel_plan_compliance_checks
(
  review_level
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliance_checks_date_idx
ON public.travel_plan_compliance_checks
(
  checked_at DESC
);

-- =====================================================
-- ADD CURRENT REVIEW PROGRESS TO COMPLIANCE TABLE
-- =====================================================

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS review_level INTEGER
NOT NULL DEFAULT 0;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_user_id INTEGER;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_name TEXT;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_role TEXT;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_department TEXT;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_at
TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_check_remarks TEXT;

-- =====================================================
-- REVIEW LEVEL VALIDATION
-- =====================================================
--
-- 0 = Waiting for staff compliance
-- 1 = Staff submitted compliance
-- 2 = Checked by Area Manager
-- 3 = Checked by Regional Manager
-- 4 = Checked by Assistant Vice President
-- 5 = Checked by Vice President
-- 6 = Checked by Senior Vice President / Final
-- =====================================================

ALTER TABLE public.travel_plan_compliances
DROP CONSTRAINT IF EXISTS
  travel_plan_compliances_review_level_chk;

ALTER TABLE public.travel_plan_compliances
ADD CONSTRAINT
  travel_plan_compliances_review_level_chk
CHECK (
  review_level BETWEEN 0 AND 6
);

-- =====================================================
-- STATUS UPDATE
-- =====================================================
-- Add Submitted and Checked while preserving the
-- existing Pending, Complied, and Cancelled statuses.
-- =====================================================

ALTER TABLE public.travel_plan_compliances
DROP CONSTRAINT IF EXISTS
  travel_plan_compliances_status_chk;

ALTER TABLE public.travel_plan_compliances
ADD CONSTRAINT
  travel_plan_compliances_status_chk
CHECK (
  status IN (
    'Pending',
    'Submitted',
    'Checked',
    'Complied',
    'Cancelled'
  )
);

-- =====================================================
-- SET EXISTING RECORD LEVELS
-- =====================================================

UPDATE public.travel_plan_compliances
SET review_level =
  CASE
    WHEN status = 'Complied' THEN 6
    WHEN compliance_response IS NOT NULL
      AND TRIM(compliance_response) <> ''
      THEN 1
    ELSE 0
  END
WHERE review_level = 0;

UPDATE public.travel_plan_compliances
SET status = 'Submitted'
WHERE status = 'Pending'
  AND compliance_response IS NOT NULL
  AND TRIM(compliance_response) <> '';

-- =====================================================
-- INDEX FOR REVIEW PROGRESS
-- =====================================================

CREATE INDEX IF NOT EXISTS
  travel_plan_compliances_review_level_idx
ON public.travel_plan_compliances
(
  review_level
);

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS review_level INTEGER
NOT NULL DEFAULT 0;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_user_id INTEGER;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_name TEXT;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_role TEXT;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_by_department TEXT;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_checked_at
TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS latest_check_remarks TEXT;

ALTER TABLE public.travel_plan_compliances
DROP CONSTRAINT IF EXISTS
travel_plan_compliances_review_level_chk;

ALTER TABLE public.travel_plan_compliances
ADD CONSTRAINT
travel_plan_compliances_review_level_chk
CHECK (
  review_level BETWEEN 0 AND 6
);

ALTER TABLE public.travel_plan_compliances
DROP CONSTRAINT IF EXISTS
travel_plan_compliances_status_chk;

ALTER TABLE public.travel_plan_compliances
ADD CONSTRAINT
travel_plan_compliances_status_chk
CHECK (
  status IN (
    'Pending',
    'Submitted',
    'Checked',
    'Complied',
    'Cancelled'
  )
);

CREATE TABLE IF NOT EXISTS
public.travel_plan_compliance_checks (
  id BIGSERIAL PRIMARY KEY,

  compliance_id BIGINT NOT NULL,

  checked_by_user_id INTEGER,
  checked_by_name TEXT,
  checked_by_role TEXT NOT NULL,
  checked_by_department TEXT,

  review_level INTEGER NOT NULL,

  remarks TEXT,

  checked_at TIMESTAMP WITHOUT TIME ZONE
    NOT NULL DEFAULT (
      NOW() AT TIME ZONE 'Asia/Manila'
    ),

  created_at TIMESTAMP WITHOUT TIME ZONE
    NOT NULL DEFAULT (
      NOW() AT TIME ZONE 'Asia/Manila'
    ),

  CONSTRAINT travel_plan_compliance_checks_compliance_fk
    FOREIGN KEY (compliance_id)
    REFERENCES public.travel_plan_compliances(id)
    ON DELETE CASCADE,

  CONSTRAINT travel_plan_compliance_checks_level_chk
    CHECK (
      review_level BETWEEN 1 AND 6
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS
travel_plan_compliance_checks_unique_role_idx
ON public.travel_plan_compliance_checks (
  compliance_id,
  LOWER(TRIM(checked_by_role))
);

CREATE INDEX IF NOT EXISTS
travel_plan_compliance_checks_compliance_idx
ON public.travel_plan_compliance_checks (
  compliance_id
);

CREATE INDEX IF NOT EXISTS
travel_plan_compliances_review_level_idx
ON public.travel_plan_compliances (
  review_level
);

UPDATE public.travel_plan_compliances
SET review_level =
  CASE
    WHEN status = 'Complied' THEN 6

    WHEN compliance_response IS NOT NULL
      AND TRIM(compliance_response) <> ''
      THEN 1

    ELSE 0
  END
WHERE review_level IS NULL
   OR review_level = 0;

UPDATE public.travel_plan_compliances
SET status = 'Submitted'
WHERE status = 'Pending'
  AND compliance_response IS NOT NULL
  AND TRIM(compliance_response) <> '';

ALTER TABLE public.travel_plan_compliances
ADD COLUMN IF NOT EXISTS position TEXT;

UPDATE public.travel_plan_compliances c
SET position = s.position
FROM public.staff s
WHERE c.employee_id = s.id
  AND (
    c.position IS NULL
    OR TRIM(c.position) = ''
  );

  ALTER TABLE public.travel_plan_compliances
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS area TEXT,
    ADD COLUMN IF NOT EXISTS region TEXT,
    ADD COLUMN IF NOT EXISTS division TEXT;

COMMIT;