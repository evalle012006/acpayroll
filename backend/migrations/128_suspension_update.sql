BEGIN;

ALTER TABLE public.suspension_orders

ADD COLUMN IF NOT EXISTS admin_order_attachment_path TEXT,
ADD COLUMN IF NOT EXISTS admin_order_attachment_name TEXT,
ADD COLUMN IF NOT EXISTS admin_order_attachment_mime TEXT,
ADD COLUMN IF NOT EXISTS admin_order_uploaded_by INTEGER,
ADD COLUMN IF NOT EXISTS admin_order_uploaded_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS signed_admin_order_path TEXT,
ADD COLUMN IF NOT EXISTS signed_admin_order_name TEXT,
ADD COLUMN IF NOT EXISTS signed_admin_order_mime TEXT,
ADD COLUMN IF NOT EXISTS signed_admin_order_uploaded_by INTEGER,
ADD COLUMN IF NOT EXISTS signed_admin_order_uploaded_at TIMESTAMP,

ADD COLUMN IF NOT EXISTS received_by INTEGER,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;

COMMIT;