COMMIT;

ALTER TABLE transfer_staff_orders
DROP CONSTRAINT IF EXISTS transfer_staff_orders_status_chk;

ALTER TABLE transfer_staff_orders
ADD CONSTRAINT transfer_staff_orders_status_chk
CHECK (
  status IN (
    'Pending',
    'Pending VP Approval',
    'Waiting HR File',
    'Approved',
    'Rejected'
  )
);

BEGIN;