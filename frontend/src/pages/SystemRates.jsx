import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { useCompRates } from "../context/CompRatesContext";
import "../styles/SystemRates.css";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();

const money = (v) =>
  toNum(v).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

function computeMonthlyTax(taxableIncome) {
  const income = toNum(taxableIncome);

  if (income <= 20833) return { bracket: "P 20,833 and below", tax: 0 };
  if (income <= 33332) return { bracket: "P 20,834 - P 33,332", tax: 0.15 * (income - 20833) };
  if (income <= 66666) return { bracket: "P 33,333 - P 66,666", tax: 2500 + 0.2 * (income - 33333) };
  if (income <= 166666) return { bracket: "P 66,667 - P 166,666", tax: 8541.8 + 0.25 * (income - 66667) };
  if (income <= 666666) return { bracket: "P 166,667 - P 666,666", tax: 33541.8 + 0.3 * (income - 166667) };

  return { bracket: "Over P 666,666", tax: 183541.8 + 0.35 * (income - 666667) };
}

export default function SystemRates() {
  const navigate = useNavigate();
  const { rates, loading, error, refresh } = useCompRates();

  const [errLocal, setErrLocal] = useState("");

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // view | edit | create
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const emptyForm = {
    position: "",
    salary: "",
    ecola: "",
    cbu: "",
    cashbond: "",
    utility: "",
  };

  const [form, setForm] = useState(emptyForm);

  const err = errLocal || error;
  const isReadOnly = modalMode === "view";

  const computed = useMemo(() => {
    const salary = toNum(form.salary);
    const ecola = toNum(form.ecola);
    const grossIncome = salary + ecola;

    // EE = 5%
    const sss_ee = grossIncome * 0.05;
    const philhealth_ee = salary * 0.05;
    const pagibig_ee = salary * 0.05;
    const total_ee = sss_ee + philhealth_ee + pagibig_ee;

    // ER = 10%
    const sss_er = grossIncome * 0.10;
    const philhealth_er = salary * 0.10;
    const pagibig_er = salary * 0.10;
    const total_er = sss_er + philhealth_er + pagibig_er;

    const taxableIncome = Math.max(0, grossIncome - total_ee);
    const tax = computeMonthlyTax(taxableIncome).tax;

    return {
      salary,
      ecola,
      grossIncome,
      sss_ee,
      philhealth_ee,
      pagibig_ee,
      total_ee,
      sss_er,
      philhealth_er,
      pagibig_er,
      total_er,
      taxableIncome,
      tax,
    };
  }, [form.salary, form.ecola]);

  const totals = useMemo(() => {
    return rates.reduce(
      (acc, row) => {
        acc.salary += toNum(row.salary);
        acc.ecola += toNum(row.ecola);
        acc.total_comp += toNum(row.salary) + toNum(row.ecola);

        acc.sss_er += toNum(row.sss_er);
        acc.philhealth_er += toNum(row.philhealth_er);
        acc.pagibig_er += toNum(row.pagibig_er);
        acc.total_er += toNum(row.total_er);

        acc.sss_ee += toNum(row.sss_ee);
        acc.philhealth_ee += toNum(row.philhealth_ee);
        acc.pagibig_ee += toNum(row.pagibig_ee);
        acc.total_ee += toNum(row.total_ee);

        acc.tax += toNum(row.tax);
        acc.utility += toNum(row.utility);

        return acc;
      },
      {
        salary: 0,
        ecola: 0,
        total_comp: 0,
        sss_er: 0,
        philhealth_er: 0,
        pagibig_er: 0,
        total_er: 0,
        sss_ee: 0,
        philhealth_ee: 0,
        pagibig_ee: 0,
        total_ee: 0,
        tax: 0,
        utility: 0,
      }
    );
  }, [rates]);

  const openCreateModal = () => {
    if (!isAdmin) return;
    setErrLocal("");
    setSelectedId(null);
    setModalMode("create");
    setForm(emptyForm);
    setShowModal(true);
  };

  const fillFormFromRow = (row) => {
    setForm({
      position: row.position ?? "",
      salary: row.salary ?? 0,
      ecola: row.ecola ?? 0,
      cbu: row.cbu ?? 0,
      cashbond: row.cashbond ?? 0,
      utility: row.utility ?? 0,
    });
  };

  const openViewModal = (row) => {
    setErrLocal("");
    setSelectedId(row.id);
    setModalMode("view");
    fillFormFromRow(row);
    setShowModal(true);
  };

  const openEditModal = (row) => {
    if (!isAdmin) return;
    setErrLocal("");
    setSelectedId(row.id);
    setModalMode("edit");
    fillFormFromRow(row);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setSelectedId(null);
    setForm(emptyForm);
    setModalMode("view");
    setErrLocal("");
  };

  const handleSave = async () => {
    if (!isAdmin || modalMode === "view") return;

    setErrLocal("");

    try {
      setSaving(true);

      const payload = {
        position: toStr(form.position),
        salary: computed.salary,
        ecola: computed.ecola,

        sss_ee: computed.sss_ee,
        philhealth_ee: computed.philhealth_ee,
        pagibig_ee: computed.pagibig_ee,
        total_ee: computed.total_ee,

        sss_er: computed.sss_er,
        philhealth_er: computed.philhealth_er,
        pagibig_er: computed.pagibig_er,
        total_er: computed.total_er,

        tax: computed.tax,

        cbu: toNum(form.cbu),
        cashbond: toNum(form.cashbond),
        utility: toNum(form.utility),
      };

      if (!payload.position) {
        setErrLocal("Position is required.");
        return;
      }

      if (modalMode === "create") {
        await api.post("/comp-rates", payload);
      } else {
        await api.put(`/comp-rates/${selectedId}`, payload);
      }

      await refresh();
      closeModal();
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this position rate?")) return;

    setErrLocal("");

    try {
      await api.delete(`/comp-rates/${id}`);
      await refresh();

      if (showModal && selectedId === id) {
        closeModal();
      }
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to delete");
    }
  };

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">Salary & Allowance Rates</h2>
          <p className="sys-subtitle">
            Manage salary, ECOLA, EE, ER, tax, and utility values per position.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-secondary"
            onClick={() => navigate("/system-update")}
            type="button"
          >
            ← Back
          </button>

          <button
            className="btn-primary"
            onClick={refresh}
            disabled={loading}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {isAdmin && (
            <button className="btn-primary" onClick={openCreateModal} type="button">
              + Add Rate
            </button>
          )}
        </div>
      </div>

      {err && <div className="sys-error">{err}</div>}

      <div className="sys-card">
        <div className="sys-card-head">
          <div>
            <div className="sys-card-title">Salary and Wages</div>
            <div className="sys-card-meta">
              {loading ? "Loading..." : `Positions: ${rates.length}`}
            </div>
          </div>
        </div>

        <div className="sys-card-body">
          <div className="sr-payroll-wrap">
            <table className="sr-payroll-table">
              <thead>
                <tr>
                  <th rowSpan={2}>ID</th>
                  <th rowSpan={2}>Position</th>
                  <th colSpan={3}>Earnings</th>
                  <th colSpan={4}>Employer (ER)</th>
                  <th colSpan={5}>Employee (EE)</th>
                  <th rowSpan={2}>Actions</th>
                </tr>
                <tr>
                  <th>Salary</th>
                  <th>ECOLA</th>
                  <th>Total Comp</th>

                  <th>SSS</th>
                  <th>PH</th>
                  <th>Pag-IBIG</th>
                  <th>Total ER</th>

                  <th>SSS</th>
                  <th>PH</th>
                  <th>Pag-IBIG</th>
                  <th>Total EE</th>
                  <th>Tax</th>
                </tr>
              </thead>

              <tbody>
                {rates.map((r, idx) => (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td className="sr-strong">{r.position || "-"}</td>

                    <td>{money(r.salary)}</td>
                    <td>{money(r.ecola)}</td>
                    <td>{money(toNum(r.salary) + toNum(r.ecola))}</td>

                    <td>{money(r.sss_er)}</td>
                    <td>{money(r.philhealth_er)}</td>
                    <td>{money(r.pagibig_er)}</td>
                    <td>{money(r.total_er)}</td>

                    <td>{money(r.sss_ee)}</td>
                    <td>{money(r.philhealth_ee)}</td>
                    <td>{money(r.pagibig_ee)}</td>
                    <td>{money(r.total_ee)}</td>
                    <td>{money(r.tax)}</td>

                    <td>
                      <div className="sys-actions">

                        {isAdmin && (
                          <button className="sys-btn" onClick={() => openEditModal(r)} type="button">
                            Edit
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            className="sys-btn danger"
                            onClick={() => handleDelete(r.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && rates.length > 0 && (
                  <tr className="sr-total-row">
                    <td colSpan={2}>Totals</td>

                    <td>{money(totals.salary)}</td>
                    <td>{money(totals.ecola)}</td>
                    <td>{money(totals.total_comp)}</td>

                    <td>{money(totals.sss_er)}</td>
                    <td>{money(totals.philhealth_er)}</td>
                    <td>{money(totals.pagibig_er)}</td>
                    <td>{money(totals.total_er)}</td>

                    <td>{money(totals.sss_ee)}</td>
                    <td>{money(totals.philhealth_ee)}</td>
                    <td>{money(totals.pagibig_ee)}</td>
                    <td>{money(totals.total_ee)}</td>
                    <td>{money(totals.tax)}</td>

                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sys-note">Tip: scroll horizontally to view all columns.</div>

          {!loading && rates.length === 0 && (
            <div className="sys-note">No position rates found.</div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="sys-modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="sys-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sys-modal-head">
              <div>
                <h3 className="sys-modal-title">
                  {modalMode === "create"
                    ? "Add Position Rate"
                    : modalMode === "edit"
                    ? "Edit Position Rate"
                    : "View Position Rate"}
                </h3>

                <p className="sys-modal-sub">
                  {modalMode === "create"
                    ? "Create a new default compensation rate."
                    : modalMode === "edit"
                    ? "Update the position compensation details."
                    : "Review the position compensation details."}
                </p>
              </div>

              <button className="sys-modal-close" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="sys-modal-body">
              {isReadOnly ? (
                <div className="sys-view-grid">
                  <div className="sys-view-field full">
                    <label>Position</label>
                    <div className="sys-view-box">{form.position || "-"}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Salary</label>
                    <div className="sys-view-box">{money(computed.salary)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>ECOLA</label>
                    <div className="sys-view-box">{money(computed.ecola)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>SSS EE</label>
                    <div className="sys-view-box">{money(computed.sss_ee)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>PhilHealth EE</label>
                    <div className="sys-view-box">{money(computed.philhealth_ee)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Pag-IBIG EE</label>
                    <div className="sys-view-box">{money(computed.pagibig_ee)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Total EE</label>
                    <div className="sys-view-box">{money(computed.total_ee)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>SSS ER</label>
                    <div className="sys-view-box">{money(computed.sss_er)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>PhilHealth ER</label>
                    <div className="sys-view-box">{money(computed.philhealth_er)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Pag-IBIG ER</label>
                    <div className="sys-view-box">{money(computed.pagibig_er)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Total ER</label>
                    <div className="sys-view-box">{money(computed.total_er)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Tax</label>
                    <div className="sys-view-box">{money(computed.tax)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>CBU</label>
                    <div className="sys-view-box">{money(form.cbu)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Cash Bond</label>
                    <div className="sys-view-box">{money(form.cashbond)}</div>
                  </div>

                  <div className="sys-view-field">
                    <label>Utility</label>
                    <div className="sys-view-box">{money(form.utility)}</div>
                  </div>
                </div>
              ) : (
                <div className="sys-form-grid">
                  <div className="sys-field full">
                    <label>Position</label>
                    <input
                      type="text"
                      value={form.position}
                      onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                    />
                  </div>

                  <div className="sys-field">
                    <label>Salary</label>
                    <input
                      type="number"
                      value={form.salary}
                      onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))}
                    />
                  </div>

                  <div className="sys-field">
                    <label>ECOLA</label>
                    <input
                      type="number"
                      value={form.ecola}
                      onChange={(e) => setForm((p) => ({ ...p, ecola: e.target.value }))}
                    />
                  </div>

                  <div className="sys-field">
                    <label>SSS EE</label>
                    <input type="number" value={computed.sss_ee.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>PhilHealth EE</label>
                    <input type="number" value={computed.philhealth_ee.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>Pag-IBIG EE</label>
                    <input type="number" value={computed.pagibig_ee.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>Total EE</label>
                    <input type="number" value={computed.total_ee.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>SSS ER</label>
                    <input type="number" value={computed.sss_er.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>PhilHealth ER</label>
                    <input type="number" value={computed.philhealth_er.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>Pag-IBIG ER</label>
                    <input type="number" value={computed.pagibig_er.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>Total ER</label>
                    <input type="number" value={computed.total_er.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>Tax</label>
                    <input type="number" value={computed.tax.toFixed(2)} disabled />
                  </div>

                  <div className="sys-field">
                    <label>CBU</label>
                    <input
                      type="number"
                      value={form.cbu}
                      onChange={(e) => setForm((p) => ({ ...p, cbu: e.target.value }))}
                    />
                  </div>

                  <div className="sys-field">
                    <label>Cash Bond</label>
                    <input
                      type="number"
                      value={form.cashbond}
                      onChange={(e) => setForm((p) => ({ ...p, cashbond: e.target.value }))}
                    />
                  </div>

                  <div className="sys-field">
                    <label>Utility</label>
                    <input
                      type="number"
                      value={form.utility}
                      onChange={(e) => setForm((p) => ({ ...p, utility: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {err && <div className="sys-error" style={{ marginTop: 14 }}>{err}</div>}
            </div>

            <div className="sys-modal-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                Close
              </button>

              {isAdmin && !isReadOnly && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? modalMode === "create"
                      ? "Creating..."
                      : "Saving..."
                    : modalMode === "create"
                    ? "Create"
                    : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}