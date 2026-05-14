BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  role VARCHAR(100),
  department VARCHAR(150),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  target_branch_id VARCHAR(100),
  target_branch_code VARCHAR(100),
  target_branch_name VARCHAR(150),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS role VARCHAR(100);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS department VARCHAR(150);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS link TEXT;

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS target_branch_id VARCHAR(100);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS target_branch_code VARCHAR(100);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS target_branch_name VARCHAR(150);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS scope VARCHAR(50) DEFAULT 'all';

COMMIT;