ALTER TABLE public.board_resolution_requests
ADD COLUMN IF NOT EXISTS request_no VARCHAR(50) UNIQUE,

ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(150),
ADD COLUMN IF NOT EXISTS department VARCHAR(150),
ADD COLUMN IF NOT EXISTS details TEXT,

ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'Submitted',

ADD COLUMN IF NOT EXISTS created_by INTEGER,
ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(100),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),

ADD COLUMN IF NOT EXISTS request_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS request_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS request_attachment_mime TEXT,

ADD COLUMN IF NOT EXISTS final_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS final_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS final_attachment_mime TEXT,

ADD COLUMN IF NOT EXISTS avp_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS avp_approved_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS vp_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS vp_approved_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS svp_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS svp_approved_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS president_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS president_approved_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS final_uploaded_by INTEGER,
ADD COLUMN IF NOT EXISTS final_uploaded_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS rejected_by INTEGER,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,

ADD COLUMN IF NOT EXISTS date_created DATE,
ADD COLUMN IF NOT EXISTS to_text TEXT,
ADD COLUMN IF NOT EXISTS thru_text TEXT;

CREATE INDEX IF NOT EXISTS idx_board_resolution_created_by
ON public.board_resolution_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_board_resolution_status
ON public.board_resolution_requests(status);

CREATE INDEX IF NOT EXISTS idx_board_resolution_created_at
ON public.board_resolution_requests(created_at DESC);