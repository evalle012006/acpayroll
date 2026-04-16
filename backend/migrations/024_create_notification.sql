BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  scope VARCHAR(50) NOT NULL DEFAULT 'all',

  target_branch_id INTEGER NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  target_branch_code VARCHAR(100),
  target_branch_name VARCHAR(255),

  created_by INTEGER NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,

  meta JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_target_branch_id
  ON public.notifications(target_branch_id);

CREATE INDEX IF NOT EXISTS idx_notifications_scope
  ON public.notifications(scope);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON public.notifications(is_read);

COMMIT;