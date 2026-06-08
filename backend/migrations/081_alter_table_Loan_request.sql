BEGIN;

ALTER TABLE public.exit_staff_orders
DROP CONSTRAINT IF EXISTS exit_staff_orders_status_check;

ALTER TABLE public.exit_staff_orders
ADD CONSTRAINT exit_staff_orders_status_check
CHECK (
  status IN (
    'Pending',
    'Approved',
    'Rejected',
    'Re-Applied'
  )
);

COMMIT;