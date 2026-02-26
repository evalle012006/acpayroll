import { useEffect, useMemo, useState } from "react";
import "../styles/StaffInformation.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

function StaffForm({ form, branches, onChange, photoPreview, onPickPhoto }) {
  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left">
        <div className="field">
          <label>Employee No</label>
          <input className="input" name="employee_no" value={form.employee_no} onChange={onChange} />
        </div>

        <div className="field">
          <label>Full Name</label>
          <input className="input" name="fullname" value={form.fullname} onChange={onChange} required />
        </div>

        <div className="field">
          <label>Position</label>
          <input className="input" name="position" value={form.position} onChange={onChange} required />
        </div>

        <div className="field">
          <label>Department</label>
          <input className="input" name="department" value={form.department} onChange={onChange} />
        </div>

        <div className="field">
          <label>Area</label>
          <input className="input" name="area" value={form.area} onChange={onChange} />
        </div>

        <div className="field">
          <label>Branch</label>
          <select className="input" name="branch_id" value={form.branch_id} onChange={onChange}>
            <option value="">Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} • {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ NEW: STATUS */}
        <div className="field">
          <label>Status</label>
          <select className="input" name="status" value={form.status} onChange={onChange}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="field">
          <label>Regularization Date</label>
          <input className="input" name="regularization_date" type="date" value={form.regularization_date} onChange={onChange} />
        </div>

        <div className="field">
          <label>Salary</label>
          <input className="input" name="salary" value={form.salary} onChange={onChange} />
        </div>

        <div className="field">
          <label>Ecola</label>
          <input className="input" name="ecola" value={form.ecola} onChange={onChange} />
        </div>
      </div>

      <div className="staff-add-right">
        <div className="photo-preview">
          {photoPreview ? <img src={photoPreview} alt="preview" /> : <div className="photo-placeholder">No Photo</div>}
        </div>

        <label className="btn btn-outline photo-upload">
          Upload Photo
          <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
        </label>
      </div>
    </div>
  );
}

function StaffAttachments({ staffId }) {
  const [attachments, setAttachments] = useState([]);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const getBase = () => {
    const base = api.defaults.baseURL || "";
    return base.endsWith("/api") ? base.slice(0, -4) : base;
  };

  const base = useMemo(() => getBase(), []);

  const fileLink = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${base}${url}`;
  };

  const load = async () => {
    try {
      const res = await api.get(`/staff/${staffId}/attachments`);
      setAttachments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAttachments([]);
    }
  };

  useEffect(() => {
    if (!staffId) return;
    load();
  }, [staffId]);

  const uploadFile = async () => {
    if (!fileName.trim()) return alert("File name required.");
    if (!file) return alert("Select file.");

    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file_name", fileName);
      fd.append("file", file);

      await api.post(`/staff/${staffId}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFileName("");
      setFile(null);
      await load();
      alert("File uploaded.");
    } catch (e) {
      alert(e?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (id) => {
    if (!window.confirm("Delete this file?")) return;

    try {
      await api.delete(`/staff/attachments/${id}`);
      await load();
    } catch {
      alert("Delete failed.");
    }
  };

  return (
    <div style={{ padding: 10 }}>
      <h4 style={{ marginBottom: 10 }}>Attachments</h4>

      {/* ADD FILE SECTION */}
      <div className="card" style={{ padding: 15, marginBottom: 20 }}>
        <div className="field">
          <label>File Name</label>
          <input
            className="input"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Enter file name..."
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button
            className="btn btn-primary"
            type="button"
            onClick={uploadFile}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Add File"}
          </button>
        </div>
      </div>

      {/* FILE TABLE */}
      <table className="saas-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Original File</th>
            <th>Date Uploaded</th>
            <th style={{ width: 200 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {attachments.length === 0 ? (
            <tr>
              <td colSpan={4}>No files uploaded.</td>
            </tr>
          ) : (
            attachments.map((a) => (
              <tr key={a.id}>
                <td>{a.file_name}</td>
                <td>{a.original_name}</td>
                <td>{String(a.uploaded_at).split("T")[0]}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <a
                    className="btn btn-outline"
                    href={fileLink(a.file_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>

                  <button
                    className="btn btn-danger"
                    onClick={() => deleteFile(a.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StaffProfileModal({ staff, avatarUrl, onClose }) {
  const [tab, setTab] = useState("staff");

  const [transferRows, setTransferRows] = useState([]);
  const [promotionRows, setPromotionRows] = useState([]);
  const [demotionRows, setDemotionRows] = useState([]);
  const [suspensionRows, setSuspensionRows] = useState([]);

  const [loading, setLoading] = useState(false);

  const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
  const toNum = (v) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  useEffect(() => {
    if (!staff?.id) return;
    if (tab !== "history") return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // adjust endpoints to match YOUR backend routes
        const [transferRes, promoRes, demoRes, suspRes] = await Promise.all([
          api.get("/transfer-staff-orders"),
          api.get("/promotion-orders"),
          api.get("/demotion-orders"),
          api.get("/suspension-orders"),
        ]);

        if (!alive) return;

        const empId = Number(staff.id);

        const transfers = Array.isArray(transferRes.data)
          ? transferRes.data.filter((x) => Number(x.employee_id) === empId)
          : [];

        const promotions = Array.isArray(promoRes.data)
          ? promoRes.data.filter((x) => Number(x.employee_id) === empId)
          : [];

        const demotions = Array.isArray(demoRes.data)
          ? demoRes.data.filter((x) => Number(x.employee_id) === empId)
          : [];

        const suspensions = Array.isArray(suspRes.data)
          ? suspRes.data.filter((x) => Number(x.employee_id) === empId)
          : [];

        setTransferRows(transfers);
        setPromotionRows(promotions);
        setDemotionRows(demotions);
        setSuspensionRows(suspensions);
      } catch (e) {
        setTransferRows([]);
        setPromotionRows([]);
        setDemotionRows([]);
        setSuspensionRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, staff?.id]);

  const TabButton = ({ id, label }) => (
    <button
      className={`tab-btn ${tab === id ? "active" : ""}`}
      onClick={() => setTab(id)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1000 }}>
        <div className="modal-head">
          <div>
            <h3>Staff Profile</h3>
            <div className="mini">
              {staff.fullname} • {staff.position || "-"} • {staff.status || "Active"}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* HEADER */}
          <div className="staff-view-top">
            {avatarUrl(staff) ? (
              <img className="staff-avatar-lg" src={avatarUrl(staff)} alt="staff" />
            ) : (
              <div className="staff-avatar-lg staff-avatar--fallback">
                {String(staff.fullname || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          {/* TABS */}
          <div className="staff-tabs">
            <TabButton id="staff" label="Staff Details" />
            <TabButton id="contract" label="Contract Details" />
            <TabButton id="leave" label="Leave Details" />
            <TabButton id="attach" label="Attachment" />
            <TabButton id="history" label="Transaction History" />
          </div>

          {/* STAFF DETAILS */}
          {tab === "staff" && (
            <table className="profile-table">
              <tbody>
                <tr><td>ID</td><td>{staff.id}</td></tr>
                <tr><td>Employee No</td><td>{staff.employee_no || "-"}</td></tr>
                <tr><td>Full Name</td><td>{staff.fullname}</td></tr>
                <tr><td>Position</td><td>{staff.position || "-"}</td></tr>
                <tr><td>Department</td><td>{staff.department || "-"}</td></tr>
                <tr><td>Area</td><td>{staff.area || "-"}</td></tr>
                <tr><td>Branch</td><td>{staff.branch_id ?? "-"}</td></tr>
                <tr><td>Status</td><td>{staff.status || "Active"}</td></tr>
              </tbody>
            </table>
          )}

          {/* CONTRACT DETAILS */}
          {tab === "contract" && (
            <table className="profile-table">
              <tbody>
                <tr><td>Regularization Date</td><td>{fmtDate(staff.regularization_date)}</td></tr>
                <tr><td>Salary</td><td>{toNum(staff.salary).toLocaleString()}</td></tr>
                <tr><td>Ecola</td><td>{toNum(staff.ecola).toLocaleString()}</td></tr>
              </tbody>
            </table>
          )}

          {/* LEAVE DETAILS (placeholder — you already had working leave table) */}
          {tab === "leave" && (
            <div style={{ padding: 10 }}>
              <div className="mini">Leave Details tab (keep your existing leave table here)</div>
            </div>
          )}

          {/* ATTACHMENT */}
          {tab === "attach" && (
            <StaffAttachments staffId={staff.id} />
          )}

          {/* TRANSACTION HISTORY ONLY: TRANSFER / PROMOTION / DEMOTION / SUSPENSION */}
          {tab === "history" && (
            <div className="table-scroll">
              {loading ? (
                "Loading..."
              ) : (
                <>
                  {/* TRANSFER */}
                  <h4>Transfer Orders</h4>
                  <table className="saas-table">
                    <thead>
                      <tr>
                        <th>Order No</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Effective</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferRows.length === 0 ? (
                        <tr><td colSpan={5}>No transfer records</td></tr>
                      ) : (
                        transferRows.map((x) => (
                          <tr key={x.id}>
                            <td>{x.order_no}</td>
                            <td>{x.prev_branch_code} • {x.prev_branch_name}</td>
                            <td>{x.to_branch_code} • {x.to_branch_name}</td>
                            <td>{fmtDate(x.effective_date)}</td>
                            <td>{x.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* PROMOTION */}
                  <h4 style={{ marginTop: 20 }}>Promotion Orders</h4>
                  <table className="saas-table">
                    <thead>
                      <tr>
                        <th>Order No</th>
                        <th>Old Position</th>
                        <th>New Position</th>
                        <th>Effective</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promotionRows.length === 0 ? (
                        <tr><td colSpan={5}>No promotion records</td></tr>
                      ) : (
                        promotionRows.map((x) => (
                          <tr key={x.id}>
                            <td>{x.order_no || x.id}</td>
                            <td>{x.old_position || "-"}</td>
                            <td>{x.new_position || "-"}</td>
                            <td>{fmtDate(x.effective_date)}</td>
                            <td>{x.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* DEMOTION */}
                  <h4 style={{ marginTop: 20 }}>Demotion Orders</h4>
                  <table className="saas-table">
                    <thead>
                      <tr>
                        <th>Order No</th>
                        <th>Old Position</th>
                        <th>New Position</th>
                        <th>Effective</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demotionRows.length === 0 ? (
                        <tr><td colSpan={5}>No demotion records</td></tr>
                      ) : (
                        demotionRows.map((x) => (
                          <tr key={x.id}>
                            <td>{x.order_no || x.id}</td>
                            <td>{x.old_position || "-"}</td>
                            <td>{x.new_position || "-"}</td>
                            <td>{fmtDate(x.effective_date)}</td>
                            <td>{x.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* SUSPENSION */}
                  <h4 style={{ marginTop: 20 }}>Suspension Orders</h4>
                  <table className="saas-table">
                    <thead>
                      <tr>
                        <th>Order No</th>
                        <th>Reason</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suspensionRows.length === 0 ? (
                        <tr><td colSpan={5}>No suspension records</td></tr>
                      ) : (
                        suspensionRows.map((x) => (
                          <tr key={x.id}>
                            <td>{x.order_no || x.id}</td>
                            <td>{x.reason || "-"}</td>
                            <td>{fmtDate(x.start_date)}</td>
                            <td>{fmtDate(x.end_date)}</td>
                            <td>{x.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffInformation() {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // NEW: status filter
  const [statusFilter, setStatusFilter] = useState("All");

  const [viewStaff, setViewStaff] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editStaff, setEditStaff] = useState(null);

  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [form, setForm] = useState({
    employee_no: "",
    fullname: "",
    position: "",
    department: "",
    area: "",
    branch_id: "",
    status: "Active",
    salary: "",
    ecola: "",
    transportation: "",
    postage: "",
    motorcycle_loan: "",
    additional_target: "",
    repairing: "",
    additional_monitoring: "",
    motorcycle: "",
    other_deduction: "",
    regularization_date: "",
  });

  const base = useMemo(() => getBase(), []);

  const avatarUrl = (s) => {
    const p = s?.photo_url;
    if (!p) return "";
    if (String(p).startsWith("http")) return p;
    return `${base}${p}`;
  };

  const resetForm = () => {
    setForm({
      employee_no: "",
      fullname: "",
      position: "",
      department: "",
      area: "",
      branch_id: "",
      status: "Active",
      salary: "",
      ecola: "",
      transportation: "",
      postage: "",
      motorcycle_loan: "",
      additional_target: "",
      repairing: "",
      additional_monitoring: "",
      motorcycle: "",
      other_deduction: "",
      regularization_date: "",
    });
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const closeAllModals = () => {
    setShowAdd(false);
    setViewStaff(null);
    setEditStaff(null);
    resetForm();
  };

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onPickPhoto = (file) => {
    setPhotoFile(file || null);
    if (!file) return setPhotoPreview("");
    const r = new FileReader();
    r.onload = () => setPhotoPreview(String(r.result || ""));
    r.readAsDataURL(file);
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRes, branchesRes] = await Promise.all([api.get("/staff"), api.get("/branches")]);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const isAnyModalOpen = showAdd || !!viewStaff || !!editStaff;
    if (!isAnyModalOpen) return;

    const onKey = (e) => e.key === "Escape" && closeAllModals();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showAdd, viewStaff, editStaff]);

  const filteredStaff = useMemo(() => {
    const q = norm(search);

    return staff.filter((s) => {
      // status filter
      const st = String(s.status || "Active");
      if (statusFilter !== "All" && st !== statusFilter) return false;

      if (!q) return true;

      const hay = [s.id, s.employee_no, s.fullname, s.position, s.department, s.area, s.branch_id, s.status]
        .map((x) => norm(x))
        .join(" ");
      return hay.includes(q);
    });
  }, [staff, search, statusFilter]);

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (s) => {
    setEditStaff(s);
    setForm({
      employee_no: s.employee_no || "",
      fullname: s.fullname || "",
      position: s.position || "",
      department: s.department || "",
      area: s.area || "",
      branch_id: String(s.branch_id ?? ""),
      status: String(s.status || "Active"),
      salary: String(s.salary ?? ""),
      ecola: String(s.ecola ?? ""),
      transportation: String(s.transportation ?? ""),
      postage: String(s.postage ?? ""),
      motorcycle_loan: String(s.motorcycle_loan ?? ""),
      additional_target: String(s.additional_target ?? ""),
      repairing: String(s.repairing ?? ""),
      additional_monitoring: String(s.additional_monitoring ?? ""),
      motorcycle: String(s.motorcycle ?? ""),
      other_deduction: String(s.other_deduction ?? ""),
      regularization_date: s.regularization_date ? String(s.regularization_date).split("T")[0] : "",
    });
    setPhotoPreview(s.photo_url ? avatarUrl(s) : "");
    setPhotoFile(null);
  };

  const saveStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        salary: toNum(form.salary),
        ecola: toNum(form.ecola),
        transportation: toNum(form.transportation),
        postage: toNum(form.postage),
        motorcycle_loan: toNum(form.motorcycle_loan),
        additional_target: toNum(form.additional_target),
        repairing: toNum(form.repairing),
        additional_monitoring: toNum(form.additional_monitoring),
        motorcycle: toNum(form.motorcycle),
        other_deduction: toNum(form.other_deduction),
      };

      const res = await api.post("/staff", payload);
      const newId = res.data?.id;

      if (photoFile && newId) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await api.post(`/staff/${newId}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }

      closeAllModals();
      await loadAll();
      alert("Staff saved.");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to save staff.");
    } finally {
      setSaving(false);
    }
  };

  const updateStaff = async (e) => {
    e.preventDefault();
    if (!editStaff) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        salary: toNum(form.salary),
        ecola: toNum(form.ecola),
        transportation: toNum(form.transportation),
        postage: toNum(form.postage),
        motorcycle_loan: toNum(form.motorcycle_loan),
        additional_target: toNum(form.additional_target),
        repairing: toNum(form.repairing),
        additional_monitoring: toNum(form.additional_monitoring),
        motorcycle: toNum(form.motorcycle),
        other_deduction: toNum(form.other_deduction),
      };

      await api.put(`/staff/${editStaff.id}`, payload);

      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await api.post(`/staff/${editStaff.id}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }

      closeAllModals();
      await loadAll();
      alert("Staff updated.");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to update staff.");
    } finally {
      setSaving(false);
    }
  };

  const statusBadgeClass = (s) => (String(s || "Active") === "Inactive" ? "status-badge inactive" : "status-badge active");

  return (
    <div className="staffinfo-page">
      <div className="staffinfo-header">
        <div>
          <h2>Staff Information</h2>
          <p>View staff, add staff, edit staff, upload photo, and set Active/Inactive status.</p>
        </div>

        <div className="staffinfo-actions">
          <button className="btn btn-outline" onClick={loadAll} type="button">
            Refresh
          </button>
          <button className="btn btn-primary" onClick={openAdd} type="button">
            + Add Staff
          </button>
        </div>
      </div>

      <div className="card staffinfo-controls">
        <div className="search-wrap" style={{ gap: 10 }}>
          {/* NEW status filter */}
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <input
            className="input"
            placeholder="Search by ID, name, position, department, area..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
          <button className="btn btn-outline" onClick={() => setSearch(searchInput)} type="button">
            Search
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => (setSearch(""), setSearchInput(""))}>
            Clear
          </button>

          <div className="pill">
            Results: <strong>{filteredStaff.length}</strong>
          </div>
        </div>
      </div>

      <div className="card staffinfo-table-card">
        {loading ? (
          <div className="table-loading">Loading staff…</div>
        ) : error ? (
          <div className="table-loading" style={{ color: "#ef4444" }}>
            {error}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="saas-table staffinfo-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}></th>
                  <th style={{ width: 90 }}>No</th>
                  <th style={{ width: 120 }}>Emp No</th>
                  <th>Name</th>
                  <th style={{ width: 180 }}>Position</th>
                  <th style={{ width: 180 }}>Department</th>
                  <th style={{ width: 180 }}>Area</th>

                  <th style={{ width: 120 }}>Status</th>

                  <th style={{ width: 140 }}>Regularized</th>
                  <th style={{ width: 160 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty">
                      No staff found.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {avatarUrl(s) ? (
                          <img className="staff-avatar" src={avatarUrl(s)} alt="staff" />
                        ) : (
                          <div className="staff-avatar staff-avatar--fallback">{toStr(s.fullname).slice(0, 1).toUpperCase() || "?"}</div>
                        )}
                      </td>

                      <td className="mono">{s.id}</td>
                      <td className="mono">{s.employee_no || "-"}</td>
                      <td className="strong">{s.fullname}</td>
                      <td>{s.position || "-"}</td>
                      <td>{s.department || "-"}</td>
                      <td>{s.area || "-"}</td>

                      <td>
                        <span className={statusBadgeClass(s.status)}>{String(s.status || "Active")}</span>
                      </td>

                      <td>{fmtDate(s.regularization_date)}</td>

                      <td>
                        <div className="actions">
                          <button className="action-btn btn-view" onClick={() => setViewStaff(s)} type="button">
                            View
                          </button>
                          <button className="action-btn btn-edit" onClick={() => openEdit(s)} type="button">
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW MODAL */}
          {viewStaff && (
            <StaffProfileModal
              staff={viewStaff}
              avatarUrl={avatarUrl}
              onClose={closeAllModals}
            />
          )}

      {/* ADD MODAL */}
      {showAdd && (
        <div className="modal-overlay" onMouseDown={closeAllModals}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Add Staff</h3>
              <button className="icon-btn" onClick={closeAllModals} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={saveStaff}>
              <StaffForm form={form} branches={branches} onChange={onChange} photoPreview={photoPreview} onPickPhoto={onPickPhoto} />

              <div className="modal-foot">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Staff"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editStaff && (
        <div className="modal-overlay" onMouseDown={closeAllModals}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Edit Staff</h3>
              <button className="icon-btn" onClick={closeAllModals} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={updateStaff}>
              <StaffForm form={form} branches={branches} onChange={onChange} photoPreview={photoPreview} onPickPhoto={onPickPhoto} />

              <div className="modal-foot">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Updating..." : "Update Staff"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}