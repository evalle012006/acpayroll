BEGIN;

ALTER TABLE public.exit_staff_orders
DROP CONSTRAINT IF EXISTS exit_staff_orders_exit_type_check;

ALTER TABLE public.exit_staff_orders
ADD CONSTRAINT exit_staff_orders_exit_type_check
CHECK (
  exit_type IN (
    'AWOL',
    'Resigned',
    'Terminated',
    'Deceased'
  )
);

ALTER TABLE public.staff
DROP CONSTRAINT IF EXISTS staff_exit_type_check;

ALTER TABLE public.staff
ADD CONSTRAINT staff_exit_type_check
CHECK (
  exit_type IS NULL OR exit_type IN (
    'AWOL',
    'Resigned',
    'Terminated',
    'Deceased'
  )
);

COMMIT;