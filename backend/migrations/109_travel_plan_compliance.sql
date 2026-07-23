BEGIN;

-- =====================================================
-- TRAVEL PLAN COMPLIANCES
-- =====================================================
-- One row is created for every staff member involved
-- in a FINDINGS note.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.travel_plan_compliances (
  id BIGSERIAL PRIMARY KEY,

  travel_plan_id INTEGER NOT NULL,
  finding_note_id INTEGER NOT NULL,

  employee_id INTEGER,
  employee_no VARCHAR(100),
  employee_name TEXT NOT NULL,

  position TEXT,

  branch_id INTEGER,
  branch_name TEXT,

  department TEXT,
  area TEXT,
  region TEXT,
  division TEXT,

  finding_title TEXT NOT NULL,
  finding_details TEXT,

  due_date DATE,

  status VARCHAR(30) NOT NULL DEFAULT 'Pending',

  compliance_response TEXT,

  complied_at TIMESTAMP WITHOUT TIME ZONE,
  complied_by INTEGER,

  created_by INTEGER,

  created_at TIMESTAMP WITHOUT TIME ZONE
    NOT NULL DEFAULT (
      NOW() AT TIME ZONE 'Asia/Manila'
    ),

  updated_at TIMESTAMP WITHOUT TIME ZONE
    NOT NULL DEFAULT (
      NOW() AT TIME ZONE 'Asia/Manila'
    ),

  CONSTRAINT travel_plan_compliances_plan_fk
    FOREIGN KEY (travel_plan_id)
    REFERENCES public.travel_plans(id)
    ON DELETE CASCADE,

  CONSTRAINT travel_plan_compliances_finding_fk
    FOREIGN KEY (finding_note_id)
    REFERENCES public.travel_plan_notes(id)
    ON DELETE CASCADE,

  CONSTRAINT travel_plan_compliances_employee_fk
    FOREIGN KEY (employee_id)
    REFERENCES public.staff(id)
    ON DELETE SET NULL,

  CONSTRAINT travel_plan_compliances_branch_fk
    FOREIGN KEY (branch_id)
    REFERENCES public.branches(id)
    ON DELETE SET NULL,

  CONSTRAINT travel_plan_compliances_status_chk
    CHECK (
      status IN (
        'Pending',
        'Complied',
        'Cancelled'
      )
    )
);

-- Prevent duplicate assignment of the same staff
-- to the same findings note.
CREATE UNIQUE INDEX IF NOT EXISTS
  travel_plan_compliances_finding_employee_uidx
ON public.travel_plan_compliances
(
  finding_note_id,
  employee_id
)
WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  travel_plan_compliances_employee_idx
ON public.travel_plan_compliances
(
  employee_id
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliances_employee_no_idx
ON public.travel_plan_compliances
(
  employee_no
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliances_status_idx
ON public.travel_plan_compliances
(
  status
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliances_plan_idx
ON public.travel_plan_compliances
(
  travel_plan_id
);

CREATE INDEX IF NOT EXISTS
  travel_plan_compliances_finding_idx
ON public.travel_plan_compliances
(
  finding_note_id
);

ALTER TABLE travel_plan_compliances
ADD COLUMN checked_by TEXT;

ALTER TABLE travel_plan_compliances
ADD COLUMN checked_by_role TEXT;

ALTER TABLE travel_plan_compliances
ADD COLUMN checked_at TIMESTAMP;

ALTER TABLE travel_plan_compliances
ADD COLUMN checked_notes TEXT;

ALTER TABLE travel_plan_compliances
ADD COLUMN review_level INTEGER DEFAULT 0;

COMMIT;