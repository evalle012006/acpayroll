BEGIN;

ALTER TABLE public.status_history
DROP CONSTRAINT IF EXISTS fk_status_history_employee_no;

ALTER TABLE public.status_history
ADD CONSTRAINT fk_status_history_employee_no
FOREIGN KEY (employee_no)
REFERENCES public.staff(employee_no)
ON UPDATE CASCADE
ON DELETE NO ACTION;

COMMIT;