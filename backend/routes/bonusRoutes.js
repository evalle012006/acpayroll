const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
  requireAuth,
} = require("../middlewares/authMiddleware");

const {
  requirePermission,
} = require("../middlewares/permissionMiddleware");

/* ================= HELPERS ================= */

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n
    : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.trunc(n)
    : null;
};

const normalizeDate = (v) => {
  const s = String(v ?? "")
    .slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s
    : null;
};

const normalizeBonusMonth = (v) => {
  const s = normalizeDate(v);

  if (!s) return null;

  const [y, m] = s.split("-");

  return `${y}-${m}-01`;
};

/* ================= GET BRANCH BONUS ================= */

router.get(
  "/branch/:branchId",
  requireAuth,
  requirePermission(
    "bonus",
    "view"
  ),
  async (req, res) => {
    try {
      const branchId = toInt(
        req.params.branchId
      );

      const bonusMonth =
        normalizeBonusMonth(
          req.query
            ?.bonus_month
        );

      const bonusType =
        String(
          req.query?.bonus_type ?? ""
        ).trim();

      const allowedBonusTypes = new Set([
        "13th Month",
        "14th Month",
        "15th Month",
      ]);

      if (
        bonusType &&
        !allowedBonusTypes.has(bonusType)
      ) {
        return res.status(400).json({
          message:
            "bonus_type must be 13th Month, 14th Month, or 15th Month.",
        });
      }

      if (!branchId) {
        return res.status(400).json({
          message:
            "Invalid branchId.",
        });
      }

      const params = [
        branchId,
      ];

      const whereParts = [];

      if (bonusMonth) {
        params.push(bonusMonth);

        whereParts.push(
          `br.bonus_month = $${params.length}::date`
        );
      }

      if (bonusType) {
        params.push(bonusType);

        whereParts.push(
          `br.bonus_type = $${params.length}`
        );
      }

      const whereExtra =
        whereParts.length > 0
          ? `AND ${whereParts.join("\nAND ")}`
          : "";

      const result =
        await pool.query(
          `
          SELECT
            bl.id,
            bl.bonus_run_id,
            bl.employee_id,
            bl.salary,
            bl.month_13,
            bl.month_14,
            bl.month_15,
            bl.percentage,
            bl.result,
            bl.is_released,
            bl.release_date,
            bl.created_at,
            bl.updated_at,

            br.branch_id,
            br.bonus_month,
            br.bonus_type,

            s.employee_no,
            s.fullname,
            s.position

          FROM public.bonus_lines bl

          INNER JOIN public.bonus_runs br
            ON br.id = bl.bonus_run_id

          LEFT JOIN public.staff s
            ON s.id = bl.employee_id

          WHERE br.branch_id = $1

          ${whereExtra}

          ORDER BY
            br.bonus_month DESC,
            bl.updated_at DESC,
            bl.id DESC
          `,
          params
        );

      return res.json(
        result.rows
      );
    } catch (err) {
      console.error(
        "GET /bonus/branch ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to load branch bonus lines.",
      });
    }
  }
);

/* ================= CREATE / GET RUN ================= */

router.post(
  "/run",
  requireAuth,
  requirePermission(
    "bonus",
    "create"
  ),
  async (req, res) => {
    const branch_id = toInt(
      req.body?.branch_id
    );

    const bonus_month =
      normalizeBonusMonth(
        req.body
          ?.bonus_month
      );

    const bonus_type =
      String(
        req.body?.bonus_type ??
        "13th Month"
      ).trim();

    const notes =
      req.body?.notes ??
      null;

    const allowedBonusTypes = new Set([
      "13th Month",
      "14th Month",
      "15th Month",
    ]);

    if (
      !branch_id ||
      !bonus_month
    ) {
      return res.status(400).json({
        message:
          "branch_id and bonus_month are required.",
      });
    }

    if (!allowedBonusTypes.has(bonus_type)) {
      return res.status(400).json({
        message:
          "bonus_type must be 13th Month, 14th Month, or 15th Month.",
      });
    }

    const bonusMonthNumber =
      Number(
        String(bonus_month).slice(5, 7)
      );

    if (
      (
        bonus_type === "13th Month" ||
        bonus_type === "14th Month"
      ) &&
      bonusMonthNumber !== 12
    ) {
      return res.status(400).json({
        message:
          `${bonus_type} Pay can only have a December bonus month.`,
      });
    }

    if (
      bonus_type === "15th Month" &&
      bonusMonthNumber !== 4
    ) {
      return res.status(400).json({
        message:
          "15th Month Pay can only have an April bonus month.",
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const existing =
        await client.query(
          `
            SELECT id
            FROM public.bonus_runs
            WHERE branch_id = $1
              AND bonus_month = $2::date
              AND bonus_type = $3
            LIMIT 1
          `,
          [
            branch_id,
            bonus_month,
            bonus_type,
          ]
        );

      let runId;

      if (
        existing.rowCount >
        0
      ) {
        runId =
          existing.rows[0].id;

        await client.query(
          `
          UPDATE public.bonus_runs
          SET
            notes = COALESCE($2, notes),
            updated_at = NOW()
          WHERE id = $1
          `,
          [
            runId,
            notes,
          ]
        );
      } else {
        const inserted =
          await client.query(
            `
              INSERT INTO public.bonus_runs
              (
                branch_id,
                bonus_month,
                bonus_type,
                notes,
                created_at,
                updated_at
              )
              VALUES
              (
                $1,
                $2::date,
                $3,
                $4,
                NOW(),
                NOW()
              )
              RETURNING id
            `,
            [
              branch_id,
              bonus_month,
              bonus_type,
              notes,
            ]
          );

        runId =
          inserted.rows[0].id;
      }

      await client.query(
        "COMMIT"
      );

      return res.json({
        bonus_run_id:
          runId,
        branch_id,
        bonus_month,
        bonus_type,
      });

    } catch (err) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "POST /bonus/run ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to create bonus run.",
      });
    } finally {
      client.release();
    }
  }
);

/* ================= GET RUN DETAILS ================= */

router.get(
  "/run/:runId",
  requireAuth,
  requirePermission(
    "bonus",
    "view"
  ),
  async (req, res) => {
    try {
      const runId = toInt(
        req.params.runId
      );

      if (!runId) {
        return res.status(400).json({
          message:
            "Invalid runId.",
        });
      }

      const runRes =
        await pool.query(
          `
          SELECT *
          FROM public.bonus_runs
          WHERE id = $1
          `,
          [runId]
        );

      if (
        runRes.rowCount ===
        0
      ) {
        return res.status(404).json({
          message:
            "Bonus run not found.",
        });
      }

      const linesRes =
        await pool.query(
          `
          SELECT
            bl.*,
            s.employee_no,
            s.fullname AS employee_name,
            s.position

          FROM public.bonus_lines bl

          LEFT JOIN public.staff s
            ON s.id = bl.employee_id

          WHERE bl.bonus_run_id = $1

          ORDER BY s.fullname ASC NULLS LAST
          `,
          [runId]
        );

      return res.json({
        run:
          runRes.rows[0],
        lines:
          linesRes.rows,
      });
    } catch (err) {
      console.error(
        "GET /bonus/run/:runId ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to load bonus run.",
      });
    }
  }
);

/* ================= UPSERT BONUS LINES ================= */

router.post(
  "/run/:runId/lines",
  requireAuth,
  requirePermission(
    "bonus",
    "edit"
  ),
  async (req, res) => {
    const runId = toInt(
      req.params.runId
    );

    const lines =
      Array.isArray(
        req.body?.lines
      )
        ? req.body.lines
        : [];

    if (!runId) {
      return res.status(400).json({
        message:
          "Invalid runId.",
      });
    }

    if (
      lines.length === 0
    ) {
      return res.status(400).json({
        message:
          "lines is required.",
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const runCheck =
        await client.query(
          `
            SELECT
              id,
              branch_id,
              bonus_month,
              bonus_type,
              EXTRACT(
                YEAR FROM bonus_month
              )::int AS bonus_year
            FROM public.bonus_runs
            WHERE id = $1
          `,
          [runId]
        );

      if (
        runCheck.rowCount ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Bonus run not found.",
        });
      }

      const run =
        runCheck.rows[0];

      const releaseYear =
        toInt(run.bonus_year);

      const computationYear =
        run.bonus_type === "15th Month"
          ? releaseYear - 1
          : releaseYear;

      if (!computationYear) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Unable to determine bonus computation year.",
        });
      }

      const upserted = [];

      for (const l of lines) {
        const employee_id =
          toInt(
            l.employee_id
          );

        if (!employee_id)
          continue;
        
        const existingLineRes =
          await client.query(
            `
              SELECT
                id,
                is_released
              FROM public.bonus_lines
              WHERE bonus_run_id = $1
                AND employee_id = $2
              LIMIT 1
            `,
            [
              runId,
              employee_id,
            ]
          );

        if (
          existingLineRes.rowCount > 0 &&
          existingLineRes.rows[0].is_released
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            message:
              "This bonus has already been released and can no longer be edited.",
          });
        }

        const computationRes =
          await client.query(
            `
              SELECT
                COALESCE(
                  SUM(total_compensation),
                  0
                )::numeric AS annual_compensation,

                COALESCE(
                  SUM(month_13),
                  0
                )::numeric AS month_13,

                COALESCE(
                  SUM(month_14),
                  0
                )::numeric AS month_14,

                COALESCE(
                  SUM(month_15),
                  0
                )::numeric AS month_15

              FROM public.bonus_computations

              WHERE staff_id = $1
                AND computation_year = $2
            `,
            [
              employee_id,
              computationYear,
            ]
          );

        const computation =
          computationRes.rows[0];

        const annualCompensation =
          toNum(
            computation?.annual_compensation
          );

        const month13 =
          toNum(
            computation?.month_13
          );

        const month14 =
          toNum(
            computation?.month_14
          );

        const month15 =
          toNum(
            computation?.month_15
          );

        const salary =
          annualCompensation / 12;

        let percentage = 100;
        let payableResult = 0;

        if (run.bonus_type === "13th Month") {
          payableResult = month13;
        } else if (
          run.bonus_type === "14th Month"
        ) {
          payableResult = month14;
        } else if (
          run.bonus_type === "15th Month"
        ) {
          percentage =
            toNum(l.percentage);

          if (
            percentage < 0 ||
            percentage > 100
          ) {
            await client.query(
              "ROLLBACK"
            );

            return res.status(400).json({
              message:
                "15th Month evaluation percentage must be from 0 to 100.",
            });
          }

          payableResult =
            month15 *
            (percentage / 100);
        }

        const result =
          await client.query(
            `
            INSERT INTO public.bonus_lines
            (
              bonus_run_id,
              employee_id,
              salary,
              month_13,
              month_14,
              month_15,
              percentage,
              result,
              is_released,
              release_date,
              created_at,
              updated_at
            )
            VALUES
            (
              $1,$2,$3,$4,$5,$6,$7,$8,
              false,NULL,NOW(),NOW()
            )

            ON CONFLICT
              (bonus_run_id, employee_id)

            DO UPDATE SET
              salary = EXCLUDED.salary,
              month_13 = EXCLUDED.month_13,
              month_14 = EXCLUDED.month_14,
              month_15 = EXCLUDED.month_15,
              percentage = EXCLUDED.percentage,
              result = EXCLUDED.result,
              updated_at = NOW()
            WHERE public.bonus_lines.is_released = false

            RETURNING *;
            `,
            [
              runId,
              employee_id,
              salary,
              month13,
              month14,
              month15,
              percentage,
              payableResult,
            ]
          );

        if (result.rowCount === 0) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(409).json({
            message:
              "This bonus has already been released and can no longer be edited.",
          });
        }

        upserted.push(
          result.rows[0]
        );
      }

      await client.query(
        `
        UPDATE public.bonus_runs
        SET updated_at = NOW()
        WHERE id = $1
        `,
        [runId]
      );

      await client.query(
        "COMMIT"
      );

      return res.json({
        message:
          "Bonus saved.",
        lines:
          upserted,
      });
    } catch (err) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "POST /bonus/run/:runId/lines ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to save bonus lines.",
      });
    } finally {
      client.release();
    }
  }
);

/* ================= RELEASE BONUS ================= */

router.put(
  "/line/:lineId/release",
  requireAuth,
  requirePermission(
    "bonus",
    "approve"
  ),
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const lineId =
        toInt(
          req.params.lineId
        );

      const release_date =
        normalizeDate(
          req.body
            ?.release_date
        );

      if (!lineId) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Invalid lineId.",
        });
      }

      if (!release_date) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Valid release_date is required.",
        });
      }

      const existingRes =
        await client.query(
          `
            SELECT
              bl.*,
              br.bonus_month,
              br.bonus_type
            FROM public.bonus_lines bl
            INNER JOIN public.bonus_runs br
              ON br.id = bl.bonus_run_id
            WHERE bl.id = $1
            LIMIT 1
          `,
          [lineId]
        );

      if (existingRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Bonus line not found.",
        });
      }

      const existingLine = existingRes.rows[0];

      if (existingLine.is_released) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This bonus has already been released.",
        });
      }

      const bonusType =
        String(existingLine.bonus_type ?? "").trim();

      const bonusMonth =
        normalizeDate(existingLine.bonus_month);

      const releaseMonth =
        Number(
          String(release_date).slice(5, 7)
        );

      const releaseYear =
        Number(
          String(release_date).slice(0, 4)
        );

      const bonusYear =
        bonusMonth
          ? Number(
              String(bonusMonth).slice(0, 4)
            )
          : null;

      /* ================= 13TH MONTH ================= */

      if (
        bonusType === "13th Month" &&
        releaseMonth !== 12
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "13th Month Pay can only be released in December.",
        });
      }

      if (
        bonusType === "13th Month" &&
        bonusYear &&
        releaseYear !== bonusYear
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "13th Month release date must be in the same year as the bonus run.",
        });
      }

      /* ================= 14TH MONTH ================= */

      if (
        bonusType === "14th Month" &&
        releaseMonth !== 12
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "14th Month Pay can only be released in December.",
        });
      }

      if (
        bonusType === "14th Month" &&
        bonusYear &&
        releaseYear !== bonusYear
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "14th Month release date must be in the same year as the bonus run.",
        });
      }

      /* ================= 15TH MONTH ================= */

      if (
        bonusType === "15th Month" &&
        releaseMonth !== 4
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "15th Month Pay can only be released in April.",
        });
      }

      if (
        bonusType === "15th Month" &&
        bonusYear &&
        releaseYear !== bonusYear
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "15th Month release date must be in the same release year as the bonus run.",
        });
      }

      const result =
        await client.query(
          `
            UPDATE public.bonus_lines
            SET
              is_released = true,
              release_date = $1::date,
              updated_at = NOW()
            WHERE id = $2
              AND is_released = false
            RETURNING *;
          `,
          [
            release_date,
            lineId,
          ]
        );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          message:
            "This bonus has already been released or was updated by another request.",
        });
      }

      const line =
        result.rows[0];

      const detailRes =
        await client.query(
          `
          SELECT
            bl.id,
            bl.employee_id,
            bl.result,
            bl.month_13,
            bl.month_14,
            bl.month_15,
            bl.release_date,

            br.bonus_month,
            br.bonus_type,

            s.employee_no

          FROM public.bonus_lines bl

          INNER JOIN public.bonus_runs br
            ON br.id = bl.bonus_run_id

          LEFT JOIN public.staff s
            ON s.id = bl.employee_id

          WHERE bl.id = $1
          LIMIT 1
          `,
          [lineId]
        );

      if (
        detailRes.rowCount >
        0
      ) {
        const detail =
          detailRes.rows[0];

        if (
          ![
            "13th Month",
            "14th Month",
            "15th Month",
          ].includes(bonusType)
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            message:
              "Invalid bonus type for release.",
          });
        }

        await client.query(
          `
            INSERT INTO public.staff_bonus_history
            (
              staff_id,
              employee_no,
              bonus_type,
              bonus_month,
              amount,
              release_date,
              remarks,
              created_by,
              created_at
            )
            VALUES
            (
              $1,$2,$3,$4::date,
              $5,$6::date,$7,$8,
              NOW()
            )

            ON CONFLICT
              (staff_id, bonus_type, bonus_month)
            WHERE staff_id IS NOT NULL
              AND bonus_type IS NOT NULL
              AND bonus_month IS NOT NULL
            DO NOTHING
          `,
          [
            detail.employee_id,
            detail.employee_no || null,
            bonusType,
            detail.bonus_month || null,
            toNum(
              detail.result
            ),
            detail.release_date ||
              release_date,
            `Released from bonus line #${lineId}`,
            req.user?.id ??
              null,
          ]
        );
      }

      await client.query(
        "COMMIT"
      );

      return res.json(
        line
      );
    } catch (err) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "PUT /bonus/line/:lineId/release ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to release bonus.",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;