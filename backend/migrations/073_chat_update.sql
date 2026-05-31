BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  original_name VARCHAR(255),
  file_key TEXT NOT NULL,
  mime_type VARCHAR(255),
  uploaded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_message
ON public.chat_attachments(message_id);

COMMIT;