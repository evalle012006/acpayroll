const cron = require("node-cron");
const pool = require("../db");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const getMonthLabel = () => {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(now);
};

async function createMonthlySnapshot(client, monthLabel) {  
  const snapshotMonth = `${monthLabel}-01`;

  console.log(`[monthlyBalancePoster] creating snapshot ${monthLabel}`);

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
        CONCAT_WS(' ', s.last_name, s.first_name, s.middle_name)
      ) AS fullname,
      COALESCE(s.position, ''),
      s.branch_id,
      s.last_name,
      s.first_name,
      s.middle_name,
      COALESCE(sb.cbu, 0),
      COALESCE(sb.cashbond, 0),
      COALESCE(sb.utility, 0),
      0,
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
    WHERE LOWER(COALESCE(s.status, 'active')) = 'active'
      AND s.employee_no IS NOT NULL
      AND TRIM(s.employee_no) <> ''

    ON CONFLICT (snapshot_month, staff_id)
    DO NOTHING
    `,
    [snapshotMonth]
  );
}

async function postMonthlyBalances(monthLabel = getMonthLabel()) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const staffRes = await client.query(`
      SELECT
        id,
        employee_no,
        COALESCE(
          NULLIF(TRIM(fullname), ''),
          CONCAT_WS(' ', last_name, first_name, middle_name),
          employee_no
        ) AS fullname,
        COALESCE(cbu, 0) AS cbu,
        COALESCE(cashbond, 0) AS cashbond,
        COALESCE(utility_charge, 0) AS utility
      FROM public.staff
      WHERE LOWER(COALESCE(status, 'active')) = 'active'
        AND employee_no IS NOT NULL
        AND TRIM(employee_no) <> ''
    `);

    let posted = 0;
    let skipped = 0;

    for (const s of staffRes.rows) {
      const cbu = toNum(s.cbu);
      const cashbond = toNum(s.cashbond);
      const utility = toNum(s.utility);

      const log = await client.query(
        `
        INSERT INTO public.monthly_balance_postings
        (
          month_label,
          employee_no,
          cbu,
          cashbond,
          utility
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (month_label, employee_no)
        DO NOTHING
        RETURNING id
        `,
        [monthLabel, s.employee_no, cbu, cashbond, utility]
      );

      if (log.rowCount === 0) {
        skipped++;
        continue;
      }

      if (cbu > 0 || cashbond > 0 || utility > 0) {
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
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (employee_no)
          DO UPDATE SET
            fullname = COALESCE(EXCLUDED.fullname, public.staff_balances.fullname),
            cbu = COALESCE(public.staff_balances.cbu, 0) + EXCLUDED.cbu,
            cashbond = COALESCE(public.staff_balances.cashbond, 0) + EXCLUDED.cashbond,
            utility = COALESCE(public.staff_balances.utility, 0) + EXCLUDED.utility,
            updated_at = NOW()
          `,
          [s.employee_no, s.fullname || s.employee_no, cbu, cashbond, utility]
        );
      }

      const sapRows = await client.query(
        `
        SELECT
          id,
          COALESCE(payable_id, id) AS payable_id,
          employee_no,
          balance,
          per_month
        FROM public.staff_accounts_payable
        WHERE LOWER(COALESCE(status, '')) = 'approved'
          AND COALESCE(balance, 0) > 0
          AND employee_no = $1
        `,
        [s.employee_no]
      );

      for (const sap of sapRows.rows) {
        const previousBalance = toNum(sap.balance);
        const deduction = toNum(sap.per_month);

        if (deduction <= 0) continue;

        const actualDeduction = Math.min(previousBalance, deduction);
        const newBalance = Math.max(previousBalance - deduction, 0);

        await client.query(
          `
          UPDATE public.staff_accounts_payable
          SET
            balance = $1,
            payable_id = COALESCE(payable_id, id),
            updated_at = NOW()
          WHERE id = $2
          `,
          [newBalance, sap.id]
        );

        await client.query(
          `
          UPDATE public.staff_balances
          SET
            staff_accounts_payable =
              GREATEST(COALESCE(staff_accounts_payable, 0) - $1::numeric, 0),
            updated_at = NOW()
          WHERE employee_no = $2
          `,
          [actualDeduction, sap.employee_no]
        );

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
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `,
          [
            sap.payable_id,
            sap.employee_no,
            monthLabel,
            actualDeduction,
            previousBalance,
            newBalance,
          ]
        );
      }

      const openingRows = await client.query(
        `
        SELECT
          id,
          staff_id,
          employee_no,
          remaining_balance,
          per_month
        FROM public.staff_loan_opening_balances
        WHERE LOWER(COALESCE(status, '')) = 'active'
          AND COALESCE(remaining_balance, 0) > 0
          AND employee_no = $1
          AND (
            start_date IS NULL
            OR start_date <= ($2 || '-01')::date
          )
        `,
        [s.employee_no, monthLabel]
      );

      for (const loan of openingRows.rows) {
        const previousBalance = toNum(loan.remaining_balance);
        const deduction = toNum(loan.per_month);

        if (deduction <= 0) continue;

        const newBalance = Math.max(previousBalance - deduction, 0);
        const newStatus = newBalance <= 0 ? "Paid" : "Active";

        await client.query(
          `
          UPDATE public.staff_loan_opening_balances
          SET
            remaining_balance = $1,
            months_paid = COALESCE(months_paid, 0) + 1,
            status = $2,
            updated_at = NOW()
          WHERE id = $3
          `,
          [newBalance, newStatus, loan.id]
        );
      }

      posted++;
    }

    await createMonthlySnapshot(client, monthLabel);

    await client.query("COMMIT");

    console.log(
      `[monthlyBalancePoster] ${monthLabel}: posted=${posted}, skipped=${skipped}`
    );

    return {
      monthLabel,
      posted,
      skipped,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[monthlyBalancePoster] ERROR:", err);
    throw err;
  } finally {
    client.release();
  }
}

function startMonthlyBalancePoster() {
  cron.schedule(
    "5 0 25 * *",
    async () => {
      try {
        await postMonthlyBalances();
      } catch (err) {
        console.error("[monthlyBalancePoster] scheduled run failed:", err);
      }
    },
    {
      timezone: "Asia/Manila",
    }
  );

  console.log(
    "[monthlyBalancePoster] scheduled every 25th day of month 12:05 AM"
  );
}

module.exports = {
  startMonthlyBalancePoster,
  postMonthlyBalances,
};