BEGIN;

WITH roles(role) AS (
    VALUES
        ('branch manager'),
        ('area manager'),
        ('regional manager'),
        ('assistant vice president'),
        ('vice president'),
        ('senior vice president')
),
departments(department) AS (
    VALUES
        ('HR DEPARTMENT'),
        ('ACCOUNTING DEPARTMENT')
),
actions(action_name) AS (
    VALUES
        ('approve'),
        ('bypass'),
        ('upload_approved')
),
required_permissions AS (
    SELECT
        r.role,
        d.department,
        a.action_name
    FROM roles r
    CROSS JOIN departments d
    CROSS JOIN actions a
)
INSERT INTO public.role_permissions (
    role,
    department,
    module_name,
    action_name,
    allowed
)
SELECT
    rp.role,
    rp.department,
    'demotion_order',
    rp.action_name,
    TRUE
FROM required_permissions rp
WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions existing
    WHERE LOWER(TRIM(existing.role)) =
          LOWER(TRIM(rp.role))
      AND LOWER(TRIM(existing.department)) =
          LOWER(TRIM(rp.department))
      AND LOWER(TRIM(existing.module_name)) =
          'demotion_order'
      AND LOWER(TRIM(existing.action_name)) =
          LOWER(TRIM(rp.action_name))
);

CREATE TABLE IF NOT EXISTS
public.demotion_order_approval_history (
    id BIGSERIAL PRIMARY KEY,

    demotion_order_id INTEGER NOT NULL
        REFERENCES public.demotion_orders(id)
        ON DELETE CASCADE,

    action VARCHAR(100) NOT NULL,

    approval_stage VARCHAR(100),

    performed_by INTEGER,

    performed_by_name VARCHAR(200),

    performed_by_role VARCHAR(100),

    performed_by_department VARCHAR(150),

    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
idx_demotion_order_approval_history_order
ON public.demotion_order_approval_history
(demotion_order_id, created_at, id);

CREATE TABLE IF NOT EXISTS
    public.salary_history_backup_20261016
    AS
    SELECT *
    FROM public.salary_history
    WHERE 1 = 0;

    INSERT INTO public.salary_history_backup_20261016
    SELECT *
    FROM public.salary_history
    WHERE TRIM(employee_no) = '003333'
    AND id NOT IN (
        SELECT id
        FROM public.salary_history_backup_20261016
    );

        UPDATE public.salary_history
        SET
            salary = 18000.00,
            ecola = 2000.00
        WHERE TRIM(employee_no) = '003333'
        AND effective_date >= DATE '2026-01-01'
        AND effective_date < DATE '2027-01-01'
        AND salary = 0
        AND ecola = 1667.00;

        SELECT
            id,
            employee_no,
            effective_date,
            salary,
            ecola
        FROM public.salary_history
        WHERE TRIM(employee_no) = '003333'
        ORDER BY effective_date ASC;
        
COMMIT;