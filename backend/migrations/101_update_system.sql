BEGIN;

ALTER TABLE public.transfer_staff_orders
    DROP CONSTRAINT IF EXISTS transfer_staff_orders_status_chk;

    ALTER TABLE public.transfer_staff_orders
    ADD CONSTRAINT transfer_staff_orders_status_chk
        CHECK (
            status IN (
                'Pending',
                'Pending VP Approval',
                'Waiting HR File',
                'Approved',
                'Rejected',
                'Void'
            )
        );

CREATE TABLE IF NOT EXISTS public.schedule_balance_snapshot_history (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL,
  snapshot_month DATE NOT NULL,
  staff_id BIGINT NOT NULL,
  employee_no VARCHAR(100),

  old_cbu NUMERIC DEFAULT 0,
  new_cbu NUMERIC DEFAULT 0,

  old_cashbond NUMERIC DEFAULT 0,
  new_cashbond NUMERIC DEFAULT 0,

  old_utility NUMERIC DEFAULT 0,
  new_utility NUMERIC DEFAULT 0,

  reason TEXT NOT NULL,
  edited_by BIGINT,
  edited_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO public.role_permissions
    (
    role,
    department,
    module_name,
    action_name,
    allowed,
    created_at,
    updated_at
    )
    SELECT
    role_name,
    department_name,
    'transfer_staff_order',
    'edit',
    true,
    NOW(),
    NOW()
    FROM (
    VALUES
        ('branch manager', 'HR DEPARTMENT'),
        ('area manager', 'HR DEPARTMENT'),
        ('regional manager', 'HR DEPARTMENT'),
        ('assistant vice president', 'HR DEPARTMENT'),
        ('vice president', 'HR DEPARTMENT'),
        ('senior vice president', 'HR DEPARTMENT'),

        ('branch manager', 'ACCOUNTING DEPARTMENT'),
        ('area manager', 'ACCOUNTING DEPARTMENT'),
        ('regional manager', 'ACCOUNTING DEPARTMENT'),
        ('assistant vice president', 'ACCOUNTING DEPARTMENT'),
        ('vice president', 'ACCOUNTING DEPARTMENT'),
        ('senior vice president', 'ACCOUNTING DEPARTMENT'),

        ('branch manager', 'IT DEPARTMENT'),
        ('area manager', 'IT DEPARTMENT'),
        ('regional manager', 'IT DEPARTMENT'),
        ('assistant vice president', 'IT DEPARTMENT'),
        ('vice president', 'IT DEPARTMENT'),
        ('senior vice president', 'IT DEPARTMENT')
    ) AS permissions(role_name, department_name)

    ON CONFLICT
    (
    role,
    COALESCE(department, ''),
    module_name,
    action_name
    )
    DO UPDATE SET
    allowed = true,
    updated_at = NOW();

ALTER TABLE public.transfer_staff_orders
    ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

UPDATE public.transfer_staff_orders
SET updated_at = NOW()
WHERE updated_at IS NULL;

COMMIT;