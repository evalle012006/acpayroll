BEGIN;

CREATE TABLE IF NOT EXISTS public.awol_report_approval_history (
    id BIGSERIAL PRIMARY KEY,

    report_id BIGINT NOT NULL
        REFERENCES public.awol_reports(id)
        ON DELETE CASCADE,

    actor_id BIGINT,

    actor_name TEXT NOT NULL,

    actor_role TEXT,

    actor_department TEXT,

    action TEXT NOT NULL,

    previous_status TEXT,

    new_status TEXT,

    notes TEXT,

    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
idx_awol_report_approval_history_report
ON public.awol_report_approval_history
(report_id, performed_at, id);

COMMIT;