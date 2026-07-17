const cron = require("node-cron");
const pool = require("../db");

// =====================================================
// HELPERS
// =====================================================

const toNum = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const toStr = (value) => String(value ?? "").trim();

const getMonthLabel = () => {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(now);
};

const isValidMonthLabel = (value) => {
  return /^\d{4}-\d{2}$/.test(toStr(value));
};

// =====================================================
// CREATE MONTHLY SNAPSHOT
// =====================================================
//
// This runs after:
// 1. Contract CBU/Cashbond/Utility were added.
// 2. Staff Accounts Payable was reduced.
// 3. Opening loan balances were reduced.
//
// Existing snapshots are not overwritten.
// Therefore, manually edited historical records remain unchanged.
// =====================================================

async function createMonthlySnapshot(client, monthLabel) {
  const snapshotMonth = `${monthLabel}-01`;

  console.log(
    `[monthlyBalancePoster] creating snapshot for ${monthLabel}`
  );

  await client.query(
    `
    INSERT INTO public.schedule_balance_snapshots
    (
      snapshot_month,
      staff_id,
      employee_no,
      fullname,
      position,
      branch_id,
      last_name,
      first_name,
      middle_name,

      cbu,
      cashbond,
      utility,

      salary_loan,
      salary_advance,
      motorcycle_loan,
      special_advance,
      cash_advance,
      other_receivable,
      staff_accounts_payable,

      created_at,
      updated_at
    )
    SELECT
      $1::date,
      s.id,
      s.employee_no,

      COALESCE(
        NULLIF(TRIM(s.fullname), ''),
        NULLIF(
          TRIM(
            CONCAT_WS(
              ' ',
              s.last_name,
              s.first_name,
              s.middle_name
            )
          ),
          ''
        ),
        s.employee_no
      ) AS fullname,

      COALESCE(s.position, ''),
      s.branch_id,
      s.last_name,
      s.first_name,
      s.middle_name,

      COALESCE(sb.cbu, 0),
      COALESCE(sb.cashbond, 0),
      COALESCE(sb.utility, 0),

      COALESCE(sb.salary_loan, 0),
      COALESCE(sb.salary_advance, 0),
      COALESCE(sb.motorcycle_loan, 0),
      COALESCE(sb.special_advance, 0),
      COALESCE(sb.cash_advance, 0),
      COALESCE(sb.other_receivable, 0),
      COALESCE(sb.staff_accounts_payable, 0),

      NOW(),
      NOW()

    FROM public.staff s

    LEFT JOIN public.staff_balances sb
      ON sb.employee_no = s.employee_no

    WHERE
      LOWER(
        TRIM(
          COALESCE(s.status, 'active')
        )
      ) = 'active'

      AND NULLIF(
        TRIM(
          COALESCE(s.employee_no, '')
        ),
        ''
      ) IS NOT NULL

    ON CONFLICT (snapshot_month, staff_id)
    DO NOTHING
    `,
    [snapshotMonth]
  );
}

// =====================================================
// ADD MONTHLY CONTRACT BALANCES
// =====================================================

async function addMonthlyContractBalances(
  client,
  staff,
  monthLabel
) {
  const cbu = toNum(staff.cbu);
  const cashbond = toNum(staff.cashbond);
  const utility = toNum(staff.utility);

  // This is the idempotency gate.
  //
  // If this row already exists, this employee was already
  // processed for this month. Nothing will be added again.
  const postingResult = await client.query(
    `
    INSERT INTO public.monthly_balance_postings
    (
      month_label,
      employee_no,
      cbu,
      cashbond,
      utility
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5
    )

    ON CONFLICT (month_label, employee_no)
    DO NOTHING

    RETURNING
      id,
      month_label,
      employee_no,
      cbu,
      cashbond,
      utility
    `,
    [
      monthLabel,
      staff.employee_no,
      cbu,
      cashbond,
      utility,
    ]
  );

  if (!postingResult.rowCount) {
    return {
      newlyPosted: false,
      cbu,
      cashbond,
      utility,
    };
  }

  // Add the contract deduction to the accumulated current balance.
  //
  // Manual current corrections remain the starting balance.
  //
  // Example:
  // Current CBU = 9,500
  // Contract CBU = 500
  // New current CBU = 10,000
  await client.query(
    `
    INSERT INTO public.staff_balances
    (
      employee_no,
      fullname,
      cbu,
      cashbond,
      utility,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      NOW()
    )

    ON CONFLICT (employee_no)
    DO UPDATE SET
      fullname = COALESCE(
        NULLIF(EXCLUDED.fullname, ''),
        public.staff_balances.fullname
      ),

      cbu =
        COALESCE(public.staff_balances.cbu, 0)
        + COALESCE(EXCLUDED.cbu, 0),

      cashbond =
        COALESCE(public.staff_balances.cashbond, 0)
        + COALESCE(EXCLUDED.cashbond, 0),

      utility =
        COALESCE(public.staff_balances.utility, 0)
        + COALESCE(EXCLUDED.utility, 0),

      updated_at = NOW()
    `,
    [
      staff.employee_no,
      staff.fullname || staff.employee_no,
      cbu,
      cashbond,
      utility,
    ]
  );

  return {
    newlyPosted: true,
    cbu,
    cashbond,
    utility,
  };
}

// =====================================================
// DEDUCT STAFF ACCOUNTS PAYABLE
// =====================================================

async function deductStaffAccountsPayable(
  client,
  employeeNo,
  monthLabel
) {
  const result = await client.query(
    `
    SELECT
      id,
      COALESCE(payable_id, id) AS payable_id,
      employee_no,
      balance,
      per_month

    FROM public.staff_accounts_payable

    WHERE
      LOWER(
        TRIM(
          COALESCE(status, '')
        )
      ) = 'approved'

      AND COALESCE(balance, 0) > 0
      AND employee_no = $1

    FOR UPDATE
    `,
    [employeeNo]
  );

  for (const payable of result.rows) {
    const previousBalance = toNum(payable.balance);
    const monthlyDeduction = toNum(payable.per_month);

    if (monthlyDeduction <= 0) {
      continue;
    }

    const actualDeduction = Math.min(
      previousBalance,
      monthlyDeduction
    );

    const newBalance = Math.max(
      previousBalance - actualDeduction,
      0
    );

    await client.query(
      `
      UPDATE public.staff_accounts_payable
      SET
        balance = $1,
        payable_id = COALESCE(payable_id, id),
        updated_at = NOW()
      WHERE id = $2
      `,
      [newBalance, payable.id]
    );

    await client.query(
      `
      UPDATE public.staff_balances
      SET
        staff_accounts_payable = GREATEST(
          COALESCE(staff_accounts_payable, 0)
          - $1::numeric,
          0
        ),
        updated_at = NOW()
      WHERE employee_no = $2
      `,
      [actualDeduction, payable.employee_no]
    );

    // Prevent duplicate history in case this function is
    // manually triggered more than once.
    const existingHistory = await client.query(
      `
      SELECT id
      FROM public.staff_accounts_payable_history
      WHERE payable_id = $1
        AND employee_no = $2
        AND month_label = $3
      LIMIT 1
      `,
      [
        payable.payable_id,
        payable.employee_no,
        monthLabel,
      ]
    );

    if (!existingHistory.rowCount) {
      await client.query(
        `
        INSERT INTO public.staff_accounts_payable_history
        (
          payable_id,
          employee_no,
          month_label,
          deducted_amount,
          previous_balance,
          new_balance,
          created_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          NOW()
        )
        `,
        [
          payable.payable_id,
          payable.employee_no,
          monthLabel,
          actualDeduction,
          previousBalance,
          newBalance,
        ]
      );
    }
  }
}

// =====================================================
// DEDUCT OPENING LOAN BALANCES
// =====================================================

async function deductOpeningLoanBalances(
  client,
  employeeNo,
  monthLabel
) {
  const monthStart = `${monthLabel}-01`;

  const result = await client.query(
    `
    SELECT
      id,
      staff_id,
      employee_no,
      remaining_balance,
      per_month,
      months_paid,
      term_months,
      status

    FROM public.staff_loan_opening_balances

    WHERE
      LOWER(
        TRIM(
          COALESCE(status, '')
        )
      ) = 'active'

      AND COALESCE(remaining_balance, 0) > 0
      AND employee_no = $1

      AND (
        effective_date IS NULL
        OR effective_date <= $2::date
      )

      AND (
        start_date IS NULL
        OR start_date <= $2::date
      )

    FOR UPDATE
    `,
    [employeeNo, monthStart]
  );

  for (const loan of result.rows) {
    const previousBalance = toNum(
      loan.remaining_balance
    );

    const monthlyDeduction = toNum(
      loan.per_month
    );

    if (monthlyDeduction <= 0) {
      continue;
    }

    const actualDeduction = Math.min(
      previousBalance,
      monthlyDeduction
    );

    const newBalance = Math.max(
      previousBalance - actualDeduction,
      0
    );

    const previousMonthsPaid = Math.max(
      0,
      Math.trunc(toNum(loan.months_paid))
    );

    const termMonths = Math.max(
      0,
      Math.trunc(toNum(loan.term_months))
    );

    const newMonthsPaid =
      termMonths > 0
        ? Math.min(previousMonthsPaid + 1, termMonths)
        : previousMonthsPaid + 1;

    const newStatus =
      newBalance <= 0 ? "Paid" : "Active";

    await client.query(
      `
      UPDATE public.staff_loan_opening_balances
      SET
        remaining_balance = $1,
        months_paid = $2,
        status = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [
        newBalance,
        newMonthsPaid,
        newStatus,
        loan.id,
      ]
    );
  }
}

// =====================================================
// MAIN MONTHLY POSTING
// =====================================================

async function postMonthlyBalances(
  monthLabel = getMonthLabel()
) {
  if (!isValidMonthLabel(monthLabel)) {
    throw new Error(
      "monthLabel must use YYYY-MM format"
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Prevent two backend processes from running the same
    // month at the same time.
    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        hashtext($1)
      )
      `,
      [`monthly-balance-poster:${monthLabel}`]
    );

    const staffResult = await client.query(
      `
      SELECT
        id,
        employee_no,

        COALESCE(
          NULLIF(TRIM(fullname), ''),
          NULLIF(
            TRIM(
              CONCAT_WS(
                ' ',
                last_name,
                first_name,
                middle_name
              )
            ),
            ''
          ),
          employee_no
        ) AS fullname,

        COALESCE(cbu, 0) AS cbu,
        COALESCE(cashbond, 0) AS cashbond,
        COALESCE(utility_charge, 0) AS utility

      FROM public.staff

      WHERE
        LOWER(
          TRIM(
            COALESCE(status, 'active')
          )
        ) = 'active'

        AND NULLIF(
          TRIM(
            COALESCE(employee_no, '')
          ),
          ''
        ) IS NOT NULL

      ORDER BY id ASC
      `
    );

    let posted = 0;
    let skipped = 0;

    for (const staff of staffResult.rows) {
      const posting =
        await addMonthlyContractBalances(
          client,
          staff,
          monthLabel
        );

      // This employee was already completely processed
      // for this month.
      if (!posting.newlyPosted) {
        skipped += 1;
        continue;
      }

      // These deductions are executed only after a new
      // monthly posting row was created.
      //
      // Therefore, they cannot run twice for the same month.
      await deductStaffAccountsPayable(
        client,
        staff.employee_no,
        monthLabel
      );

      await deductOpeningLoanBalances(
        client,
        staff.employee_no,
        monthLabel
      );

      posted += 1;
    }

    // Create the permanent historical record only after
    // the current balances and monthly deductions changed.
    await createMonthlySnapshot(
      client,
      monthLabel
    );

    await client.query("COMMIT");

    console.log(
      `[monthlyBalancePoster] ${monthLabel}: posted=${posted}, skipped=${skipped}`
    );

    return {
      monthLabel,
      posted,
      skipped,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "[monthlyBalancePoster] ERROR:",
      error
    );

    throw error;
  } finally {
    client.release();
  }
}

// =====================================================
// START CRON
// =====================================================

function startMonthlyBalancePoster() {
  cron.schedule(
    "5 0 25 * *",
    async () => {
      try {
        await postMonthlyBalances();
      } catch (error) {
        console.error(
          "[monthlyBalancePoster] scheduled run failed:",
          error
        );
      }
    },
    {
      timezone: "Asia/Manila",
    }
  );

  console.log(
    "[monthlyBalancePoster] scheduled every 25th day of the month at 12:05 AM Asia/Manila"
  );
}

module.exports = {
  startMonthlyBalancePoster,
  postMonthlyBalances,
};