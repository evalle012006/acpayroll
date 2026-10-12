BEGIN;

ALTER TABLE public.awol_reports
DROP CONSTRAINT IF EXISTS awol_reports_status_chk;

ALTER TABLE public.awol_reports
ADD CONSTRAINT awol_reports_status_chk
CHECK (
    status IN (
        'Waiting Area Manager Approval',
        'Waiting Regional Manager Approval',
        'Waiting Assistant Vice President Approval',
        'Waiting Vice President Approval',
        'Waiting HR Department Approval',
        'Waiting Final File Upload',
        'Approved',
        'Rejected',
        'Voided'
    )
);

COMMIT;