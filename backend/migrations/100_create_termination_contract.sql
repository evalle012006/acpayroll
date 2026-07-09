BEGIN;

CREATE TABLE IF NOT EXISTS public.termination_requests (
    id BIGSERIAL PRIMARY KEY,

    request_no VARCHAR(50) UNIQUE NOT NULL,

    employee_id INTEGER NOT NULL
        REFERENCES public.staff(id)
        ON DELETE RESTRICT,

    employee_name TEXT NOT NULL,

    branch_id INTEGER,
    branch_code VARCHAR(50),
    branch_name TEXT,

    area TEXT,
    region TEXT,
    division TEXT,
    department TEXT,
    position TEXT,

    date_created DATE NOT NULL,
    effective_date DATE NOT NULL,

    reason TEXT NOT NULL,
    remarks TEXT,

    status VARCHAR(100)
        NOT NULL
        DEFAULT 'Waiting Final File Upload',

    created_by INTEGER,
    approved_by INTEGER,
    rejected_by INTEGER,
    hr_uploaded_by INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    hr_uploaded_at TIMESTAMP,

    rejection_reason TEXT,

    request_attachment_path TEXT,
    request_attachment_name TEXT,
    request_attachment_mime TEXT,

    approved_attachment_path TEXT,
    approved_attachment_name TEXT,
    approved_attachment_mime TEXT
);

CREATE INDEX IF NOT EXISTS idx_termination_employee
ON public.termination_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_termination_status
ON public.termination_requests(status);

CREATE INDEX IF NOT EXISTS idx_termination_branch
ON public.termination_requests(branch_id);

CREATE INDEX IF NOT EXISTS idx_termination_created
ON public.termination_requests(created_at DESC);

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
SELECT
    r.role,
    d.department,
    'termination_request',
    a.action_name,
    TRUE,
    NOW(),
    NOW()
FROM
(
    VALUES
    ('branch manager'),
    ('area manager'),
    ('regional manager'),
    ('assistant vice president'),
    ('vice president'),
    ('senior vice president')
) r(role)

CROSS JOIN

(
    VALUES
    ('HR DEPARTMENT'),
    ('ACCOUNTING DEPARTMENT'),
    ('IT DEPARTMENT')
) d(department)

CROSS JOIN

(
    VALUES
    ('view'),
    ('view_all'),
    ('create'),
    ('approve'),
    ('reject'),
    ('void'),
    ('upload_approved')
) a(action_name)

ON CONFLICT
(role, COALESCE(department,''), module_name, action_name)

DO UPDATE SET
allowed = TRUE,
updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('admin','','termination_request','view',TRUE,NOW(),NOW()),
('admin','','termination_request','view_all',TRUE,NOW(),NOW()),
('admin','','termination_request','create',TRUE,NOW(),NOW()),
('admin','','termination_request','approve',TRUE,NOW(),NOW()),
('admin','','termination_request','reject',TRUE,NOW(),NOW()),
('admin','','termination_request','void',TRUE,NOW(),NOW()),
('admin','','termination_request','delete',TRUE,NOW(),NOW()),
('admin','','termination_request','upload_approved',TRUE,NOW(),NOW()),
('admin','','termination_request','bypass',TRUE,NOW(),NOW())

ON CONFLICT
(role, COALESCE(department,''), module_name, action_name)

DO UPDATE SET
allowed = TRUE,
updated_at = NOW();

INSERT INTO role_permissions
(role, department, module_name, action_name, allowed, created_at, updated_at)
VALUES
('it','','termination_request','view',TRUE,NOW(),NOW()),
('it','','termination_request','view_all',TRUE,NOW(),NOW()),
('it','','termination_request','create',TRUE,NOW(),NOW()),
('it','','termination_request','approve',TRUE,NOW(),NOW()),
('it','','termination_request','reject',TRUE,NOW(),NOW()),
('it','','termination_request','void',TRUE,NOW(),NOW()),
('it','','termination_request','delete',TRUE,NOW(),NOW()),
('it','','termination_request','upload_approved',TRUE,NOW(),NOW()),
('it','','termination_request','bypass',TRUE,NOW(),NOW())

ON CONFLICT
(role, COALESCE(department,''), module_name, action_name)

DO UPDATE SET
allowed = TRUE,
updated_at = NOW();

COMMIT;