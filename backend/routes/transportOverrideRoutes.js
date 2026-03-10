const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/branch/:branchId", async (req, res) => {
  const { branchId } = req.params;

  try {
    const result = await pool.query(
      `SELECT *
       FROM transportation_overrides
       WHERE branch_id = $1`,
      [branchId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch overrides" });
  }
});

router.post("/", async (req, res) => {
  const {
    branch_id,
    staff_id,
    until,
    values
  } = req.body;

  try {

    await pool.query(
      `
      INSERT INTO transportation_overrides
      (
        branch_id,
        staff_id,
        postage,
        transportation,
        additional_target,
        repairing,
        additional_monitoring,
        motorcycle_loan,
        other_deduction,
        until_date
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)

      ON CONFLICT (branch_id, staff_id)
      DO UPDATE SET
        postage = EXCLUDED.postage,
        transportation = EXCLUDED.transportation,
        additional_target = EXCLUDED.additional_target,
        repairing = EXCLUDED.repairing,
        additional_monitoring = EXCLUDED.additional_monitoring,
        motorcycle_loan = EXCLUDED.motorcycle_loan,
        other_deduction = EXCLUDED.other_deduction,
        until_date = EXCLUDED.until_date
      `,
      [
        branch_id,
        staff_id,
        values.postage,
        values.transportation,
        values.additional_target,
        values.repairing,
        values.additional_monitoring,
        values.motorcycle_loan,
        values.other_deduction,
        until
      ]
    );

    res.json({ message: "Override saved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save override" });
  }
});

router.delete("/branch/:branchId/staff/:staffId", async (req, res) => {

  const { branchId, staffId } = req.params;

  try {

    await pool.query(
      `DELETE FROM transportation_overrides
       WHERE branch_id=$1 AND staff_id=$2`,
      [branchId, staffId]
    );

    res.json({ message: "Override removed" });

  } catch (err) {

    console.error(err);
    res.status(500).json({ message: "Failed to remove override" });

  }

});

module.exports = router;