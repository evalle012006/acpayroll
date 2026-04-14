BEGIN;

CREATE TABLE IF NOT EXISTS public.transfer_staff_order_files (
  id SERIAL PRIMARY KEY,
  transfer_order_id INTEGER NOT NULL
    REFERENCES public.transfer_staff_orders(id)
    ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_staff_order_files_order_id
  ON public.transfer_staff_order_files(transfer_order_id);

CREATE INDEX IF NOT EXISTS idx_transfer_staff_order_files_created_at
  ON public.transfer_staff_order_files(created_at);

COMMIT;