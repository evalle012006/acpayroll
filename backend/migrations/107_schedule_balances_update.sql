BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS
monthly_balance_postings_month_employee_uniq
ON public.monthly_balance_postings
(
  month_label,
  employee_no
);

CREATE UNIQUE INDEX IF NOT EXISTS
schedule_balance_snapshots_month_staff_uniq
ON public.schedule_balance_snapshots
(
  snapshot_month,
  staff_id
);

CREATE UNIQUE INDEX IF NOT EXISTS
staff_balances_employee_no_uniq
ON public.staff_balances
(
  employee_no
);

COMMIT;