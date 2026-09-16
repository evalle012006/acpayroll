BEGIN;

UPDATE loan_requests
SET
    vice_president_status = 'Approved',
    vice_president_approved_at = COALESCE(
        vice_president_approved_at,
        approved_at::timestamp
    )
WHERE LOWER(TRIM(COALESCE(status, ''))) = 'approved'
  AND LOWER(TRIM(COALESCE(approval_stage, ''))) = 'completed'
  AND LOWER(TRIM(COALESCE(vice_president_status, ''))) <> 'approved'
  AND LOWER(TRIM(COALESCE(loan_type, ''))) IN (
      'salary advance',
      'special advance',
      'special loan',
      'cash advance',
      'cash loan'
  );

ALTER TABLE public.promotion_orders
  ADD COLUMN IF NOT EXISTS admin_order_status VARCHAR(30) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS admin_order_approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS admin_order_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admin_order_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS admin_order_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS admin_order_attachment_mime TEXT,

  ADD COLUMN IF NOT EXISTS contract_signing_status VARCHAR(30) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS contract_signing_approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS contract_signing_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS contract_signing_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS contract_signing_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS contract_signing_attachment_mime TEXT,

  ADD COLUMN IF NOT EXISTS hr_final_status VARCHAR(30) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS hr_final_approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS hr_final_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hr_final_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS hr_final_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS hr_final_attachment_mime TEXT;

ALTER TABLE public.promotion_orders
    ALTER COLUMN approved_by TYPE integer
        USING approved_by::integer,

    ALTER COLUMN created_by TYPE integer
        USING created_by::integer,

    ALTER COLUMN rejected_by TYPE integer
        USING rejected_by::integer;

COMMIT;