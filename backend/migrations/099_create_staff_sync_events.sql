BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_sync_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    VARCHAR(50)  NOT NULL,
  employee_id   INTEGER      NOT NULL,
  employee_no   VARCHAR(100),
  source_table  VARCHAR(100),
  source_id     TEXT,
  payload       JSONB        NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
  attempts      INTEGER      NOT NULL DEFAULT 0,
  last_error    TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_sync_events_status
  ON public.staff_sync_events (status);

CREATE INDEX IF NOT EXISTS idx_staff_sync_events_employee_id
  ON public.staff_sync_events (employee_id);

CREATE INDEX IF NOT EXISTS idx_staff_sync_events_created_at
  ON public.staff_sync_events (created_at DESC);

COMMENT ON TABLE public.staff_sync_events IS
  'Audit log and retry queue for outbound LMS sync pushes. '
  'Written inside the approval transaction; POST to LMS fires after commit.';

COMMIT;