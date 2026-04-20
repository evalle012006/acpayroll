BEGIN;

CREATE TABLE IF NOT EXISTS public.resignation_requests (
  id integer PRIMARY KEY,
  request_no varchar(50) UNIQUE,
  staff_id integer,
  employee_no varchar(100),
  employee_name text,
  last_name varchar(150),
  first_name varchar(150),
  middle_name varchar(150),
  branch_id integer,
  branch_code varchar(100),
  branch_name varchar(150),
  resignation_date date,
  effective_date date NOT NULL,
  remarks text,
  status varchar(30) NOT NULL DEFAULT 'Pending',
  created_by integer,
  approved_by integer,
  approved_at timestamp without time zone,
  rejected_by integer,
  rejected_at timestamp without time zone,
  rejection_reason text,
  created_at timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resignation_requests_status
  ON public.resignation_requests(status);

CREATE INDEX IF NOT EXISTS idx_resignation_requests_employee_no
  ON public.resignation_requests(employee_no);

CREATE INDEX IF NOT EXISTS idx_resignation_requests_branch_id
  ON public.resignation_requests(branch_id);

CREATE SEQUENCE IF NOT EXISTS public.resignation_requests_id_seq
  START WITH 1
  INCREMENT BY 1
  OWNED BY NONE;

COMMIT;