import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/StaffInformation.css";
import api from "../api/axiosClient";

/* ------------------------- Helpers ------------------------- */
const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  if (ln || fn || mn) {
    return `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
      .replace(/\s+/g, " ")
      .trim();
  }
  return toStr(s?.fullname) || "-";
};

const displayFormName = (form) => {
  const ln = toStr(form?.last_name);
  const fn = toStr(form?.first_name);
  const mn = toStr(form?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  return built || "New staff";
};

/* ------------------------- Step Tabs (Add/Edit) ------------------------- */
function StepTabs({ step, onSelectStep, canGoContract }) {
  return (
    <div className="step-tabs">
      <button
        type="button"
        className={`step-tab ${step === 1 ? "active" : ""}`}
        onClick={() => onSelectStep(1)}
      >
        Staff Details
      </button>

      <button
        type="button"
        className={`step-tab ${step === 2 ? "active" : ""}`}
        onClick={() => onSelectStep(2)}
        disabled={!canGoContract}
        title={!canGoContract ? "Complete Staff Details first" : ""}
      >
        Contract Details
      </button>
    </div>
  );
}

/* ------------------------- Step 1: Staff Details (Personal) ------------------------- */
function StaffDetailsStep({ form, onChange }) {
  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field">
          <label>Employee No</label>
          <input className="input" name="employee_no" value={form.employee_no} onChange={onChange} />
        </div>

        <div className="field">
          <label>Last Name *</label>
          <input className="input" name="last_name" value={form.last_name} onChange={onChange} required />
        </div>

        <div className="field">
          <label>First Name *</label>
          <input className="input" name="first_name" value={form.first_name} onChange={onChange} required />
        </div>

        <div className="field">
          <label>Middle Name</label>
          <input className="input" name="middle_name" value={form.middle_name} onChange={onChange} />
        </div>

        <div className="field">
          <label>Address</label>
          <input className="input" name="address" value={form.address} onChange={onChange} />
        </div>

        <div className="field">
          <label>Municipality</label>
          <input className="input" name="municipality" value={form.municipality} onChange={onChange} />
        </div>

        <div className="field">
          <label>Province</label>
          <input className="input" name="province" value={form.province} onChange={onChange} />
        </div>

        <div className="field">
          <label>Contact</label>
          <input className="input" name="contact" value={form.contact} onChange={onChange} />
        </div>

        <div className="field">
          <label>Email</label>
          <input className="input" name="email" value={form.email} onChange={onChange} />
        </div>

        <div className="field">
          <label>Date of Birth</label>
          <input className="input" type="date" name="date_of_birth" value={form.date_of_birth} onChange={onChange} />
        </div>

        <div className="field">
          <label>Place of Birth</label>
          <input className="input" name="place_of_birth" value={form.place_of_birth} onChange={onChange} />
        </div>

        <div className="field">
          <label>Gender</label>
          <select className="input" name="gender" value={form.gender} onChange={onChange}>
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        <div className="field">
          <label>Civil Status</label>
          <select className="input" name="civil_status" value={form.civil_status} onChange={onChange}>
            <option value="">Select...</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Separated">Separated</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>

        <div className="field">
          <label>Citizenship</label>
          <input className="input" name="citizenship" value={form.citizenship} onChange={onChange} />
        </div>

        <div className="field">
          <label>Height</label>
          <input className="input" name="height" value={form.height} onChange={onChange} placeholder="e.g., 170" />
        </div>

        <div className="field">
          <label>Weight</label>
          <input className="input" name="weight" value={form.weight} onChange={onChange} placeholder="e.g., 65" />
        </div>

        <div className="field">
          <label>Religion</label>
          <input className="input" name="religion" value={form.religion} onChange={onChange} />
        </div>

        <div className="field">
          <label>Blood Type</label>
          <input className="input" name="blood_type" value={form.blood_type} onChange={onChange} placeholder="e.g., O+" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Step 2: Contract Details (Employment + Deductions) ------------------------- */
function ContractDetailsStep({ form, branches, onChange }) {
  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field">
          <label>Position *</label>
          <input className="input" name="position" value={form.position} onChange={onChange} required />
        </div>

        <div className="field">
          <label>Department</label>
          <input className="input" name="department" value={form.department} onChange={onChange} />
        </div>

        {/* ✅ Area, Region, Division */}
        <div className="field">
          <label>Area</label>
          <input className="input" name="area" value={form.area} onChange={onChange} />
        </div>

        <div className="field">
          <label>Region</label>
          <input className="input" name="region" value={form.region} onChange={onChange} />
        </div>

        <div className="field">
          <label>Division</label>
          <input className="input" name="division" value={form.division} onChange={onChange} />
        </div>

        {/* ✅ Branch dropdown shows NAME only */}
        <div className="field">
          <label>Branch</label>
          <select className="input" name="branch_id" value={form.branch_id} onChange={onChange}>
            <option value="">Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Status</label>
          <select className="input" name="status" value={form.status} onChange={onChange}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="field">
          <label>Start Date</label>
          <input className="input" name="start_date" type="date" value={form.start_date} onChange={onChange} />
        </div>

        <div className="field">
          <label>Regularization Date</label>
          <input className="input" name="regularization_date" type="date" value={form.regularization_date} onChange={onChange} />
        </div>

        <div className="field">
          <label>CBU</label>
          <input className="input" name="cbu" value={form.cbu} onChange={onChange} />
        </div>

        <div className="field">
          <label>Cashbond</label>
          <input className="input" name="cashbond" value={form.cashbond} onChange={onChange} />
        </div>

        <div className="field">
          <label>Utility</label>
          <input className="input" name="utility" value={form.utility} onChange={onChange} />
        </div>

        <div className="field">
          <label>Transportation</label>
          <input className="input" name="transportation" value={form.transportation} onChange={onChange} />
        </div>

        <div className="field">
          <label>Postage</label>
          <input className="input" name="postage" value={form.postage} onChange={onChange} />
        </div>

        <div className="field">
          <label>Motorcycle Loan</label>
          <input className="input" name="motorcycle_loan" value={form.motorcycle_loan} onChange={onChange} />
        </div>

        <div className="field">
          <label>Additional Target</label>
          <input className="input" name="additional_target" value={form.additional_target} onChange={onChange} />
        </div>

        <div className="field">
          <label>Repairing</label>
          <input className="input" name="repairing" value={form.repairing} onChange={onChange} />
        </div>

        <div className="field">
          <label>Additional Monitoring</label>
          <input className="input" name="additional_monitoring" value={form.additional_monitoring} onChange={onChange} />
        </div>

        <div className="field">
          <label>Motorcycle</label>
          <input className="input" name="motorcycle" value={form.motorcycle} onChange={onChange} />
        </div>

        <div className="field">
          <label>Other Deduction</label>
          <input className="input" name="other_deduction" value={form.other_deduction} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Profile Modal ------------------------- */
function StaffProfileModal({ staff, avatarUrl, onClose, branchNameById }) {
  const [tab, setTab] = useState("staff");

  // placeholders for future routes
  const [leaveRows, setLeaveRows] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);

  const [loadingLeave, setLoadingLeave] = useState(false);
  const [loadingAttach, setLoadingAttach] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);

  const [errLeave, setErrLeave] = useState("");
  const [errAttach, setErrAttach] = useState("");
  const [errHist, setErrHist] = useState("");

  const TabButton = ({ id, label }) => (
    <button className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)} type="button">
      {label}
    </button>
  );

  const EmptyState = ({ title, hint }) => (
    <div style={{ padding: 14, opacity: 0.9 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>
    </div>
  );

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
        <div className="modal-head">
          <div>
            <h3>Staff Profile</h3>
            <div className="mini">
              {displayName(staff)} • {staff.position || "-"} • {staff.status || "Active"}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="modal-body staff-profile-scroll">
          <div className="staff-view-top">
            {avatarUrl(staff) ? (
              <img className="staff-avatar-lg" src={avatarUrl(staff)} alt="staff" />
            ) : (
              <div className="staff-avatar-lg staff-avatar--fallback">{displayName(staff).slice(0, 1).toUpperCase()}</div>
            )}
          </div>

          {/* ✅ Tabs will not disappear */}
          <div className="staff-tabs" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TabButton id="staff" label="Staff Details" />
            <TabButton id="contract" label="Contract Details" />
            <TabButton id="leave" label="Leave Details" />
            <TabButton id="attachments" label="Attachments" />
            <TabButton id="history" label="Transaction History" />
          </div>

          <br />

          {tab === "staff" && (
            <table className="profile-table">
              <tbody>
                <tr><td><h2>Employee Details</h2></td></tr>
                <tr><td>ID</td><td>{staff.id}</td></tr>
                <tr><td>Employee No</td><td>{staff.employee_no || "-"}</td></tr>
                <tr><td>Name</td><td>{displayName(staff)}</td></tr>
                <tr><td>Deployment Date</td><td>{fmtDate(staff.start_date)}</td></tr>
                <tr><td>Address</td><td>{staff.address || "-"}</td></tr>
                <tr><td>Municipality</td><td>{staff.municipality || "-"}</td></tr>
                <tr><td>Province</td><td>{staff.province || "-"}</td></tr>
                <tr><td>Contact</td><td>{staff.contact || "-"}</td></tr>
                <tr><td>Email</td><td>{staff.email || "-"}</td></tr>

                <tr><td><h2>Employee Background</h2></td></tr>
                <tr><td>Date of Birth</td><td>{fmtDate(staff.date_of_birth)}</td></tr>
                <tr><td>Place of Birth</td><td>{staff.place_of_birth || "-"}</td></tr>
                <tr><td>Gender</td><td>{staff.gender || "-"}</td></tr>
                <tr><td>Civil Status</td><td>{staff.civil_status || "-"}</td></tr>
                <tr><td>Citizenship</td><td>{staff.citizenship || "-"}</td></tr>
                <tr><td>Height</td><td>{toStr(staff.height) || "-"}</td></tr>
                <tr><td>Weight</td><td>{toStr(staff.weight) || "-"}</td></tr>
                <tr><td>Religion</td><td>{staff.religion || "-"}</td></tr>
                <tr><td>Blood Type</td><td>{staff.blood_type || "-"}</td></tr>
              </tbody>
            </table>
          )}

          {tab === "contract" && (
            <table className="profile-table">
              <tbody>
                <tr><td><h2>Others</h2></td></tr>
                <tr><td>Position</td><td>{staff.position || "-"}</td></tr>
                <tr><td>Branch</td><td>{branchNameById(staff.branch_id) || "-"}</td></tr>
                <tr><td>Department</td><td>{staff.department || "-"}</td></tr>
                <tr><td>Area</td><td>{staff.area || "-"}</td></tr>
                <tr><td>Region</td><td>{staff.region || "-"}</td></tr>
                <tr><td>Division</td><td>{staff.division || "-"}</td></tr>

                <tr><td>Status</td><td>{staff.status || "Active"}</td></tr>
                <tr><td>Start Date</td><td>{fmtDate(staff.start_date)}</td></tr>
                <tr><td>Regularization Date</td><td>{fmtDate(staff.regularization_date)}</td></tr>

                <tr><td><h2>Salary Details</h2></td></tr>
                <tr><td>Basic Salary</td><td>{toNum(staff.salary).toLocaleString()}</td></tr>
                <tr><td>Ecola</td><td>{toNum(staff.ecola).toLocaleString()}</td></tr>
                <tr><td><h3>Total</h3></td><td>{toNum(staff.total).toLocaleString()}</td></tr>

                <tr><td><h2>Personal Deductions</h2></td></tr>
                <tr><td>CBU</td><td>{toNum(staff.cbu).toLocaleString()}</td></tr>
                <tr><td>Cashbond</td><td>{toNum(staff.cashbond).toLocaleString()}</td></tr>
                <tr><td>Utility</td><td>{toNum(staff.utility_charge ?? staff.utility).toLocaleString()}</td></tr>
                <tr><td><h3>Total</h3></td><td>{toNum(staff.total).toLocaleString()}</td></tr>

                <tr><td><h2>Transportation & Allowances</h2></td></tr>
                <tr><td>Transportation</td><td>{toNum(staff.transportation).toLocaleString()}</td></tr>
                <tr><td>Repairing</td><td>{toNum(staff.repairing).toLocaleString()}</td></tr>
                <tr><td>Postage</td><td>{toNum(staff.postage).toLocaleString()}</td></tr>
                <tr><td>Others</td><td>{toNum(staff.other_deduction).toLocaleString()}</td></tr>
                <tr><td><h3>Total</h3></td><td>{toNum(staff.total).toLocaleString()}</td></tr>

                <tr><td><h2>Remittances: ER</h2></td></tr>
                <tr><td>SSS</td><td>{toNum(staff.sss_er).toLocaleString()}</td></tr>
                <tr><td>Philhealth</td><td>{toNum(staff.ph_er).toLocaleString()}</td></tr>
                <tr><td>HDMF</td><td>{toNum(staff.hdmf_er).toLocaleString()}</td></tr>
                <tr><td><h3>Total</h3></td><td>{toNum(staff.total_er).toLocaleString()}</td></tr>

                <tr><td><h2>Remittances: EE</h2></td></tr>
                <tr><td>SSS</td><td>{toNum(staff.sss_ee).toLocaleString()}</td></tr>
                <tr><td>Philhealth</td><td>{toNum(staff.ph_ee).toLocaleString()}</td></tr>
                <tr><td>HDMF</td><td>{toNum(staff.hdmf_ee).toLocaleString()}</td></tr>
                <tr><td><h3>Total</h3></td><td>{toNum(staff.total_ee).toLocaleString()}</td></tr>

                <tr><td><h2>Remittances: Tax</h2></td></tr>
                <tr><td>With Held Tax</td><td>{toNum(staff.tax).toLocaleString()}</td></tr>
              </tbody>
            </table>
          )}

          {tab === "leave" && (
            <>
              {loadingLeave ? (
                <div className="empty-state">Loading leave details…</div>
              ) : errLeave ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errLeave}</div>
              ) : leaveRows.length === 0 ? (
                <EmptyState title="No leave details yet." hint="Add your leave routes later and this will show records." />
              ) : (
                <div />
              )}
            </>
          )}

          {tab === "attachments" && (
            <>
              {loadingAttach ? (
                <div className="empty-state">Loading attachments…</div>
              ) : errAttach ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errAttach}</div>
              ) : attachments.length === 0 ? (
                <EmptyState title="No attachments yet." hint="Add upload routes later and this will show files." />
              ) : (
                <div />
              )}
            </>
          )}

          {tab === "history" && (
            <>
              {loadingHist ? (
                <div className="empty-state">Loading transaction history…</div>
              ) : errHist ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errHist}</div>
              ) : historyRows.length === 0 ? (
                <EmptyState title="No transaction history yet." hint="Once you log transfers/demotions/exits/etc. this can show records." />
              ) : (
                <div />
              )}
            </>
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

/* ------------------------- Main Page ------------------------- */
export default function StaffInformation() {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [viewStaff, setViewStaff] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editStaff, setEditStaff] = useState(null);

  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [formStep, setFormStep] = useState(1);
  const base = useMemo(() => getBase(), []);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const branchNameById = useCallback(
    (id) => {
      if (id == null || id === "") return "";
      const b = branchMap.get(String(id));
      return b ? b.name : String(id);
    },
    [branchMap]
  );

  const [form, setForm] = useState({
    employee_no: "",
    last_name: "",
    first_name: "",
    middle_name: "",

    address: "",
    municipality: "",
    province: "",
    contact: "",
    email: "",
    date_of_birth: "",
    place_of_birth: "",
    gender: "",
    civil_status: "",
    citizenship: "",
    height: "",
    weight: "",
    religion: "",
    blood_type: "",

    position: "",
    department: "",
    area: "",
    region: "",
    division: "",
    branch_id: "",
    status: "Active",

    start_date: "",
    regularization_date: "",

    cbu: "",
    cashbond: "",
    utility: "",

    transportation: "",
    postage: "",
    motorcycle_loan: "",
    additional_target: "",
    repairing: "",
    additional_monitoring: "",
    motorcycle: "",
    other_deduction: "",
  });

  const avatarUrl = (s) => {
    const p = s?.photo_url;
    if (!p) return "";
    if (String(p).startsWith("http")) return p;
    return `${base}${p}`;
  };

  const resetForm = () => {
    setForm({
      employee_no: "",
      last_name: "",
      first_name: "",
      middle_name: "",

      address: "",
      municipality: "",
      province: "",
      contact: "",
      email: "",
      date_of_birth: "",
      place_of_birth: "",
      gender: "",
      civil_status: "",
      citizenship: "",
      height: "",
      weight: "",
      religion: "",
      blood_type: "",

      position: "",
      department: "",
      area: "",
      region: "",
      division: "",
      branch_id: "",
      status: "Active",

      start_date: "",
      regularization_date: "",

      cbu: "",
      cashbond: "",
      utility: "",

      transportation: "",
      postage: "",
      motorcycle_loan: "",
      additional_target: "",
      repairing: "",
      additional_monitoring: "",
      motorcycle: "",
      other_deduction: "",
    });
    setPhotoFile(null);
    setPhotoPreview("");
    setFormStep(1);
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

  const loadAll = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
      const st = String(s.status || "Active");
      if (statusFilter !== "All" && st !== statusFilter) return false;
      if (!q) return true;

      const hay = [
        s.id,
        s.employee_no,
        s.fullname,
        s.last_name,
        s.first_name,
        s.middle_name,
        s.position,
        s.department,
        s.area,
        s.region,
        s.division,
        s.branch_id,
        branchNameById(s.branch_id),
        s.status,
        s.address,
        s.municipality,
        s.province,
        s.contact,
        s.email,
      ]
        .map((x) => norm(x))
        .join(" ");

      return hay.includes(q);
    });
  }, [staff, search, statusFilter, branchNameById]);

  const isStaffStepValid = useMemo(() => !!toStr(form.last_name) && !!toStr(form.first_name), [form.last_name, form.first_name]);
  const isContractStepValid = useMemo(() => !!toStr(form.position), [form.position]);

  const setStepGuarded = (nextStep) => {
    if (nextStep === 2 && !isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      return;
    }
    setFormStep(nextStep);
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (s) => {
    setEditStaff(s);

    setForm({
      employee_no: s.employee_no || "",
      last_name: s.last_name || "",
      first_name: s.first_name || "",
      middle_name: s.middle_name || "",

      address: String(s.address ?? ""),
      municipality: String(s.municipality ?? ""),
      province: String(s.province ?? ""),
      contact: String(s.contact ?? ""),
      email: String(s.email ?? ""),
      date_of_birth: s.date_of_birth ? String(s.date_of_birth).split("T")[0] : "",
      place_of_birth: String(s.place_of_birth ?? ""),
      gender: String(s.gender ?? ""),
      civil_status: String(s.civil_status ?? ""),
      citizenship: String(s.citizenship ?? ""),
      height: String(s.height ?? ""),
      weight: String(s.weight ?? ""),
      religion: String(s.religion ?? ""),
      blood_type: String(s.blood_type ?? ""),

      position: s.position || "",
      department: s.department || "",
      area: String(s.area ?? ""),
      region: String(s.region ?? ""),
      division: String(s.division ?? ""),
      branch_id: String(s.branch_id ?? ""),
      status: String(s.status || "Active"),

      start_date: s.start_date ? String(s.start_date).split("T")[0] : "",
      regularization_date: s.regularization_date ? String(s.regularization_date).split("T")[0] : "",

      cbu: String(s.cbu ?? ""),
      cashbond: String(s.cashbond ?? ""),
      utility: String(s.utility_charge ?? s.utility ?? ""),

      transportation: String(s.transportation ?? ""),
      postage: String(s.postage ?? ""),
      motorcycle_loan: String(s.motorcycle_loan ?? ""),
      additional_target: String(s.additional_target ?? ""),
      repairing: String(s.repairing ?? ""),
      additional_monitoring: String(s.additional_monitoring ?? ""),
      motorcycle: String(s.motorcycle ?? ""),
      other_deduction: String(s.other_deduction ?? ""),
    });

    setPhotoPreview(s.photo_url ? avatarUrl(s) : "");
    setPhotoFile(null);
    setFormStep(1);
  };

  const buildPayload = () => ({
    ...form,
    branch_id: form.branch_id ? Number(form.branch_id) : null,

    date_of_birth: form.date_of_birth || null,
    start_date: form.start_date || null,
    regularization_date: form.regularization_date || null,

    height: form.height === "" ? null : Number(form.height),
    weight: form.weight === "" ? null : Number(form.weight),

    cbu: toNum(form.cbu),
    cashbond: toNum(form.cashbond),
    utility: toNum(form.utility),

    transportation: toNum(form.transportation),
    postage: toNum(form.postage),
    motorcycle_loan: toNum(form.motorcycle_loan),
    additional_target: toNum(form.additional_target),
    repairing: toNum(form.repairing),
    additional_monitoring: toNum(form.additional_monitoring),
    motorcycle: toNum(form.motorcycle),
    other_deduction: toNum(form.other_deduction),
  });

  const saveStaff = async (e) => {
    e.preventDefault();

    if (!isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      setFormStep(1);
      return;
    }

    if (formStep !== 2) {
      setFormStep(2);
      return;
    }

    if (!isContractStepValid) {
      alert("Position is required in Contract Details.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await api.post("/staff", payload);
      const newId = res.data?.id;

      if (photoFile && newId) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await api.post(`/staff/${newId}/photo`, fd);
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

    if (!isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      setFormStep(1);
      return;
    }

    if (formStep !== 2) {
      setFormStep(2);
      return;
    }

    if (!isContractStepValid) {
      alert("Position is required in Contract Details.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      await api.put(`/staff/${editStaff.id}`, payload);

      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await api.post(`/staff/${editStaff.id}/photo`, fd);
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

  const statusBadgeClass = (s) =>
    String(s || "Active") === "Inactive" ? "status-badge inactive" : "status-badge active";

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
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <input
            className="input"
            placeholder="Search by ID, name, position, department, area, region, division, branch..."
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
                  <th style={{ width: 180 }}>Region</th>
                  <th style={{ width: 180 }}>Division</th>
                  <th style={{ width: 200 }}>Branch</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 140 }}>Start Date</th>
                  <th style={{ width: 140 }}>Regularized</th>
                  <th style={{ width: 260 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="empty">
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
                          <div className="staff-avatar staff-avatar--fallback">
                            {displayName(s).slice(0, 1).toUpperCase() || "?"}
                          </div>
                        )}
                      </td>

                      <td className="mono">{s.id}</td>
                      <td className="mono">{s.employee_no || "-"}</td>
                      <td className="strong">{displayName(s)}</td>
                      <td>{s.position || "-"}</td>
                      <td>{s.department || "-"}</td>
                      <td>{s.area || "-"}</td>
                      <td>{s.region || "-"}</td>
                      <td>{s.division || "-"}</td>
                      <td>{branchNameById(s.branch_id) || "-"}</td>

                      <td>
                        <span className={statusBadgeClass(s.status)}>{String(s.status || "Active")}</span>
                      </td>

                      <td>{fmtDate(s.start_date)}</td>
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

      {viewStaff && (
        <StaffProfileModal
          staff={viewStaff}
          avatarUrl={avatarUrl}
          onClose={closeAllModals}
          branchNameById={branchNameById}
        />
      )}

      {/* ------------------------- Add Staff (2-Step) ------------------------- */}
      {showAdd && (
        <div className="modal-overlay" onMouseDown={closeAllModals}>
          <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
            <div className="modal-head">
              <div>
                <h3>Add Staff</h3>
                <div className="mini">
                  {displayFormName(form)} • {form.position || "-"} • {form.status || "Active"}
                </div>
              </div>
              <button className="icon-btn" onClick={closeAllModals} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={saveStaff}>
              <div className="modal-body staff-profile-scroll">
                <div className="staff-view-top">
                  {photoPreview ? (
                    <img className="staff-avatar-lg" src={photoPreview} alt="staff" />
                  ) : (
                    <div className="staff-avatar-lg staff-avatar--fallback">
                      {(toStr(form.last_name || form.first_name || "?").slice(0, 1).toUpperCase() || "?")}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 10 }}>
                  <label className="btn btn-outline photo-upload">
                    Upload Photo
                    <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <StepTabs step={formStep} onSelectStep={setStepGuarded} canGoContract={isStaffStepValid} />
                <br />

                {formStep === 1 ? (
                  <StaffDetailsStep form={form} onChange={onChange} />
                ) : (
                  <ContractDetailsStep form={form} branches={branches} onChange={onChange} />
                )}
              </div>

              <div className="modal-foot">
                {formStep === 1 ? (
                  <>
                    <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(2)} disabled={!isStaffStepValid}>
                      Next
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-outline" type="button" onClick={() => setFormStep(1)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Staff"}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------- Edit Staff (2-Step) ------------------------- */}
      {editStaff && (
        <div className="modal-overlay" onMouseDown={closeAllModals}>
          <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
            <div className="modal-head">
              <div>
                <h3>Edit Staff</h3>
                <div className="mini">
                  {displayFormName(form) || displayName(editStaff)} • {form.position || "-"} • {form.status || "Active"}
                </div>
              </div>
              <button className="icon-btn" onClick={closeAllModals} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={updateStaff}>
              <div className="modal-body staff-profile-scroll">
                <div className="staff-view-top">
                  {photoPreview ? (
                    <img className="staff-avatar-lg" src={photoPreview} alt="staff" />
                  ) : (
                    <div className="staff-avatar-lg staff-avatar--fallback">
                      {(toStr(form.last_name || form.first_name || "?").slice(0, 1).toUpperCase() || "?")}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 10 }}>
                  <label className="btn btn-outline photo-upload">
                    Upload Photo
                    <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <StepTabs step={formStep} onSelectStep={setStepGuarded} canGoContract={isStaffStepValid} />
                <br />

                {formStep === 1 ? (
                  <StaffDetailsStep form={form} onChange={onChange} />
                ) : (
                  <ContractDetailsStep form={form} branches={branches} onChange={onChange} />
                )}
              </div>

              <div className="modal-foot">
                {formStep === 1 ? (
                  <>
                    <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(2)} disabled={!isStaffStepValid}>
                      Next
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-outline" type="button" onClick={() => setFormStep(1)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? "Updating..." : "Update Staff"}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}