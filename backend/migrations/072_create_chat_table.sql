BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id SERIAL PRIMARY KEY,
  title TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  group_type VARCHAR(100),
  group_name VARCHAR(255),
  department VARCHAR(255),
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;

ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS group_type VARCHAR(100);

ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);

ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS department VARCHAR(255);

ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_chat_participants_user
ON public.chat_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation
ON public.chat_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
ON public.chat_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created
ON public.chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
ON public.chat_messages(conversation_id, sender_id, is_read);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_group_department
ON public.chat_conversations(is_group, department);

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