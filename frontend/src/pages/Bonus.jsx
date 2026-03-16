import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Bonus.css";
import { BsThreeDotsVertical } from "react-icons/bs";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const fmtMoney = (v) =>
  toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const monthStartFromToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());

const Bonus = () => {
  const params = useParams();
  const branchParam = toStr(params.branchId ?? params.id);
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  const [selectedRow, setSelectedRow] = useState(null);
  const [percentage, setPercentage] = useState("");
  const [releaseDate, setReleaseDate] = useState(todayDate());

  const [saving, setSaving] = useState(false);

  const [bonusMonth, setBonusMonth] = useState(monthStartFromToday());
  const [runId, setRunId] = useState(null);

  const [savedResults, setSavedResults] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [branchesRes, staffRes] = await Promise.all([
          api.get("/branches"),
          api.get("/staff"),
        ]);

        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];

        const found = branches.find((b) => {
          const idMatch = Number.isFinite(Number(branchParam)) && Number(b.id) === Number(branchParam);
          const codeMatch = norm(b.code) === norm(branchParam);
          return idMatch || codeMatch;
        });

        if (!found) {
          setError("Branch not found.");
          return;
        }

        setBranch(found);

        const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];

        const byBranch = allStaff.filter((s) => Number(s.branch_id) === Number(found.id));
        const byBranchCode = allStaff.filter((s) => norm(s.branch_code) === norm(found.code));

        const filtered =
          byBranch.length > 0
            ? byBranch
            : byBranchCode.length > 0
            ? byBranchCode
            : allStaff.filter((s) => norm(s.area) === norm(found.area));

        setStaff(filtered);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load bonus.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [branchParam]);

  useEffect(() => {
    const loadSavedForBranch = async () => {
      try {
        if (!branch?.id) return;

        const res = await api.get(`/bonus/branch/${branch.id}`);
        const lines = Array.isArray(res.data) ? res.data : [];

        const mapped = {};
        let latestRunId = null;

        lines.forEach((line) => {
          const key = String(line.employee_id ?? "");
          if (!key) return;

          mapped[key] = {
            line_id: line.id,
            bonus_run_id: line.bonus_run_id,
            percentage: toNum(line.percentage),
            result: toNum(line.result),
            is_released: !!line.is_released,
            release_date: line.release_date || null,
          };

          if (!latestRunId && line.bonus_run_id) latestRunId = line.bonus_run_id;
        });

        setSavedResults(mapped);
        if (latestRunId) setRunId(latestRunId);
      } catch {
        setSavedResults({});
      }
    };

    loadSavedForBranch();
  }, [branch]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };

    const onEsc = (e) => {
      if (e.key === "Escape") {
        setOpenMenuId(null);
        setShowCalcModal(false);
        setShowReleaseModal(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    const anyOpen = showCalcModal || showReleaseModal;
    if (!anyOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCalcModal, showReleaseModal]);

  const computed = useMemo(() => {
    return staff.map((s) => {
      const salary = toNum(s.salary);
      const month_13 = salary / 12;
      const month_14 = salary / 12;
      const month_15 = salary / 12;

      const saved = savedResults[String(s.id)] || {
        percentage: 0,
        result: 0,
        line_id: null,
        bonus_run_id: null,
        is_released: false,
        release_date: null,
      };

      return {
        ...s,
        employee_id: s.id,
        salary,
        month_13,
        month_14,
        month_15,
        saved_percentage: toNum(saved.percentage),
        saved_result: toNum(saved.result),
        saved_line_id: saved.line_id ?? null,
        saved_bonus_run_id: saved.bonus_run_id ?? null,
        saved_is_released: !!saved.is_released,
        saved_release_date: saved.release_date || null,
      };
    });
  }, [staff, savedResults]);

  const total13 = computed.reduce((sum, s) => sum + toNum(s.month_13), 0);
  const total14 = computed.reduce((sum, s) => sum + toNum(s.month_14), 0);
  const total15 = computed.reduce((sum, s) => sum + toNum(s.month_15), 0);
  const totalResult = computed.reduce((sum, s) => sum + toNum(s.saved_result), 0);

  const toggleMenu = (id) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  const ensureRun = async () => {
    if (runId) return runId;
    if (!branch?.id) throw new Error("Branch not found.");

    const res = await api.post("/bonus/run", {
      branch_id: Number(branch.id),
      bonus_month: bonusMonth,
      notes: null,
    });

    const newRunId = res?.data?.bonus_run_id;
    if (!newRunId) throw new Error("Failed to create bonus run.");

    setRunId(newRunId);
    return newRunId;
  };

  const openCalculateModal = (row) => {
    setOpenMenuId(null);
    setSelectedRow(row);
    setPercentage(
      savedResults[String(row.employee_id)]?.percentage != null
        ? String(savedResults[String(row.employee_id)].percentage)
        : ""
    );
    setShowCalcModal(true);
  };

  const closeCalculateModal = () => {
    setShowCalcModal(false);
    setSelectedRow(null);
    setPercentage("");
  };

  const openReleaseModal = (row) => {
    setOpenMenuId(null);

    if (!row?.saved_result || toNum(row.saved_result) <= 0) {
      alert("Save the calculation first before releasing.");
      return;
    }

    setSelectedRow(row);
    setReleaseDate(row.saved_release_date || todayDate());
    setShowReleaseModal(true);
  };

  const closeReleaseModal = () => {
    setShowReleaseModal(false);
    setSelectedRow(null);
    setReleaseDate(todayDate());
  };

  const percentageValue = toNum(percentage);
  const result = selectedRow ? (toNum(selectedRow.month_15) * percentageValue) / 100 : 0;

  const handleSaveCalculation = async () => {
    if (!selectedRow) return;

    try {
      setSaving(true);

      const currentRunId = await ensureRun();

      const payload = {
        lines: [
          {
            employee_id: selectedRow.employee_id,
            salary: toNum(selectedRow.salary),
            month_13: toNum(selectedRow.month_13),
            month_14: toNum(selectedRow.month_14),
            month_15: toNum(selectedRow.month_15),
            percentage: percentageValue,
            result: toNum(result),
          },
        ],
      };

      await api.post(`/bonus/run/${currentRunId}/lines`, payload);

      setSavedResults((prev) => ({
        ...prev,
        [String(selectedRow.employee_id)]: {
          ...prev[String(selectedRow.employee_id)],
          bonus_run_id: currentRunId,
          percentage: percentageValue,
          result: toNum(result),
          is_released: prev[String(selectedRow.employee_id)]?.is_released || false,
          release_date: prev[String(selectedRow.employee_id)]?.release_date || null,
        },
      }));

      closeCalculateModal();
      alert("15th month result saved.");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to save bonus.");
    } finally {
      setSaving(false);
    }
  };

  const handleReleaseBonus = async () => {
    if (!selectedRow) return;

    try {
      if (!selectedRow.saved_line_id) {
        alert("Save the calculation first before releasing.");
        return;
      }

      if (!isValidDate(releaseDate)) {
        alert("Please select a valid release date.");
        return;
      }

      setSaving(true);

      await api.put(`/bonus/line/${selectedRow.saved_line_id}/release`, {
        release_date: releaseDate,
      });

      setSavedResults((prev) => ({
        ...prev,
        [String(selectedRow.employee_id)]: {
          ...prev[String(selectedRow.employee_id)],
          is_released: true,
          release_date: releaseDate,
        },
      }));

      closeReleaseModal();
      alert("15th month pay released.");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to release bonus.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="bonus-page">Loading bonus...</div>;
  if (error) return <div className="bonus-page error">{error}</div>;

  return (
    <div className="bonus-page">
      <div className="bonus-header">
        <div>
          <h2>Branch Bonus</h2>
          <p>
            {branch?.code} • {branch?.name} • {branch?.area}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="input"
            type="date"
            value={bonusMonth}
            onChange={(e) => setBonusMonth(e.target.value)}
            style={{ width: 170 }}
          />
          <button className="btn-back" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
        </div>
      </div>

      <div className="bonus-card">
        <table className="bonus-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee No</th>
              <th>Employee</th>
              <th>Position</th>
              <th>Salary</th>
              <th>13th Month</th>
              <th>14th Month</th>
              <th>15th Month</th>
              <th>Result</th>
              <th>Release Date</th>
              <th style={{ width: 90 }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {computed.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.employee_no ?? "-"}</td>
                <td>{s.fullname}</td>
                <td>{s.position}</td>
                <td>{fmtMoney(s.salary)}</td>
                <td className="strong">{fmtMoney(s.month_13)}</td>
                <td className="strong">{fmtMoney(s.month_14)}</td>
                <td className="strong">{fmtMoney(s.month_15)}</td>
                <td className="bonus-result">
                  {s.saved_result > 0 ? `₱ ${fmtMoney(s.saved_result)}` : "-"}
                  {s.saved_percentage > 0 ? (
                    <div className="bonus-result-note">{s.saved_percentage}%</div>
                  ) : null}
                </td>
                <td>
                  {s.saved_is_released && s.saved_release_date ? s.saved_release_date : "-"}
                </td>
                <td>
                  <div className="bonus-action-wrap" ref={openMenuId === s.id ? menuRef : null}>
                    <button
                      type="button"
                      className="bonus-kebab-btn"
                      onClick={() => toggleMenu(s.id)}
                    >
                      <BsThreeDotsVertical />
                    </button>

                    {openMenuId === s.id && (
                      <div className="bonus-menu">
                        <button
                          type="button"
                          className="bonus-menu-item"
                          onClick={() => openCalculateModal(s)}
                        >
                          Calculate
                        </button>

                        <button
                          type="button"
                          className="bonus-menu-item"
                          onClick={() => openReleaseModal(s)}
                          disabled={!s.saved_result || s.saved_is_released}
                        >
                          {s.saved_is_released ? "Released" : "Release"}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            <tr className="total-row">
              <td colSpan={5}>TOTAL</td>
              <td className="strong">{fmtMoney(total13)}</td>
              <td className="strong">{fmtMoney(total14)}</td>
              <td className="strong">{fmtMoney(total15)}</td>
              <td className="bonus-result">{fmtMoney(totalResult)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {showCalcModal && selectedRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeCalculateModal()}
        >
          <div className="modal bonus-calc-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Calculate 15th Month Result</h3>
                <p className="modal-subtitle">
                  {selectedRow.fullname} • 15th Month Base: <b>₱ {fmtMoney(selectedRow.month_15)}</b>
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeCalculateModal}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>Percentage (%)</label>
                  <input
                    className="input"
                    type="number"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                    placeholder="Enter percentage"
                  />
                </div>

                <div className="field full">
                  <label>Formula</label>
                  <div className="bonus-result-box">
                    ₱ {fmtMoney(selectedRow.month_15)} × {percentageValue || 0}% ={" "}
                    <strong>₱ {fmtMoney(result)}</strong>
                  </div>
                </div>

                <div className="field full">
                  <label>Result</label>
                  <div className="bonus-result-final">₱ {fmtMoney(result)}</div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={closeCalculateModal} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" type="button" onClick={handleSaveCalculation} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReleaseModal && selectedRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeReleaseModal()}
        >
          <div className="modal bonus-calc-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Release 15th Month Pay</h3>
                <p className="modal-subtitle">
                  {selectedRow.fullname} • Amount: <b>₱ {fmtMoney(selectedRow.saved_result)}</b>
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeReleaseModal}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>Employee</label>
                  <div className="bonus-result-box">{selectedRow.fullname}</div>
                </div>

                <div className="field full">
                  <label>Release Date</label>
                  <input
                    className="input"
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                  />
                </div>

                <div className="field full">
                  <label>Released Amount</label>
                  <div className="bonus-result-final">₱ {fmtMoney(selectedRow.saved_result)}</div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={closeReleaseModal} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" type="button" onClick={handleReleaseBonus} disabled={saving}>
                  {saving ? "Releasing..." : "Release"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bonus;