BEGIN;

CREATE TABLE IF NOT EXISTS public.board_resolution_requests (
    id SERIAL PRIMARY KEY,

    request_no VARCHAR(50) UNIQUE,

    title TEXT,
    resolution_type VARCHAR(150),
    department VARCHAR(150),
    details TEXT,

    status VARCHAR(100) DEFAULT 'Submitted',

    created_by INTEGER,
    created_by_role VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),

    request_attachment_path TEXT,
    request_attachment_name TEXT,
    request_attachment_mime TEXT,

    final_attachment_path TEXT,
    final_attachment_name TEXT,
    final_attachment_mime TEXT,

    avp_approved_by INTEGER,
    avp_approved_at TIMESTAMP,

    vp_approved_by INTEGER,
    vp_approved_at TIMESTAMP,

    svp_approved_by INTEGER,
    svp_approved_at TIMESTAMP,

    president_approved_by INTEGER,
    president_approved_at TIMESTAMP,

    final_uploaded_by INTEGER,
    final_uploaded_at TIMESTAMP,

    rejected_by INTEGER,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,

    date_created DATE,
    to_text TEXT,
    thru_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_board_resolution_created_by
ON public.board_resolution_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_board_resolution_status
ON public.board_resolution_requests(status);

CREATE INDEX IF NOT EXISTS idx_board_resolution_created_at
ON public.board_resolution_requests(created_at DESC);

COMMIT;