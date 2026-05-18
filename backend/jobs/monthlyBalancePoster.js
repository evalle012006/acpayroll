const cron = require("node-cron");
const pool = require("../db");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const getMonthLabel = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
};

async function createMonthlySnapshot(client, monthLabel) {
  console.log(`[monthlyBalancePoster] creating snapshot ${monthLabel}`);

  await client.query(
    `
    INSERT INTO public.schedule_balance_snapshots
    (
      month_label,
      branch_id,
      branch_code,
      branch_name,
      area,
      region,
      division,
      employee_no,
      employee_name,
      position,
      cbu,
      cashbond,
      utility,
      salary_advance,
      motorcycle_loan,
      special_advance,
      cash_advance,
      other_receivable,
      staff_accounts_payable,
      created_at
    )
    SELECT
      $1,
      s.branch_id,
      COALESCE(b.branch_code, ''),
      COALESCE(b.branch_name, s.branch, ''),
      COALESCE(s.area, ''),
      COALESCE(s.region, ''),
      COALESCE(s.division, ''),
      s.employee_no,
      CONCAT_WS(
        ' ',
        s.last_name || ',',
        s.first_name,
        s.middle_name
      ),
      COALESCE(s.position, ''),

      COALESCE(sb.cbu, 0),
      COALESCE(sb.cashbond, 0),
      COALESCE(sb.utility, 0),

      COALESCE(sb.salary_advance, 0),
      COALESCE(sb.motorcycle_loan, 0),
      COALESCE(sb.special_advance, 0),
      COALESCE(sb.cash_advance, 0),
      COALESCE(sb.other_receivable, 0),
      COALESCE(sb.staff_accounts_payable, 0),

      NOW()

    FROM public.staff s

    LEFT JOIN public.staff_balances sb
      ON sb.employee_no = s.employee_no

    LEFT JOIN public.branches b
      ON b.id = s.branch_id

    WHERE LOWER(COALESCE(s.status, 'active')) = 'active'

    ON CONFLICT DO NOTHING
    `,
    [monthLabel]
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
        COALESCE(cbu, 0) AS cbu,
        COALESCE(cashbond, 0) AS cashbond,
        COALESCE(utility, utility_charge, 0) AS utility
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

      if (cbu === 0 && cashbond === 0 && utility === 0) {
        skipped++;
        continue;
      }

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
        VALUES ($1,$2,$3,$4,$5)
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

      await client.query(
        `
        INSERT INTO public.staff_balances
        (
          employee_no,
          cbu,
          cashbond,
          utility,
          updated_at
        )
        VALUES ($1,$2,$3,$4,NOW())

        ON CONFLICT (employee_no)
        DO UPDATE SET
          cbu =
            COALESCE(public.staff_balances.cbu, 0)
            + EXCLUDED.cbu,

          cashbond =
            COALESCE(public.staff_balances.cashbond, 0)
            + EXCLUDED.cashbond,

          utility =
            COALESCE(public.staff_balances.utility, 0)
            + EXCLUDED.utility,

          updated_at = NOW()
        `,
        [s.employee_no, cbu, cashbond, utility]
      );

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
    "5 0 1 * *",
    async () => {
      await postMonthlyBalances();
    },
    {
      timezone: "Asia/Manila",
    }
  );

  console.log(
    "[monthlyBalancePoster] scheduled every 1st day of month 12:05 AM"
  );
}

module.exports = {
  startMonthlyBalancePoster,
  postMonthlyBalances,
};