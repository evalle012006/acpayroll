-- ============================================================
--  HRIS & Payroll Management System
--  Database Initialization Script
--  Database: payroll
-- ============================================================

-- Create the database (run this as superuser if needed)
-- CREATE DATABASE payroll;
-- \c payroll;

-- ============================================================
--  BRANCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branches (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    area        VARCHAR(150)
);

-- ============================================================
--  DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,  -- bcrypt hash
    role        VARCHAR(50)  NOT NULL DEFAULT 'branch manager',
    branch_id   INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
    id                          SERIAL PRIMARY KEY,
    employee_no                 VARCHAR(50),
    fullname                    VARCHAR(255),
    last_name                   VARCHAR(100),
    first_name                  VARCHAR(100),
    middle_name                 VARCHAR(100),
    position                    VARCHAR(150),
    department                  VARCHAR(150),
    area                        VARCHAR(150),
    branch_id                   INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    status                      VARCHAR(50)  DEFAULT 'active',
    start_date                  DATE,
    regularization_date         DATE,

    -- Contact & Personal Info
    address                     TEXT,
    municipality                VARCHAR(150),
    province                    VARCHAR(150),
    region                      VARCHAR(150),
    division                    VARCHAR(150),
    contact                     VARCHAR(50),
    email                       VARCHAR(150),
    date_of_birth               DATE,
    place_of_birth              VARCHAR(255),
    gender                      VARCHAR(20),
    civil_status                VARCHAR(50),
    citizenship                 VARCHAR(100),
    height                      VARCHAR(20),
    weight                      VARCHAR(20),
    religion                    VARCHAR(100),
    blood_type                  VARCHAR(10),
    children                    TEXT,
    education                   TEXT,
    employment_history          TEXT,
    beneficiaries               TEXT,

    -- Government IDs
    sss_no                      VARCHAR(50),
    philhealth_no               VARCHAR(50),
    tin_no                      VARCHAR(50),
    pagibig_no                  VARCHAR(50),

    -- Family Background
    spouse_fullname             VARCHAR(255),
    spouse_address              TEXT,
    spouse_occupation           VARCHAR(150),
    spouse_employer             VARCHAR(150),
    father_fullname             VARCHAR(255),
    father_address              TEXT,
    father_occupation           VARCHAR(150),
    father_employer             VARCHAR(150),
    father_contact              VARCHAR(50),
    mother_fullname             VARCHAR(255),
    mother_address              TEXT,
    mother_occupation           VARCHAR(150),
    mother_employer             VARCHAR(150),
    mother_contact              VARCHAR(50),
    guardian_fullname           VARCHAR(255),
    guardian_address            TEXT,
    guardian_occupation         VARCHAR(150),
    guardian_employer           VARCHAR(150),
    guardian_contact            VARCHAR(50),

    -- Compensation
    salary                      NUMERIC(12,2) DEFAULT 0,
    ecola                       NUMERIC(12,2) DEFAULT 0,
    salary_total                NUMERIC(12,2) DEFAULT 0,

    -- Transportation & Allowances
    transportation              NUMERIC(12,2) DEFAULT 0,
    postage                     NUMERIC(12,2) DEFAULT 0,
    repairing                   NUMERIC(12,2) DEFAULT 0,
    additional_target           NUMERIC(12,2) DEFAULT 0,
    additional_monitoring       NUMERIC(12,2) DEFAULT 0,
    motorcycle                  NUMERIC(12,2) DEFAULT 0,
    transport_allowances_total  NUMERIC(12,2) DEFAULT 0,

    -- Deductions / Remittances
    sss_ee                      NUMERIC(12,2) DEFAULT 0,
    ph_ee                       NUMERIC(12,2) DEFAULT 0,
    hdmf_ee                     NUMERIC(12,2) DEFAULT 0,
    total_ee                    NUMERIC(12,2) DEFAULT 0,
    sss_er                      NUMERIC(12,2) DEFAULT 0,
    ph_er                       NUMERIC(12,2) DEFAULT 0,
    hdmf_er                     NUMERIC(12,2) DEFAULT 0,
    total_er                    NUMERIC(12,2) DEFAULT 0,
    tax                         NUMERIC(12,2) DEFAULT 0,
    utility_charge              NUMERIC(12,2) DEFAULT 0,
    utility                     NUMERIC(12,2) DEFAULT 0,
    cbu                         NUMERIC(12,2) DEFAULT 0,
    cashbond                    NUMERIC(12,2) DEFAULT 0,
    salary_advance              NUMERIC(12,2) DEFAULT 0,
    motorcycle_loan             NUMERIC(12,2) DEFAULT 0,
    special_advance             NUMERIC(12,2) DEFAULT 0,
    cash_advance                NUMERIC(12,2) DEFAULT 0,
    other_receivable            NUMERIC(12,2) DEFAULT 0,
    pagibig_mpl                 NUMERIC(12,2) DEFAULT 0,
    sss_loan                    NUMERIC(12,2) DEFAULT 0,
    staff_accounts_payable      NUMERIC(12,2) DEFAULT 0,
    personal_deductions_total   NUMERIC(12,2) DEFAULT 0,
    total_deduction             NUMERIC(12,2) DEFAULT 0,
    net_pay                     NUMERIC(12,2) DEFAULT 0,
    total                       NUMERIC(12,2) DEFAULT 0,
    other_deduction             NUMERIC(12,2) DEFAULT 0,

    -- Exit Info
    exit_type                   VARCHAR(100),
    exit_date                   DATE,
    exit_remarks                TEXT,

    photo_url                   VARCHAR(255)
);

-- ============================================================
--  STAFF ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_attachments (
    id            SERIAL PRIMARY KEY,
    staff_id      INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    file_name     VARCHAR(255),
    file_url      VARCHAR(255),
    original_name VARCHAR(255),
    uploaded_at   TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  STAFF BALANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_balances (
    id                     SERIAL PRIMARY KEY,
    employee_id            VARCHAR(50),
    fullname               VARCHAR(255),
    last_name              VARCHAR(100),
    first_name             VARCHAR(100),
    middle_name            VARCHAR(100),
    position               VARCHAR(150),
    cbu                    NUMERIC(12,2) DEFAULT 0,
    cashbond               NUMERIC(12,2) DEFAULT 0,
    salary_advance         NUMERIC(12,2) DEFAULT 0,
    motorcycle_loan        NUMERIC(12,2) DEFAULT 0,
    special_advance        NUMERIC(12,2) DEFAULT 0,
    cash_advance           NUMERIC(12,2) DEFAULT 0,
    other_receivable       NUMERIC(12,2) DEFAULT 0,
    staff_accounts_payable NUMERIC(12,2) DEFAULT 0,
    utility                NUMERIC(12,2) DEFAULT 0,
    created_at             TIMESTAMP DEFAULT NOW(),
    updated_at             TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  STAFF ACCOUNTS PAYABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_accounts_payable (
    id               SERIAL PRIMARY KEY,
    payable_id       VARCHAR(100),
    employee_id      VARCHAR(50),
    employee_no      VARCHAR(50),
    staff_name       VARCHAR(255),
    last_name        VARCHAR(100),
    first_name       VARCHAR(100),
    middle_name      VARCHAR(100),
    description      TEXT,
    amount           NUMERIC(12,2) DEFAULT 0,
    term             INTEGER DEFAULT 0,
    per_month        NUMERIC(12,2) DEFAULT 0,
    balance          NUMERIC(12,2) DEFAULT 0,
    status           VARCHAR(50) DEFAULT 'pending',
    entry_date       DATE,
    created_by       VARCHAR(100),
    created_at       TIMESTAMP DEFAULT NOW(),
    approved_by      VARCHAR(100),
    approved_at      TIMESTAMP,
    rejected_by      VARCHAR(100),
    rejected_at      TIMESTAMP,
    rejection_reason TEXT
);

-- ============================================================
--  LEAVE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id               SERIAL PRIMARY KEY,
    transaction_code VARCHAR(100),
    employee_id      VARCHAR(50),
    staff_name       VARCHAR(255),
    last_name        VARCHAR(100),
    first_name       VARCHAR(100),
    middle_name      VARCHAR(100),
    leave_type       VARCHAR(100),
    start_date       DATE,
    end_date         DATE,
    status           VARCHAR(50) DEFAULT 'pending',
    entry_date       DATE DEFAULT CURRENT_DATE
);

-- ============================================================
--  LOAN REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loan_requests (
    id                SERIAL PRIMARY KEY,
    transaction_code  VARCHAR(100),
    staff_id          INTEGER REFERENCES public.staff(id) ON DELETE SET NULL,
    employee_no       VARCHAR(50),
    loan_type         VARCHAR(100),
    amount            NUMERIC(12,2) DEFAULT 0,
    reason            TEXT,
    term              INTEGER DEFAULT 0,
    per_month         NUMERIC(12,2) DEFAULT 0,
    interest          NUMERIC(12,2) DEFAULT 0,
    total             NUMERIC(12,2) DEFAULT 0,
    status            VARCHAR(50) DEFAULT 'pending',
    approved_at       TIMESTAMP,
    disbursement_date DATE
);

-- ============================================================
--  DEPLOYMENT ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deployment_orders (
    id              SERIAL PRIMARY KEY,
    employee_id     VARCHAR(50),
    employee_name   VARCHAR(255),
    last_name       VARCHAR(100),
    first_name      VARCHAR(100),
    middle_name     VARCHAR(100),
    branch_id       INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    branch_code     VARCHAR(50),
    branch_name     VARCHAR(150),
    deployment_date DATE,
    details         TEXT,
    status          VARCHAR(50) DEFAULT 'pending',
    created_by      VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  TRANSFER STAFF ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transfer_staff_orders (
    id                SERIAL PRIMARY KEY,
    order_no          VARCHAR(100),
    employee_id       VARCHAR(50),
    employee_name     VARCHAR(255),
    last_name         VARCHAR(100),
    first_name        VARCHAR(100),
    middle_name       VARCHAR(100),
    prev_branch_id    INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    prev_branch_code  VARCHAR(50),
    prev_branch_name  VARCHAR(150),
    to_branch_id      INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    to_branch_code    VARCHAR(50),
    to_branch_name    VARCHAR(150),
    area              VARCHAR(150),
    division          VARCHAR(150),
    date_created      DATE DEFAULT CURRENT_DATE,
    effective_date    DATE,
    details           TEXT,
    status            VARCHAR(50) DEFAULT 'pending',
    created_by        VARCHAR(100),
    created_at        TIMESTAMP DEFAULT NOW(),
    approved_by       VARCHAR(100),
    approved_at       TIMESTAMP,
    rejected_by       VARCHAR(100),
    rejected_at       TIMESTAMP,
    rejection_reason  TEXT
);

-- ============================================================
--  PROMOTION ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promotion_orders (
    id               SERIAL PRIMARY KEY,
    order_no         VARCHAR(100),
    employee_id      VARCHAR(50),
    employee_name    VARCHAR(255),
    last_name        VARCHAR(100),
    first_name       VARCHAR(100),
    middle_name      VARCHAR(100),
    old_position     VARCHAR(150),
    new_position     VARCHAR(150),
    old_ecola        NUMERIC(12,2) DEFAULT 0,
    new_ecola        NUMERIC(12,2) DEFAULT 0,
    effective_date   DATE,
    details          TEXT,
    status           VARCHAR(50) DEFAULT 'pending',
    created_by       VARCHAR(100),
    created_at       TIMESTAMP DEFAULT NOW(),
    approved_by      VARCHAR(100),
    approve_at       TIMESTAMP,
    rejected_by      VARCHAR(100),
    rejected_at      TIMESTAMP,
    rejection_reason TEXT
);

-- ============================================================
--  DEMOTION ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.demotion_orders (
    id               SERIAL PRIMARY KEY,
    order_no         VARCHAR(100),
    employee_id      VARCHAR(50),
    employee_name    VARCHAR(255),
    last_name        VARCHAR(100),
    first_name       VARCHAR(100),
    middle_name      VARCHAR(100),
    old_position     VARCHAR(150),
    new_position     VARCHAR(150),
    prev_branch_id   INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    prev_branch_code VARCHAR(50),
    prev_branch_name VARCHAR(150),
    to_branch_id     INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    to_branch_code   VARCHAR(50),
    to_branch_name   VARCHAR(150),
    effective_date   DATE,
    details          TEXT,
    status           VARCHAR(50) DEFAULT 'pending',
    created_by       VARCHAR(100),
    created_at       TIMESTAMP DEFAULT NOW(),
    approved_by      VARCHAR(100),
    approved_at      TIMESTAMP,
    rejected_by      VARCHAR(100),
    rejected_at      TIMESTAMP,
    rejection_reason TEXT
);

-- ============================================================
--  SUSPENSION ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suspension_orders (
    id               SERIAL PRIMARY KEY,
    order_no         VARCHAR(100),
    employee_id      VARCHAR(50),
    employee_name    VARCHAR(255),
    last_name        VARCHAR(100),
    first_name       VARCHAR(100),
    middle_name      VARCHAR(100),
    reason           TEXT,
    start_date       DATE,
    end_date         DATE,
    details          TEXT,
    status           VARCHAR(50) DEFAULT 'pending',
    created_by       VARCHAR(100),
    created_at       TIMESTAMP DEFAULT NOW(),
    approved_by      VARCHAR(100),
    approved_at      TIMESTAMP,
    rejected_by      VARCHAR(100),
    rejected_at      TIMESTAMP,
    rejection_reason TEXT
);

-- ============================================================
--  EXIT STAFF ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exit_staff_orders (
    id                     SERIAL PRIMARY KEY,
    order_no               VARCHAR(100),
    employee_id            VARCHAR(50),
    employee_name          VARCHAR(255),
    last_name              VARCHAR(100),
    first_name             VARCHAR(100),
    middle_name            VARCHAR(100),
    branch_id              INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    branch_code            VARCHAR(50),
    branch_name            VARCHAR(150),
    exit_type              VARCHAR(100),
    effective_date         DATE,
    date_created           DATE DEFAULT CURRENT_DATE,
    remarks                TEXT,
    status                 VARCHAR(50) DEFAULT 'pending',
    settlement_date        DATE,
    settlement_branch_id   INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    settlement_branch_code VARCHAR(50),
    settlement_branch_name VARCHAR(150),
    created_by             VARCHAR(100),
    created_at             TIMESTAMP DEFAULT NOW(),
    approved_by            VARCHAR(100),
    approved_at            TIMESTAMP,
    rejected_by            VARCHAR(100),
    rejected_at            TIMESTAMP,
    rejection_reason       TEXT
);

-- ============================================================
--  SETTLEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settlements (
    id                  SERIAL PRIMARY KEY,
    staff_id            INTEGER REFERENCES public.staff(id) ON DELETE SET NULL,
    employee_id         VARCHAR(50),
    employee_name       VARCHAR(255),
    last_name           VARCHAR(100),
    first_name          VARCHAR(100),
    middle_name         VARCHAR(100),
    prev_branch         VARCHAR(150),
    cbu                 NUMERIC(12,2) DEFAULT 0,
    cashbond            NUMERIC(12,2) DEFAULT 0,
    utility             NUMERIC(12,2) DEFAULT 0,
    thirteenth_month_pay NUMERIC(12,2) DEFAULT 0,
    last_pay            NUMERIC(12,2) DEFAULT 0,
    separation_pay      NUMERIC(12,2) DEFAULT 0,
    cash_assistance     NUMERIC(12,2) DEFAULT 0,
    liabilities         NUMERIC(12,2) DEFAULT 0,
    total_benefits      NUMERIC(12,2) DEFAULT 0,
    net_settlement      NUMERIC(12,2) DEFAULT 0,
    created_by          VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  BONUS RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonus_runs (
    id           SERIAL PRIMARY KEY,
    branch_id    INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    bonus_month  VARCHAR(20),
    notes        TEXT,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  BONUS LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonus_lines (
    id           SERIAL PRIMARY KEY,
    bonus_run_id INTEGER NOT NULL REFERENCES public.bonus_runs(id) ON DELETE CASCADE,
    employee_id  VARCHAR(50),
    salary       NUMERIC(12,2) DEFAULT 0,
    month_13     NUMERIC(12,2) DEFAULT 0,
    month_14     NUMERIC(12,2) DEFAULT 0,
    month_15     NUMERIC(12,2) DEFAULT 0,
    percentage   NUMERIC(5,2)  DEFAULT 0,
    result       NUMERIC(12,2) DEFAULT 0,
    is_released  BOOLEAN       DEFAULT FALSE,
    release_date DATE,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  POSITION COMPENSATION RATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.position_comp_rates (
    id          SERIAL PRIMARY KEY,
    position    VARCHAR(150) NOT NULL,
    last_name   VARCHAR(100),
    first_name  VARCHAR(100),
    middle_name VARCHAR(100),
    salary      NUMERIC(12,2) DEFAULT 0,
    ecola       NUMERIC(12,2) DEFAULT 0,
    transportation NUMERIC(12,2) DEFAULT 0,
    cbu         NUMERIC(12,2) DEFAULT 0,
    cashbond    NUMERIC(12,2) DEFAULT 0,
    utility     NUMERIC(12,2) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  TRANSPORTATION OVERRIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transportation_overrides (
    id                    SERIAL PRIMARY KEY,
    branch_id             INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
    staff_id              INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
    postage               NUMERIC(12,2) DEFAULT 0,
    transportation        NUMERIC(12,2) DEFAULT 0,
    additional_target     NUMERIC(12,2) DEFAULT 0,
    repairing             NUMERIC(12,2) DEFAULT 0,
    additional_monitoring NUMERIC(12,2) DEFAULT 0,
    motorcycle_loan       NUMERIC(12,2) DEFAULT 0,
    other_deduction       NUMERIC(12,2) DEFAULT 0,
    until_date            DATE,
    created_at            TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SCHEDULE BALANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedule_balance_snapshots (
    id                     SERIAL PRIMARY KEY,
    snapshot_month         VARCHAR(20),
    staff_id               INTEGER REFERENCES public.staff(id) ON DELETE SET NULL,
    employee_id            VARCHAR(50),
    fullname               VARCHAR(255),
    last_name              VARCHAR(100),
    first_name             VARCHAR(100),
    middle_name            VARCHAR(100),
    position               VARCHAR(150),
    branch_id              INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    cbu                    NUMERIC(12,2) DEFAULT 0,
    cashbond               NUMERIC(12,2) DEFAULT 0,
    salary_advance         NUMERIC(12,2) DEFAULT 0,
    motorcycle_loan        NUMERIC(12,2) DEFAULT 0,
    special_advance        NUMERIC(12,2) DEFAULT 0,
    cash_advance           NUMERIC(12,2) DEFAULT 0,
    other_receivable       NUMERIC(12,2) DEFAULT 0,
    staff_accounts_payable NUMERIC(12,2) DEFAULT 0,
    salary_loan            NUMERIC(12,2) DEFAULT 0,
    utility                NUMERIC(12,2) DEFAULT 0,
    created_at             TIMESTAMP DEFAULT NOW(),
    updated_at             TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  ORDER SEQUENCES  (auto-numbering for order_no fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_sequences (
    prefix     VARCHAR(20) NOT NULL,
    year       INTEGER     NOT NULL,
    month      INTEGER     NOT NULL,
    next_value INTEGER     NOT NULL DEFAULT 1,
    PRIMARY KEY (prefix, year, month)
);

-- ============================================================
--  SEED: Default Admin User
--  Password: Admin@1234  (bcrypt hash below)
--  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN
-- ============================================================
INSERT INTO public.users (username, password, role)
VALUES (
    'admin',
    '$2b$10$E1pI.PXkBMKJyYzu7TpKdu/qYzlFaJvKJsaqmIXOpuudQHX3A9oYa',   -- Default password: Admin@1234  ⚠️ Change after first login
    'admin'
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================
--  DONE
-- ============================================================
-- Run this script with:
--   psql -U postgres -d payroll -f init_db.sql
-- ============================================================