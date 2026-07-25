const cron = require("node-cron");
const pool = require("../db");

let resignationJob = null;

const processEffectiveResignations = async () => {
  const client = await pool.connect();

  try {
    console.log(
      "[resignationCron] Checking approved effective resignations..."
    );

    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT
        rr.id,
        rr.employee_no,
        rr.effective_date,
        rr.remarks

      FROM public.resignation_requests rr

      INNER JOIN public.staff s
        ON LOWER(TRIM(COALESCE(s.employee_no, ''))) =
           LOWER(TRIM(COALESCE(rr.employee_no, '')))

      WHERE LOWER(
        TRIM(
          COALESCE(rr.status, '')
        )
      ) = 'approved'

        AND rr.effective_date IS NOT NULL

        AND rr.effective_date::date <=
          (NOW() AT TIME ZONE 'Asia/Manila')::date

        AND LOWER(
          TRIM(
            COALESCE(s.status, 'active')
          )
        ) = 'active'

        AND NOT EXISTS (
          SELECT 1
          FROM public.resignation_requests later_rr
          WHERE later_rr.employee_no = rr.employee_no
            AND later_rr.id > rr.id
            AND later_rr.revoke_effective_date IS NOT NULL
        )

      ORDER BY
        rr.effective_date ASC,
        rr.id ASC

      FOR UPDATE OF rr
      `
    );

    for (const row of result.rows) {
      await client.query(
        `
        UPDATE public.staff
        SET
          status = 'Inactive',
          exit_type = 'Resigned',
          exit_date = $2::date,
          exit_remarks = $3
        WHERE LOWER(
          TRIM(
            COALESCE(employee_no, '')
          )
        ) = LOWER(TRIM($1))
        `,
        [
          row.employee_no,
          row.effective_date,
          row.remarks || null,
        ]
      );

      await client.query(
        `
        INSERT INTO public.status_history
        (
          employee_no,
          effective_date,
          status,
          reason,
          remarks
        )
        VALUES
        (
          $1,
          $2::date,
          'Inactive',
          'Resigned',
          $3
        )
        ON CONFLICT DO NOTHING
        `,
        [
          row.employee_no,
          row.effective_date,
          row.remarks || null,
        ]
      );

      console.log(
        `[resignationCron] ${row.employee_no} set to Inactive`
      );
    }

    await client.query("COMMIT");

    console.log(
      `[resignationCron] Processed ${result.rowCount} resignation(s)`
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "[resignationCron] Failed:",
      error
    );
  } finally {
    client.release();
  }
};

const startResignationCron = () => {
  if (resignationJob) {
    console.log(
      "[resignationCron] Job is already running"
    );
    return resignationJob;
  }

  resignationJob = cron.schedule(
    "5 0 * * *",
    processEffectiveResignations,
    {
      scheduled: true,
      timezone: "Asia/Manila",
    }
  );

  console.log(
    "[resignationCron] Scheduled daily at 12:05 AM Asia/Manila"
  );

  /*
    Run once when the backend starts so missed dates
    are processed immediately after a restart/deployment.
  */
  processEffectiveResignations().catch((error) => {
    console.error(
      "[resignationCron] Startup run failed:",
      error
    );
  });

  return resignationJob;
};

module.exports = {
  startResignationCron,
  processEffectiveResignations,
};