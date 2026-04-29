import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/StaffInformation.css";
import api from "../api/axiosClient";

import StepTabs from "./StaffInformation/StepTabs";
import StaffDetailsStep from "./StaffInformation/StaffDetailsStep";
import ContractDetailsStep from "./StaffInformation/ContractDetailsStep";
import PersonalBalancesStep from "./StaffInformation/PersonalBalancesStep";
import StaffProfileModal from "./StaffInformation/StaffProfileModal";
import useStaffSignedUrls from "./StaffInformation/useStaffSignedUrls";
import {
  safeJsonArray,
  toStr,
  norm,
  fmtDate,
  toNum,
  displayName,
  displayFormName,
} from "./StaffInformation/staffInfoUtils";

export default function StaffInformation() {
  const readUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  };

  const user = useMemo(() => readUser(), []);
  const role = useMemo(() => norm(user?.role), [user]);

  const CONFIDENTIAL_POSITIONS = [
    "vice president",
    "senior vice president",
    "president",
  ];

  const isConfidentialStaff = (s) =>
    CONFIDENTIAL_POSITIONS.includes(norm(s?.position)) ||
    CONFIDENTIAL_POSITIONS.includes(norm(s?.role));

  const canViewConfidentialDetails = (s) => {
    if (!isConfidentialStaff(s)) return true;
    return role === "admin" || role === norm(s?.position) || role === norm(s?.role);
  };

  const canEditStaff =
    role === "admin" ||
    role === "hr" ||
    role === "accounting" ||
    role === "branch manager" ||
    role === "area manager" ||
    role === "regional manager" ||
    role === "assistant vice president";

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positionRates, setPositionRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchSearch, setBranchSearch] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [viewStaff, setViewStaff] = useState(null);
  const [editStaff, setEditStaff] = useState(null);

  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [formStep, setFormStep] = useState(1);

  const [balanceForm, setBalanceForm] = useState({
    cbu: "",
    cashbond: "",
    utility: "",
    salary_advance: "",
    special_advance: "",
    cash_advance: "",
    motorcycle_loan: "",
    pag_ibig_loan: "",
    other_receivable: "",
    staff_accounts_payable: "",
  });

  const signedUrls = useStaffSignedUrls(staff);

  const branchMapById = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const branchMapByCode = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => {
      if (b.code) m.set(norm(b.code), b);
    });
    return m;
  }, [branches]);

  const findBranch = useCallback(
    (branchValue) => {
      const raw = String(branchValue ?? "").trim();
      if (!raw) return null;

      return branchMapById.get(raw) || branchMapByCode.get(norm(raw)) || null;
    },
    [branchMapById, branchMapByCode]
  );

  const branchNameById = useCallback(
    (id) => {
      if (id == null || id === "") return "";
      const b = findBranch(id);
      return b ? b.name : String(id);
    },
    [findBranch]
  );

  const sameBranch = useCallback(
    (staffBranchValue, userBranchValue) => {
      const staffRaw = String(staffBranchValue ?? "").trim();
      const userRaw = String(userBranchValue ?? "").trim();

      if (!staffRaw || !userRaw) return false;

      if (staffRaw === userRaw) return true;
      if (norm(staffRaw) === norm(userRaw)) return true;

      const staffBranch = findBranch(staffRaw);
      const userBranch = findBranch(userRaw);

      if (!staffBranch || !userBranch) return false;

      return String(staffBranch.id) === String(userBranch.id);
    },
    [findBranch]
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
    spouse_fullname: "",
    spouse_address: "",
    spouse_occupation: "",
    spouse_employer: "",
    sss_no: "",
    philhealth_no: "",
    pagibig_no: "",
    tin_no: "",
    father_fullname: "",
    father_address: "",
    father_occupation: "",
    father_employer: "",
    father_contact: "",
    mother_fullname: "",
    mother_address: "",
    mother_occupation: "",
    mother_employer: "",
    mother_contact: "",
    guardian_fullname: "",
    guardian_address: "",
    guardian_occupation: "",
    guardian_employer: "",
    guardian_contact: "",
    children: "[]",
    education: "[]",
    employment_history: "[]",
    beneficiaries: "[]",
    position: "",
    department: "",
    area: "",
    region: "",
    division: "",
    branch_id: "",
    status: "Active",
    start_date: "",
    regularization_date: "",
    salary: "",
    ecola: "",
    cbu: "",
    cashbond: "",
    utility: "",
    utility_charge: "",
    transportation: "",
    postage: "",
    additional_target: "",
    repairing: "",
    additional_monitoring: "",
    other_deduction: "",
    sss_er: "",
    ph_er: "",
    hdmf_er: "",
    sss_ee: "",
    ph_ee: "",
    hdmf_ee: "",
    tax: "",
  });

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
      spouse_fullname: "",
      spouse_address: "",
      spouse_occupation: "",
      spouse_employer: "",
      sss_no: "",
      philhealth_no: "",
      pagibig_no: "",
      tin_no: "",
      father_fullname: "",
      father_address: "",
      father_occupation: "",
      father_employer: "",
      father_contact: "",
      mother_fullname: "",
      mother_address: "",
      mother_occupation: "",
      mother_employer: "",
      mother_contact: "",
      guardian_fullname: "",
      guardian_address: "",
      guardian_occupation: "",
      guardian_employer: "",
      guardian_contact: "",
      children: "[]",
      education: "[]",
      employment_history: "[]",
      beneficiaries: "[]",
      position: "",
      department: "",
      area: "",
      region: "",
      division: "",
      branch_id: "",
      status: "Active",
      start_date: "",
      regularization_date: "",
      salary: "",
      ecola: "",
      cbu: "",
      cashbond: "",
      utility: "",
      utility_charge: "",
      transportation: "",
      postage: "",
      additional_target: "",
      repairing: "",
      additional_monitoring: "",
      other_deduction: "",
      sss_er: "",
      ph_er: "",
      hdmf_er: "",
      sss_ee: "",
      ph_ee: "",
      hdmf_ee: "",
      tax: "",
    });

    setBalanceForm({
      cbu: "",
      cashbond: "",
      utility: "",
      salary_advance: "",
      special_advance: "",
      cash_advance: "",
      motorcycle_loan: "",
      pag_ibig_loan: "",
      other_receivable: "",
      staff_accounts_payable: "",
    });

    setPhotoFile(null);
    setPhotoPreview("");
    setFormStep(1);
  };

  const closeAllModals = () => {
    setViewStaff(null);
    setEditStaff(null);
    resetForm();
  };

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onBalanceChange = (e) =>
    setBalanceForm((p) => ({ ...p, [e.target.name]: e.target.value }));

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
      const [staffRes, branchesRes] = await Promise.allSettled([
        api.get("/staff"),
        api.get("/branches"),
      ]);

      if (staffRes.status === "fulfilled") {
        setStaff(Array.isArray(staffRes.value.data) ? staffRes.value.data : []);
      } else {
        setStaff([]);
        setError(
          staffRes.reason?.response?.data?.message ||
            staffRes.reason?.message ||
            "Failed to load staff data."
        );
      }

      if (branchesRes.status === "fulfilled") {
        setBranches(Array.isArray(branchesRes.value.data) ? branchesRes.value.data : []);
      } else {
        setBranches([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPositionRates = useCallback(async () => {
    try {
      const res = await api.get("/comp-rates");
      setPositionRates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPositionRates([]);
    }
  }, []);

  useEffect(() => {
    loadAll();
    loadPositionRates();
  }, [loadAll, loadPositionRates]);

  useEffect(() => {
    const isAnyModalOpen = !!viewStaff || !!editStaff;
    if (!isAnyModalOpen) return;

    const onKey = (e) => e.key === "Escape" && closeAllModals();

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [viewStaff, editStaff]);

  const filteredStaff = useMemo(() => {
    const q = norm(search);

    return staff.filter((s) => {
      const userBranch = String(user?.branch_id || "");
      const userArea = norm(user?.area);
      const userRegion = norm(user?.region);
      const userDivision = norm(user?.division);

      const staffBranch = String(s?.branch_id || "");
      const staffArea = norm(s?.area);
      const staffRegion = norm(s?.region);
      const staffDivision = norm(s?.division);

      if (role === "branch manager") {
        if (!sameBranch(staffBranch, userBranch)) return false;
      }

      if (role === "area manager" && staffArea !== userArea) return false;
      if (role === "regional manager" && staffRegion !== userRegion) return false;
      if (role === "assistant vice president" && staffDivision !== userDivision) return false;

      const st = String(s.status || "Active");
      if (statusFilter !== "All" && st !== statusFilter) return false;

      if (!q) return true;

      const branch = findBranch(s.branch_id);

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
        branch?.id,
        branch?.code,
        branch?.name,
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
  }, [
    staff,
    search,
    statusFilter,
    role,
    user,
    sameBranch,
    findBranch,
  ]);

  const isStaffStepValid = useMemo(
    () => !!toStr(form.last_name) && !!toStr(form.first_name),
    [form.last_name, form.first_name]
  );

  const isContractStepValid = useMemo(
    () => !!toStr(form.position),
    [form.position]
  );

  const setStepGuarded = (nextStep) => {
    if (nextStep === 2 && !isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      return;
    }

    if (nextStep === 3 && !isContractStepValid) {
      alert("Position is required in Contract Details.");
      return;
    }

    setFormStep(nextStep);
  };

  const openEdit = async (s) => {
    if (!canEditStaff) {
      alert("Only Admin, HR, Accounting, and Branch Manager can edit staff.");
      return;
    }

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
      date_of_birth: s.date_of_birth ? String(s.date_of_birth).slice(0, 10) : "",
      place_of_birth: String(s.place_of_birth ?? ""),
      gender: String(s.gender ?? ""),
      civil_status: String(s.civil_status ?? ""),
      citizenship: String(s.citizenship ?? ""),
      height: String(s.height ?? ""),
      weight: String(s.weight ?? ""),
      religion: String(s.religion ?? ""),
      blood_type: String(s.blood_type ?? ""),
      spouse_fullname: String(s.spouse_fullname ?? ""),
      spouse_address: String(s.spouse_address ?? ""),
      spouse_occupation: String(s.spouse_occupation ?? ""),
      spouse_employer: String(s.spouse_employer ?? ""),
      sss_no: String(s.sss_no ?? ""),
      philhealth_no: String(s.philhealth_no ?? ""),
      pagibig_no: String(s.pagibig_no ?? ""),
      tin_no: String(s.tin_no ?? ""),
      father_fullname: String(s.father_fullname ?? ""),
      father_address: String(s.father_address ?? ""),
      father_occupation: String(s.father_occupation ?? ""),
      father_employer: String(s.father_employer ?? ""),
      father_contact: String(s.father_contact ?? ""),
      mother_fullname: String(s.mother_fullname ?? ""),
      mother_address: String(s.mother_address ?? ""),
      mother_occupation: String(s.mother_occupation ?? ""),
      mother_employer: String(s.mother_employer ?? ""),
      mother_contact: String(s.mother_contact ?? ""),
      guardian_fullname: String(s.guardian_fullname ?? ""),
      guardian_address: String(s.guardian_address ?? ""),
      guardian_occupation: String(s.guardian_occupation ?? ""),
      guardian_employer: String(s.guardian_employer ?? ""),
      guardian_contact: String(s.guardian_contact ?? ""),
      children:
        typeof s.children === "string"
          ? s.children
          : JSON.stringify(s.children ?? [], null, 2),
      education:
        typeof s.education === "string"
          ? s.education
          : JSON.stringify(s.education ?? [], null, 2),
      employment_history:
        typeof s.employment_history === "string"
          ? s.employment_history
          : JSON.stringify(s.employment_history ?? [], null, 2),
      beneficiaries:
        typeof s.beneficiaries === "string"
          ? s.beneficiaries
          : JSON.stringify(s.beneficiaries ?? [], null, 2),

      position: String(s.position ?? ""),
      department: String(s.department ?? ""),
      area: String(s.area ?? ""),
      region: String(s.region ?? ""),
      division: String(s.division ?? ""),
      branch_id: s.branch_id ? String(s.branch_id) : "",
      status: String(s.status ?? "Active"),
      start_date: s.start_date ? String(s.start_date).slice(0, 10) : "",
      regularization_date: s.regularization_date
        ? String(s.regularization_date).slice(0, 10)
        : "",
      salary: String(s.salary ?? ""),
      ecola: String(s.ecola ?? ""),
      cbu: String(s.cbu ?? ""),
      cashbond: String(s.cashbond ?? ""),
      utility: String(s.utility ?? s.utility_charge ?? ""),
      utility_charge: String(s.utility_charge ?? s.utility ?? ""),
      transportation: String(s.transportation ?? ""),
      repairing: String(s.repairing ?? ""),
      postage: String(s.postage ?? ""),
      additional_target: String(s.additional_target ?? ""),
      additional_monitoring: String(s.additional_monitoring ?? ""),
      other_deduction: String(s.other_deduction ?? ""),
      sss_er: String(s.sss_er ?? ""),
      ph_er: String(s.ph_er ?? ""),
      hdmf_er: String(s.hdmf_er ?? ""),
      sss_ee: String(s.sss_ee ?? ""),
      ph_ee: String(s.ph_ee ?? ""),
      hdmf_ee: String(s.hdmf_ee ?? ""),
      tax: String(s.tax ?? ""),
    });

    let balanceRow = null;

    try {
      const res = await api.get(`/staff-balances/${s.employee_no}`);
      balanceRow = res.data || null;
    } catch {
      balanceRow = null;
    }

    setBalanceForm({
      cbu: String(balanceRow?.cbu ?? s.cbu ?? ""),
      cashbond: String(balanceRow?.cashbond ?? s.cashbond ?? ""),
      utility: String(
        balanceRow?.utility ??
          balanceRow?.utility_charge ??
          s.utility_charge ??
          s.utility ??
          ""
      ),
      utility_charge: String(
        balanceRow?.utility_charge ??
          balanceRow?.utility ??
          s.utility_charge ??
          s.utility ??
          ""
      ),
      salary_advance: String(balanceRow?.salary_advance ?? s.salary_advance ?? ""),
      special_advance: String(balanceRow?.special_advance ?? s.special_advance ?? ""),
      cash_advance: String(balanceRow?.cash_advance ?? s.cash_advance ?? ""),
      motorcycle_loan: String(balanceRow?.motorcycle_loan ?? s.motorcycle_loan ?? ""),
      pag_ibig_loan: String(balanceRow?.pag_ibig_loan ?? s.pag_ibig_loan ?? ""),
      other_receivable: String(balanceRow?.other_receivable ?? s.other_receivable ?? ""),
      staff_accounts_payable: String(
        balanceRow?.staff_accounts_payable ?? s.staff_accounts_payable ?? ""
      ),
    });

    const selectedBranch = findBranch(s.branch_id);

    setBranchSearch(
      selectedBranch
        ? `${toStr(selectedBranch.code)} - ${toStr(selectedBranch.name)}`.trim()
        : ""
    );

    setPhotoPreview("");
    setFormStep(1);
  };

  const buildPayload = () => {
    const total_er = toNum(form.sss_er) + toNum(form.ph_er) + toNum(form.hdmf_er);
    const total_ee = toNum(form.sss_ee) + toNum(form.ph_ee) + toNum(form.hdmf_ee);

    return {
      ...form,
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      date_of_birth: form.date_of_birth || null,
      start_date: form.start_date || null,
      regularization_date: form.regularization_date || null,
      height: form.height === "" ? null : Number(form.height),
      weight: form.weight === "" ? null : Number(form.weight),
      salary: form.salary === "" ? null : Number(form.salary),
      ecola: form.ecola === "" ? null : Number(form.ecola),

      cbu: toNum(form.cbu),
      cashbond: toNum(form.cashbond),
      utility: toNum(form.utility ?? form.utility_charge),
      utility_charge: toNum(form.utility_charge ?? form.utility),
      transportation: toNum(form.transportation),
      postage: toNum(form.postage),

      additional_target: toNum(form.additional_target),
      repairing: toNum(form.repairing),
      additional_monitoring: toNum(form.additional_monitoring),
      other_deduction: toNum(form.other_deduction),
      sss_er: toNum(form.sss_er),
      ph_er: toNum(form.ph_er),
      hdmf_er: toNum(form.hdmf_er),
      total_er,
      sss_ee: toNum(form.sss_ee),
      ph_ee: toNum(form.ph_ee),
      hdmf_ee: toNum(form.hdmf_ee),
      total_ee,
      tax: toNum(form.tax),

      children: safeJsonArray(form.children),
      education: safeJsonArray(form.education),
      employment_history: safeJsonArray(form.employment_history),
      beneficiaries: safeJsonArray(form.beneficiaries),

      spouse_fullname: toStr(form.spouse_fullname) || null,
      spouse_address: toStr(form.spouse_address) || null,
      spouse_occupation: toStr(form.spouse_occupation) || null,
      spouse_employer: toStr(form.spouse_employer) || null,
      sss_no: toStr(form.sss_no) || null,
      philhealth_no: toStr(form.philhealth_no) || null,
      pagibig_no: toStr(form.pagibig_no) || null,
      tin_no: toStr(form.tin_no) || null,
      father_fullname: toStr(form.father_fullname) || null,
      father_address: toStr(form.father_address) || null,
      father_occupation: toStr(form.father_occupation) || null,
      father_employer: toStr(form.father_employer) || null,
      father_contact: toStr(form.father_contact) || null,
      mother_fullname: toStr(form.mother_fullname) || null,
      mother_address: toStr(form.mother_address) || null,
      mother_occupation: toStr(form.mother_occupation) || null,
      mother_employer: toStr(form.mother_employer) || null,
      mother_contact: toStr(form.mother_contact) || null,
      guardian_fullname: toStr(form.guardian_fullname) || null,
      guardian_address: toStr(form.guardian_address) || null,
      guardian_occupation: toStr(form.guardian_occupation) || null,
      guardian_employer: toStr(form.guardian_employer) || null,
      guardian_contact: toStr(form.guardian_contact) || null,
    };
  };

  const buildBalancePayload = () => ({
    cbu: toNum(balanceForm.cbu),
    cashbond: toNum(balanceForm.cashbond),
    utility: toNum(balanceForm.utility ?? balanceForm.utility_charge),
    utility_charge: toNum(balanceForm.utility ?? balanceForm.utility_charge),
    salary_advance: toNum(balanceForm.salary_advance),
    special_advance: toNum(balanceForm.special_advance),
    cash_advance: toNum(balanceForm.cash_advance),
    motorcycle_loan: toNum(balanceForm.motorcycle_loan),
    pag_ibig_loan: toNum(balanceForm.pag_ibig_loan),
    other_receivable: toNum(balanceForm.other_receivable),
    staff_accounts_payable: toNum(balanceForm.staff_accounts_payable),
  });

  const updateStaff = async (e) => {
    e.preventDefault();

    if (!canEditStaff) {
      alert("Only Admin, HR, Accounting, and authorized managers can edit staff.");
      return;
    }

    if (!editStaff) return;

    if (!isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      setFormStep(1);
      return;
    }

    if (formStep === 1) {
      setFormStep(2);
      return;
    }

    if (!isContractStepValid) {
      alert("Position is required in Contract Details.");
      setFormStep(2);
      return;
    }

    if (formStep === 2) {
      setFormStep(3);
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      await api.put(`/staff/${editStaff.id}`, payload);
      await api.put(`/staff-balances/${payload.employee_no}`, buildBalancePayload());

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
    String(s || "Active") === "Inactive"
      ? "status-badge inactive"
      : "status-badge active";

  return (
    <div className="staffinfo-page">
      <div className="staffinfo-header">
        <div>
          <h2>Staff Information</h2>
          <p>View staff, edit staff, upload photo, and set Active/Inactive status.</p>
        </div>

        <div className="staffinfo-actions">
          <button className="btn btn-outline" onClick={loadAll} type="button">
            Refresh
          </button>
        </div>
      </div>

      <div className="card staffinfo-controls">
        <div className="search-wrap" style={{ gap: 10 }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 160 }}
          >
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

          <button
            className="btn btn-outline"
            onClick={() => setSearch(searchInput)}
            type="button"
          >
            Search
          </button>

          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
          >
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
                  <th style={{ width: 90 }}>Slot</th>
                  <th style={{ width: 120 }}>Emp No</th>
                  <th>Name</th>
                  <th style={{ width: 180 }}>Position</th>
                  <th style={{ width: 180 }}>Department</th>
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
                    <td colSpan={11} className="empty">
                      No staff found.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.slice(0, 100).map((s) => {
                    const photoSrc = signedUrls[s.id] || "";

                    return (
                      <tr key={s.id}>
                        <td>
                          {photoSrc ? (
                            <img className="staff-avatar" src={photoSrc} alt="staff" />
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
                        <td>{branchNameById(s.branch_id) || "-"}</td>
                        <td>
                          <span className={statusBadgeClass(s.status)}>
                            {String(s.status || "Active")}
                          </span>
                        </td>
                        <td>{fmtDate(s.start_date)}</td>
                        <td>{fmtDate(s.regularization_date)}</td>
                        <td>
                          <div className="actions">
                            <button
                              className="action-btn btn-view"
                              onClick={() => setViewStaff(s)}
                              type="button"
                            >
                              View
                            </button>

                            <button
                              className="action-btn btn-edit"
                              onClick={() => openEdit(s)}
                              type="button"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewStaff && (
        <StaffProfileModal
          staff={viewStaff}
          signedPhotoUrl={signedUrls[viewStaff.id]}
          onClose={closeAllModals}
          branchNameById={branchNameById}
          canViewPrivateDetails={canViewConfidentialDetails(viewStaff)}
          canEditLeaveDetails={["admin", "hr", "accounting"].includes(role)}
        />
      )}

      {editStaff && (
        <div className="modal-overlay" onMouseDown={closeAllModals}>
          <div
            className="modal staff-profile-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 1200 }}
          >
            <div className="modal-head">
              <div>
                <h3>Edit Staff</h3>
                <div className="mini">
                  {displayFormName(form) || displayName(editStaff)} •{" "}
                  {form.position || "-"} • {form.status || "Active"}
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
                      {toStr(form.last_name || form.first_name || "?")
                        .slice(0, 1)
                        .toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 10,
                    marginBottom: 10,
                  }}
                >
                  <label className="btn btn-outline photo-upload">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <StepTabs
                  step={formStep}
                  onSelectStep={setStepGuarded}
                  canGoContract={canViewConfidentialDetails(editStaff) && isStaffStepValid}
                  canGoBalances={canViewConfidentialDetails(editStaff) && isContractStepValid}
                />

                <br />

                {formStep === 1 && (
                  <StaffDetailsStep form={form} onChange={onChange} />
                )}

                {formStep === 2 && (
                  <ContractDetailsStep
                    form={form}
                    branches={branches}
                    positionRates={positionRates}
                    onChange={onChange}
                    branchSearch={branchSearch}
                    setBranchSearch={setBranchSearch}
                  />
                )}

                {formStep === 3 && (
                  <PersonalBalancesStep
                    balanceForm={balanceForm}
                    onBalanceChange={onBalanceChange}
                  />
                )}
              </div>

              <div className="modal-foot">
                {formStep === 1 && (
                  <>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setStepGuarded(2)}
                      disabled={!isStaffStepValid}
                    >
                      Next
                    </button>

                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}

                {formStep === 2 && (
                  <>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setFormStep(1)}
                    >
                      Back
                    </button>

                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setStepGuarded(3)}
                      disabled={!isContractStepValid}
                    >
                      Next
                    </button>

                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}

                {formStep === 3 && (
                  <>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setFormStep(2)}
                    >
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