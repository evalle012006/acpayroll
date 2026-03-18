BEGIN;

-- AREA CONFIG
INSERT INTO public.area_configurations (area, region, division, created_at)
VALUES
    ('Area 1', 'Region IV-A', 'Division A', now()),
    ('Area 2', 'Region IV-A', 'Division B', now()),
    ('Area 3', 'Region NCR', 'Division C', now())
ON CONFLICT DO NOTHING;

-- BRANCHES (FIXED: removed (code))
INSERT INTO public.branches (code, name, area, address, latitude, longitude)
VALUES
    ('BR001', 'Baras Main Branch', 'Area 1', 'Baras, Rizal', 14.5167000, 121.2650000),
    ('BR002', 'Tanay Branch', 'Area 1', 'Tanay, Rizal', 14.4967000, 121.2860000),
    ('BR003', 'Antipolo Branch', 'Area 2', 'Antipolo, Rizal', 14.6255000, 121.1245000)
ON CONFLICT DO NOTHING;

-- DEPARTMENTS
INSERT INTO public.departments (code, name, description, created_at, updated_at)
VALUES
    ('HR', 'Human Resources', 'Handles employee records', now(), now()),
    ('OPS', 'Operations', 'Handles operations', now(), now()),
    ('ACC', 'Accounting', 'Handles payroll', now(), now()),
    ('IT', 'IT', 'System support', now(), now())
ON CONFLICT DO NOTHING;

-- USERS (uses subquery ✔)
INSERT INTO public.users (username, password, role, created_at, updated_at, branch_id)
VALUES
    ('admin', '$2b$10$8R1NLvnu.3UgQd/r4kzczeYC6VJau9CS1IYKgvic2aUinCHkBelmm', 'admin', now(), now(),
        (SELECT id FROM public.branches WHERE code = 'BR001')),
    ('hrmanager', '$2b$10$8R1NLvnu.3UgQd/r4kzczeYC6VJau9CS1IYKgvic2aUinCHkBelmm', 'hr', now(), now(),
        (SELECT id FROM public.branches WHERE code = 'BR001')),
    ('branchuser1', '$2b$10$8R1NLvnu.3UgQd/r4kzczeYC6VJau9CS1IYKgvic2aUinCHkBelmm', 'user', now(), now(),
        (SELECT id FROM public.branches WHERE code = 'BR002'))
ON CONFLICT (username) DO NOTHING;

-- POSITION RATES
INSERT INTO public.position_comp_rates
("position", salary, ecola, transportation, updated_at, created_at, cbu, cashbond, utility)
VALUES
    ('Branch Manager', 25000, 2000, 1500, now(), now(), 500, 300, 200),
    ('Cashier', 14000, 1200, 1000, now(), now(), 300, 200, 150)
ON CONFLICT ("position") DO NOTHING;

-- STAFF (FIXED: uses branch subquery ✔)
INSERT INTO public.staff (
    fullname, "position", department, area, salary, ecola,
    payroll_date, branch_id, employee_no, status,
    first_name, last_name, middle_name
)
VALUES
(
    'Juan Dela Cruz', 'Branch Manager', 'Operations', 'Area 1',
    25000, 2000,
    CURRENT_DATE,
    (SELECT id FROM public.branches WHERE code = 'BR001'),
    'EMP-0001', 'Active',
    'Juan', 'Dela Cruz', 'Santos'
),
(
    'Maria Santos', 'Cashier', 'Accounting', 'Area 1',
    14000, 1200,
    CURRENT_DATE,
    (SELECT id FROM public.branches WHERE code = 'BR002'),
    'EMP-0002', 'Active',
    'Maria', 'Santos', 'Lopez'
)
ON CONFLICT (employee_no) DO NOTHING;

-- STAFF BALANCES
INSERT INTO public.staff_balances (
    fullname, cbu, cashbond, "position", employee_no
)
VALUES
    ('Juan Dela Cruz', 500, 300, 'Branch Manager', 'EMP-0001'),
    ('Maria Santos', 300, 200, 'Cashier', 'EMP-0002')
ON CONFLICT (employee_no) DO NOTHING;

-- BONUS RUN
INSERT INTO public.bonus_runs (branch_id, bonus_month, notes, created_at, updated_at)
VALUES
(
    (SELECT id FROM public.branches WHERE code = 'BR001'),
    '2026-12-01',
    'Year-end bonus',
    now(),
    now()
);

-- BONUS LINE
INSERT INTO public.bonus_lines (
    bonus_run_id, employee_id, salary, month_13,
    created_at, updated_at
)
VALUES
(
    (SELECT id FROM public.bonus_runs LIMIT 1),
    (SELECT id FROM public.staff WHERE employee_no = 'EMP-0001'),
    25000,
    25000,
    now(),
    now()
)
ON CONFLICT DO NOTHING;

COMMIT;