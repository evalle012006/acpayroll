BEGIN;

-- =========================================
-- area_configurations
-- =========================================
INSERT INTO public.area_configurations (area, region, division, created_at)
VALUES
    ('Area 1', 'Region IV-A', 'Division A', now()),
    ('Area 2', 'Region IV-A', 'Division B', now()),
    ('Area 3', 'Region NCR', 'Division C', now())
ON CONFLICT DO NOTHING;

-- =========================================
-- branches
-- =========================================
INSERT INTO public.branches (code, name, area, address, latitude, longitude)
VALUES
    ('BR001', 'Baras Main Branch', 'Area 1', 'Baras, Rizal', 14.5167000, 121.2650000),
    ('BR002', 'Tanay Branch', 'Area 1', 'Tanay, Rizal', 14.4967000, 121.2860000),
    ('BR003', 'Antipolo Branch', 'Area 2', 'Antipolo, Rizal', 14.6255000, 121.1245000)
ON CONFLICT DO NOTHING;

-- =========================================
-- departments
-- =========================================
INSERT INTO public.departments (code, name, description, created_at, updated_at)
VALUES
    ('HR', 'Human Resources', 'Handles employee records and staffing', now(), now()),
    ('OPS', 'Operations', 'Handles day-to-day branch operations', now(), now()),
    ('ACC', 'Accounting', 'Handles payroll and financial records', now(), now()),
    ('IT', 'Information Technology', 'Handles system and technical support', now(), now())
ON CONFLICT DO NOTHING;

-- =========================================
-- users
-- NOTE:
-- replace passwords with real hashed passwords from bcrypt
-- =========================================
INSERT INTO public.users (username, password, role, created_at, updated_at, branch_id)
VALUES
    ('admin', '$2b$10$replace_with_real_bcrypt_hash', 'admin', now(), now(), '1'),
    ('hrmanager', '$2b$10$replace_with_real_bcrypt_hash', 'hr', now(), now(), '1'),
    ('branchuser1', '$2b$10$replace_with_real_bcrypt_hash', 'user', now(), now(), '2')
ON CONFLICT (username) DO NOTHING;

-- =========================================
-- position_comp_rates
-- =========================================
INSERT INTO public.position_comp_rates
("position", salary, ecola, transportation, updated_at, created_at, cbu, cashbond, utility)
VALUES
    ('Branch Manager', 25000.00, 2000.00, 1500.00, now(), now(), 500.00, 300.00, 200.00),
    ('Cashier', 14000.00, 1200.00, 1000.00, now(), now(), 300.00, 200.00, 150.00),
    ('Clerk', 13000.00, 1000.00, 800.00, now(), now(), 300.00, 200.00, 150.00),
    ('Field Staff', 15000.00, 1200.00, 1200.00, now(), now(), 300.00, 200.00, 150.00)
ON CONFLICT ("position") DO NOTHING;

-- =========================================
-- staff
-- =========================================
INSERT INTO public.staff (
    fullname, "position", department, area, salary, ecola, postage, transportation,
    additional_target, repairing, additional_monitoring, motorcycle, other_deduction,
    payroll_date, branch_id, hdmf_er, sss_er, ph_er, total_er, hdmf_ee, sss_ee, ph_ee,
    total_ee, tax, utility_charge, cbu, cashbond, salary_advance, special_advance,
    cash_advance, other_receivable, pagibig_mpl, sss_loan, staff_accounts_payable,
    total_deduction, net_pay, regularization_date, motorcycle_loan, employee_no,
    photo_url, status, start_date, first_name, last_name, middle_name, address,
    municipality, province, contact, email, date_of_birth, place_of_birth, gender,
    civil_status, citizenship, height, weight, religion, blood_type, region, division,
    salary_total, personal_deductions_total, transport_allowances_total,
    spouse_fullname, spouse_address, spouse_occupation, spouse_employer,
    father_fullname, father_address, father_occupation, father_employer, father_contact,
    mother_fullname, mother_address, mother_occupation, mother_employer, mother_contact,
    guardian_fullname, guardian_address, guardian_occupation, guardian_employer, guardian_contact,
    sss_no, philhealth_no, tin_no, children, education, employment_history, beneficiaries,
    pagibig_no, exit_type, exit_date, exit_remarks
)
VALUES
(
    'Juan Dela Cruz', 'Branch Manager', 'Operations', 'Area 1', 25000, 2000, 500, 1500,
    200, 150, 100, 0, 0,
    '2026-03-15', 1, 100, 500, 300, 900, 100, 500, 300,
    900, 1200, 200, 500, 300, 0, 0,
    0, 0, 0, 0, 0,
    2000, 23000, '2025-12-01', 0, 'EMP-0001',
    NULL, 'Active', '2025-06-01', 'Juan', 'Dela Cruz', 'Santos', 'Baras, Rizal',
    'Baras', 'Rizal', '09171234567', 'juan@example.com', '1995-05-10', 'Baras, Rizal', 'Male',
    'Married', 'Filipino', 170.00, 65.00, 'Catholic', 'O+', 'Region IV-A', 'Division A',
    27000, 1000, 1500,
    'Maria Dela Cruz', 'Baras, Rizal', 'Teacher', 'DepEd',
    'Pedro Dela Cruz', 'Baras, Rizal', 'Farmer', 'Self-employed', '09170000001',
    'Ana Dela Cruz', 'Baras, Rizal', 'Vendor', 'Self-employed', '09170000002',
    NULL, NULL, NULL, NULL, NULL,
    'SSS-0001', 'PH-0001', 'TIN-0001', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'PAGIBIG-0001', NULL, NULL, NULL
),
(
    'Maria Santos', 'Cashier', 'Accounting', 'Area 1', 14000, 1200, 500, 1000,
    200, 150, 100, 0, 0,
    '2026-03-15', 2, 100, 400, 250, 750, 100, 400, 250,
    750, 500, 150, 300, 200, 500, 0,
    0, 0, 0, 0, 0,
    1650, 13550, '2025-11-01', 0, 'EMP-0002',
    NULL, 'Active', '2025-05-15', 'Maria', 'Santos', 'Lopez', 'Tanay, Rizal',
    'Tanay', 'Rizal', '09171234568', 'maria@example.com', '1997-03-15', 'Tanay, Rizal', 'Female',
    'Single', 'Filipino', 158.00, 52.00, 'Catholic', 'A+', 'Region IV-A', 'Division A',
    15200, 1150, 1000,
    NULL, NULL, NULL, NULL,
    'Jose Santos', 'Tanay, Rizal', 'Driver', 'Private', '09170000003',
    'Lina Santos', 'Tanay, Rizal', 'Housewife', 'N/A', '09170000004',
    NULL, NULL, NULL, NULL, NULL,
    'SSS-0002', 'PH-0002', 'TIN-0002', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'PAGIBIG-0002', NULL, NULL, NULL
)
ON CONFLICT (employee_no) DO NOTHING;

-- =========================================
-- staff_balances
-- =========================================
INSERT INTO public.staff_balances (
    fullname, cbu, cashbond, salary_advance, motorcycle_loan, special_advance,
    cash_advance, other_receivable, staff_accounts_payable, created_at, updated_at,
    "position", last_name, first_name, middle_name, utility, employee_no, pag_ibig_loan
)
VALUES
    ('Juan Dela Cruz', 500.00, 300.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, now(), now(), 'Branch Manager', 'Dela Cruz', 'Juan', 'Santos', 200.00, 'EMP-0001', '0'),
    ('Maria Santos', 300.00, 200.00, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, now(), now(), 'Cashier', 'Santos', 'Maria', 'Lopez', 150.00, 'EMP-0002', '0')
ON CONFLICT (employee_no) DO NOTHING;

-- =========================================
-- staff_accounts_payable
-- =========================================
INSERT INTO public.staff_accounts_payable (
    employee_id, staff_name, description, amount, term, per_month, balance, status,
    created_at, created_by, entry_date, employee_no
)
VALUES
    (2, 'Maria Santos', 'Office cash shortage payable', 3000, 6, 500, 3000, 'Pending', now(), 1, CURRENT_DATE, 'EMP-0002');

-- =========================================
-- bonus_runs
-- =========================================
INSERT INTO public.bonus_runs (branch_id, bonus_month, notes, created_at, updated_at)
VALUES
    (1, '2026-12-01', 'Year-end bonus for Baras Main Branch', now(), now()),
    (2, '2026-12-01', 'Year-end bonus for Tanay Branch', now(), now());

-- =========================================
-- bonus_lines
-- =========================================
INSERT INTO public.bonus_lines (
    bonus_run_id, employee_id, salary, month_13, month_14, month_15,
    created_at, updated_at, percentage, result, is_released, release_date
)
VALUES
    (1, 1, 25000.00, 25000.00, 10000.00, 5000.00, now(), now(), 100.00, 40000.00, false, NULL),
    (2, 2, 14000.00, 14000.00, 5000.00, 3000.00, now(), now(), 100.00, 22000.00, false, NULL)
ON CONFLICT (bonus_run_id, employee_id) DO NOTHING;

-- =========================================
-- leave_requests
-- =========================================
INSERT INTO public.leave_requests (
    staff_name, leave_type, start_date, end_date, status,
    transaction_code, entry_date, employee_id, last_name, first_name, middle_name
)
VALUES
    ('Juan Dela Cruz', 'Vacation Leave', '2026-04-01', '2026-04-03', 'Pending', 'LV0001', CURRENT_DATE, 1, 'Dela Cruz', 'Juan', 'Santos'),
    ('Maria Santos', 'Sick Leave', '2026-04-05', '2026-04-06', 'Pending', 'LV0002', CURRENT_DATE, 2, 'Santos', 'Maria', 'Lopez');

-- =========================================
-- loan_requests
-- =========================================
INSERT INTO public.loan_requests (
    amount, reason, status, loan_type, term, per_month, interest, total,
    approved_at, disbursement_date, transaction_code, staff_id, employee_no
)
VALUES
    (10000.00, 'Emergency expenses', 'Pending', 'Salary Loan', 10, 1000, 500, 10500, NULL, NULL, 'LR-20260317-000001', 1, 'EMP-0001'),
    (5000.00, 'Medical assistance', 'Pending', 'Cash Advance', 5, 1000, 250, 5250, NULL, NULL, 'LR-20260317-000002', 2, 'EMP-0002');

-- =========================================
-- deployment_orders
-- =========================================
INSERT INTO public.deployment_orders (
    employee_id, employee_name, branch_id, branch_code, branch_name,
    deployment_date, status, created_by, created_at, updated_at,
    last_name, first_name, middle_name, details
)
VALUES
    (1, 'Juan Dela Cruz', 1, 'BR001', 'Baras Main Branch', '2026-03-20', 'Pending', 1, now(), now(), 'Dela Cruz', 'Juan', 'Santos', 'Initial deployment'),
    (2, 'Maria Santos', 2, 'BR002', 'Tanay Branch', '2026-03-20', 'Pending', 1, now(), now(), 'Santos', 'Maria', 'Lopez', 'Initial deployment');

-- =========================================
-- promotion_orders
-- =========================================
INSERT INTO public.promotion_orders (
    order_no, employee_id, employee_name, old_position, new_position, effective_date,
    details, status, created_by, created_at, old_ecola, new_ecola, last_name, first_name, middle_name
)
VALUES
    ('PRO-2026-0001', 1, 'Juan Dela Cruz', 'Supervisor', 'Branch Manager', '2026-04-01',
     'Promotion due to performance', 'Pending', 1, now(), 1500, 2000, 'Dela Cruz', 'Juan', 'Santos')
ON CONFLICT (order_no) DO NOTHING;

-- =========================================
-- demotion_orders
-- =========================================
INSERT INTO public.demotion_orders (
    order_no, employee_id, employee_name, old_position, new_position, effective_date,
    details, status, created_by, created_at, last_name, first_name, middle_name,
    prev_branch_id, prev_branch_code, prev_branch_name, to_branch_id, to_branch_code, to_branch_name
)
VALUES
    ('DEM-2026-0001', 2, 'Maria Santos', 'Senior Cashier', 'Cashier', '2026-05-01',
     'Performance review adjustment', 'Pending', 1, now(), 'Santos', 'Maria', 'Lopez',
     2, 'BR002', 'Tanay Branch', 2, 'BR002', 'Tanay Branch')
ON CONFLICT (order_no) DO NOTHING;

-- =========================================
-- suspension_orders
-- =========================================
INSERT INTO public.suspension_orders (
    order_no, employee_id, employee_name, reason, start_date, end_date,
    details, status, created_by, created_at, last_name, first_name, middle_name
)
VALUES
    ('SUS-2026-0001', 2, 'Maria Santos', 'Violation of attendance policy', '2026-04-10', '2026-04-12',
     '3-day suspension', 'Pending', 1, now(), 'Santos', 'Maria', 'Lopez')
ON CONFLICT (order_no) DO NOTHING;

-- =========================================
-- transfer_staff_orders
-- =========================================
INSERT INTO public.transfer_staff_orders (
    order_no, employee_id, employee_name, prev_branch_id, prev_branch_code, prev_branch_name,
    to_branch_id, to_branch_code, to_branch_name, area, division, date_created, effective_date,
    details, status, created_by, created_at, last_name, first_name, middle_name, region
)
VALUES
    ('TRF-2026-0001', 2, 'Maria Santos', 2, 'BR002', 'Tanay Branch',
     1, 'BR001', 'Baras Main Branch', 'Area 1', 'Division A', CURRENT_DATE, '2026-04-15',
     'Transfer for manpower balancing', 'Pending', 1, now(), 'Santos', 'Maria', 'Lopez', 'Region IV-A')
ON CONFLICT (order_no) DO NOTHING;

-- =========================================
-- transportation_overrides
-- =========================================
INSERT INTO public.transportation_overrides (
    branch_id, staff_id, postage, transportation, additional_target,
    repairing, additional_monitoring, motorcycle_loan, other_deduction,
    until_date, created_at
)
VALUES
    (1, 1, 500, 1800, 250, 150, 100, 0, 0, '2026-12-31', now()),
    (2, 2, 500, 1200, 200, 150, 100, 0, 0, '2026-12-31', now())
ON CONFLICT (branch_id, staff_id) DO NOTHING;

-- =========================================
-- settlements
-- =========================================
INSERT INTO public.settlements (
    staff_id, employee_id, employee_name, prev_branch, cbu, cashbond, utility,
    thirteenth_month_pay, last_pay, separation_pay, cash_assistance, liabilities,
    total_benefits, net_settlement, created_by, created_at, last_name, first_name, middle_name
)
VALUES
    (1, 1, 'Juan Dela Cruz', 'Baras Main Branch', 500, 300, 200, 25000, 12000, 0, 0, 0, 38000, 38000, 1, now(), 'Dela Cruz', 'Juan', 'Santos')
ON CONFLICT DO NOTHING;

COMMIT;