import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/axiosClient";
import PersonalBalancesStep from "./PersonalBalancesStep";
import { safeJsonArray, toStr, fmtDate, toNum, money, displayName, loanDisplayDate, compute13thMonthBreakdown, } from "./staffInfoUtils";

export default function StaffProfileModal({ 
  staff, signedPhotoUrl, onClose, branchNameById, 
  canViewPrivateDetails = true, canEditLeaveDetails = false, }) {
    
  const [tab, setTab] = useState("staff");
  const [leaveKind, setLeaveKind] = useState("All");
  const [leaveRows, setLeaveRows] = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [errLeave, setErrLeave] = useState("");

  const [historyKind, setHistoryKind] = useState("All");
  const [loanRows, setLoanRows] = useState([]);
  const [loadingLoan, setLoadingLoan] = useState(false);
  const [errLoan, setErrLoan] = useState("");

  const [transferRows, setTransferRows] = useState([]);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [errTransfer, setErrTransfer] = useState("");

  const [promotionRows, setPromotionRows] = useState([]);
  const [loadingPromotion, setLoadingPromotion] = useState(false);
  const [errPromotion, setErrPromotion] = useState("");

  const [suspensionRows, setSuspensionRows] = useState([]);
  const [loadingSuspension, setLoadingSuspension] = useState(false);
  const [errSuspension, setErrSuspension] = useState("");

  const [sapHistoryRows, setSapHistoryRows] = useState([]);
  const [loadingSapHist, setLoadingSapHist] = useState(false);
  const [errSapHist, setErrSapHist] = useState("");

  const [demotionRows, setDemotionRows] = useState([]);
  const [loadingDemotion, setLoadingDemotion] = useState(false);
  const [errDemotion, setErrDemotion] = useState("");

  const [openingLoanRows, setOpeningLoanRows] = useState([]);
  const [loadingOpeningLoans, setLoadingOpeningLoans] = useState(false);
  const [errOpeningLoans, setErrOpeningLoans] = useState("");

  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [errAttachments, setErrAttachments] = useState("");

  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [attachmentName, setAttachmentName] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const role = String(user?.role || "").trim().toLowerCase();
  const department = String(user?.department || "").trim().toLowerCase();

  const canManageAttachments =
    role === "admin" ||
    role === "it" ||
    department === "hr department" ||
    department === "accounting department" ||
    department === "it department";

  const [balances, setBalances] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [errBal, setErrBal] = useState("");

  const [bonus15Data, setBonus15Data] = useState({
    percentage: 0,
    result: 0,
    bonus_month: "",
  });
  const [loadingBonus15, setLoadingBonus15] = useState(false);
  const [errBonus15, setErrBonus15] = useState("");

  const [editingLeave, setEditingLeave] = useState(false);

  const [localLeave, setLocalLeave] = useState({
    annual_leave: toNum(staff.annual_leave),
    sick_leave: toNum(staff.sick_leave),
    emergency_leave: toNum(staff.emergency_leave),
    maternity_leave: toNum(staff.maternity_leave),
    parental_leave: toNum(staff.parental_leave),
  });

  const [leaveForm, setLeaveForm] = useState({
    annual_leave: toNum(staff.annual_leave),
    sick_leave: toNum(staff.sick_leave),
    emergency_leave: toNum(staff.emergency_leave),
    maternity_leave: toNum(staff.maternity_leave),
    parental_leave: toNum(staff.parental_leave),
  });

  const handleLeaveChange = (field, value) => {
    setLeaveForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveLeaveDetails = async () => {
    try {
      await api.put(`/staff/${staff.id}`, {
        ...staff,
        ...leaveForm,
      });

      setLocalLeave({
        annual_leave: toNum(leaveForm.annual_leave),
        sick_leave: toNum(leaveForm.sick_leave),
        emergency_leave: toNum(leaveForm.emergency_leave),
        maternity_leave: toNum(leaveForm.maternity_leave),
        parental_leave: toNum(leaveForm.parental_leave),
      });

      alert("Leave details updated!");
      setEditingLeave(false);
    } catch (e) {
      alert("Failed to update leave details");
    }
  };

  const childrenArr = useMemo(() => safeJsonArray(staff?.children), [staff?.children]);
  const educationArr = useMemo(() => safeJsonArray(staff?.education), [staff?.education]);
  const employmentArr = useMemo(() => safeJsonArray(staff?.employment_history), [staff?.employment_history]);
  const beneficiariesArr = useMemo(() => safeJsonArray(staff?.beneficiaries), [staff?.beneficiaries]);
  const thirteenthMonthData = useMemo(
    () => compute13thMonthBreakdown(staff, promotionRows),
    [staff, promotionRows]
  );

  const Chip = ({ label, active, onClick }) => (
    <button type="button" className={`chip ${active ? "active" : ""}`} onClick={onClick}>{label}</button>
  );

  const EmptyState = ({ title, hint }) => (
    <div style={{ padding: 14, opacity: 0.9 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>
    </div>
  );

  const totals = useMemo(() => {
    const salaryTotal = toNum(staff.salary) + toNum(staff.ecola);
    const personalTotal = toNum(staff.cbu) + toNum(staff.cashbond) + toNum(staff.utility_charge ?? staff.utility);
    const transpoTotal =
      toNum(staff.transportation) + toNum(staff.repairing) + toNum(staff.postage) +
      toNum(staff.additional_target) + toNum(staff.additional_monitoring) + toNum(staff.other_deduction);
    const totalER = toNum(staff.sss_er) + toNum(staff.ph_er) + toNum(staff.hdmf_er);
    const totalEE = toNum(staff.sss_ee) + toNum(staff.ph_ee) + toNum(staff.hdmf_ee);
    return { salaryTotal, personalTotal, transpoTotal, totalER, totalEE };
  }, [staff]);

  const loadLeaves = useCallback(async () => {
    if (!staff?.id) return;

    setLoadingLeave(true);
    setErrLeave("");

    try {
      let rows = [];

      try {
        const res = await api.get(`/leave-requests/staff/${staff.id}`);
        rows = Array.isArray(res.data) ? res.data : [];
      } catch {
        const res2 = await api.get("/leave-requests");
        const all = Array.isArray(res2.data) ? res2.data : [];

        rows = all.filter(
          (x) =>
            String(x.employee_id) === String(staff.id) ||
            String(x.staff_id) === String(staff.id)
        );
      }

      setLeaveRows(rows);
    } catch (e) {
      setErrLeave(e?.response?.data?.message || "Failed to load leave history.");
      setLeaveRows([]);
    } finally {
      setLoadingLeave(false);
    }
  }, [staff?.id]);

  const loadSapHistory = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingSapHist(true); setErrSapHist("");
    try {
      const res = await api.get(`/staff-accounts-payable/employee/${staff.employee_no}`);
      setSapHistoryRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrSapHist(e?.response?.data?.message || "Failed to load staff payable history.");
      setSapHistoryRows([]);
    } finally { setLoadingSapHist(false); }
  }, [staff?.id, staff?.employee_no]);

  const loadLoans = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingLoan(true); setErrLoan("");
    try {
      const res = await api.get(`/loan-requests/staff/${staff.id}`);
      setLoanRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrLoan(e?.response?.data?.message || "Failed to load loan history.");
      setLoanRows([]);
    } finally { setLoadingLoan(false); }
  }, [staff?.id]);

  const loadDemotions = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingDemotion(true); setErrDemotion("");
    try {
      let rows = [];
      const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
      const role = String(user?.role || "").trim().toLowerCase();

      const canUseStaffEndpoint = role === "admin" || role === "hr" || role === "accounting";
      if (canUseStaffEndpoint) {
        const res = await api.get(`/demotion-orders/staff/${staff.id}`);
        rows = Array.isArray(res.data) ? res.data : [];
      } else {
        const res2 = await api.get(`/demotion-orders`);
        const all = Array.isArray(res2.data) ? res2.data : [];
        rows = all.filter((x) => String(x.employee_id) === String(staff.id));
      }
      setDemotionRows(rows);
    } catch (e) {
      setErrDemotion(e?.response?.data?.message || "Failed to load demotion orders.");
      setDemotionRows([]);
    } finally { setLoadingDemotion(false); }
  }, [staff?.id]);

  const loadTransfers = useCallback(async () => {
    if (!staff?.id) return;

    setLoadingTransfer(true);
    setErrTransfer("");

    try {
      let rows = [];

      try {
        const res = await api.get(`/transfer-staff-orders/staff/${staff.id}`);
        rows = Array.isArray(res.data) ? res.data : [];
      } catch {
        const res2 = await api.get(`/transfer-staff-orders`);
        const all = Array.isArray(res2.data) ? res2.data : [];
        rows = all.filter((x) => String(x.employee_id) === String(staff.id));
      }

      setTransferRows(rows);
    } catch (e) {
      setErrTransfer(e?.response?.data?.message || "Failed to load transfer orders.");
      setTransferRows([]);
    } finally {
      setLoadingTransfer(false);
    }
  }, [staff?.id]);

  const loadPromotions = useCallback(async () => {
    if (!staff?.id) return;

    setLoadingPromotion(true);
    setErrPromotion("");

    try {
      let rows = [];

      try {
        const res = await api.get(`/promotion-orders/staff/${staff.id}`);
        rows = Array.isArray(res.data) ? res.data : [];
      } catch {
        const res2 = await api.get(`/promotion-orders`);
        const all = Array.isArray(res2.data) ? res2.data : [];
        rows = all.filter((x) => String(x.employee_id) === String(staff.id));
      }

      setPromotionRows(rows);
    } catch (e) {
      setErrPromotion(e?.response?.data?.message || "Failed to load promotion orders.");
      setPromotionRows([]);
    } finally {
      setLoadingPromotion(false);
    }
  }, [staff?.id]);

  const loadSuspensions = useCallback(async () => {
    if (!staff?.id) return;

    setLoadingSuspension(true);
    setErrSuspension("");

    try {
      let rows = [];

      try {
        const res = await api.get(`/suspension-orders/staff/${staff.id}`);
        rows = Array.isArray(res.data) ? res.data : [];
      } catch {
        const res2 = await api.get(`/suspension-orders`);
        const all = Array.isArray(res2.data) ? res2.data : [];
        rows = all.filter((x) => String(x.employee_id) === String(staff.id));
      }

      setSuspensionRows(rows);
    } catch (e) {
      setErrSuspension(e?.response?.data?.message || "Failed to load suspension orders.");
      setSuspensionRows([]);
    } finally {
      setLoadingSuspension(false);
    }
  }, [staff?.id]);

  const loadAttachments = useCallback(async () => {
    if (!staff?.id) return;

    setLoadingAttachments(true);
    setErrAttachments("");

    try {
      const res = await api.get(`/staff/${staff.id}/attachments`);

      setAttachments(
        Array.isArray(res.data) ? res.data : []
      );
    } catch (e) {
      setErrAttachments(
        e?.response?.data?.message ||
        "Failed to load attachments."
      );

      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  }, [staff?.id]);

  const uploadAttachment = async () => {
    if (!attachmentFiles.length) {
      alert("Please select at least one file.");
      return;
    }

    try {
      setUploadingAttachment(true);

      for (const file of attachmentFiles) {
        const fd = new FormData();

        fd.append("photo", file);
        fd.append(
          "file_name",
          attachmentFiles.length === 1
            ? attachmentName || file.name
            : file.name
        );

        await api.post(
          `/staff/${staff.id}/attachments`,
          fd,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      setAttachmentFiles([]);
      setAttachmentName("");

      const input = document.getElementById("staff-attachment-file-input");
      if (input) input.value = "";

      await loadAttachments();
      alert("Attachment uploaded successfully.");
    } catch (e) {
      alert(
        e?.response?.data?.message ||
        "Upload failed."
      );
    } finally {
      setUploadingAttachment(false);
    }
  };

  const renameAttachment = async (row) => {
    const newName = prompt(
      "Rename file",
      row.file_name
    );

    if (!newName) return;

    try {
      await api.put(
        `/staff/attachments/${row.id}`,
        {
          file_name: newName,
        }
      );

      await loadAttachments();
    } catch (e) {
      alert(
        e?.response?.data?.message ||
        "Rename failed."
      );
    }
  };

  const deleteAttachment = async (row) => {
    if (
      !window.confirm(
        `Delete "${row.file_name}"?`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/staff/attachments/${row.id}`
      );

      await loadAttachments();
    } catch (e) {
      alert(
        e?.response?.data?.message ||
        "Delete failed."
      );
    }
  };

  const downloadAttachment = async (row) => {
    try {
      const res = await api.get(
        `/staff/attachments/${row.id}/download`
      );

      if (res.data?.url) {
        window.open(
          res.data.url,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (e) {
      alert(
        e?.response?.data?.message ||
        "Download failed."
      );
    }
  };

  const loadOpeningLoans = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingOpeningLoans(true); setErrOpeningLoans("");
    try {
      const res = await api.get(`/staff-loan-opening-balances/staff/${staff.id}`);
      setOpeningLoanRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrOpeningLoans(e?.response?.data?.message || "Failed to load opening loan balances.");
      setOpeningLoanRows([]);
    } finally { setLoadingOpeningLoans(false); }
  }, [staff?.id]);

  const loadBalances = useCallback(async () => {
    if (!staff?.employee_no) return;

    setLoadingBal(true);
    setErrBal("");

    try {
      const res = await api.get(`/staff-balances/${staff.employee_no}`);
      setBalances(res.data || {});
    } catch (e) {
      setErrBal(e?.response?.data?.message || "Failed to load personal balances.");
      setBalances({});
    } finally {
      setLoadingBal(false);
    }
  }, [staff?.employee_no]);

  const loadBonus15Data = useCallback(async () => {
  if (!staff?.id || !staff?.branch_id) return;

  setLoadingBonus15(true);
  setErrBonus15("");

  try {
    const now = new Date();
    const bonusMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const res = await api.get(`/bonus/branch/${staff.branch_id}`, {
      params: { bonus_month: bonusMonth },
    });

    const rows = Array.isArray(res.data) ? res.data : [];

    const found =
      rows.find((r) => String(r.employee_id) === String(staff.id)) || null;

    setBonus15Data({
      base: toNum(found?.month_13),
      percentage: toNum(found?.percentage),
      result: toNum(found?.result),
      bonus_month: bonusMonth,
    });
  } catch (e) {
    setErrBonus15(e?.response?.data?.message || "Failed to load 15th month bonus data.");
    setBonus15Data({
      percentage: 0,
      result: 0,
      bonus_month: "",
    });
  } finally {
    setLoadingBonus15(false);
  }
}, [staff?.id, staff?.branch_id]);

  useEffect(() => {
    if (tab === "leave") loadLeaves();

    if (tab === "history") {
      loadTransfers();
      loadPromotions();
      loadSuspensions();
      loadLeaves();
      loadLoans();
      loadOpeningLoans();
      loadDemotions();
      loadSapHistory();
    }

    if (tab === "attachments") {
      loadAttachments();
    }

    if (tab === "balances") {
      loadBalances();
      loadPromotions();
      loadLoans();
      loadOpeningLoans();
      loadSapHistory();
      loadBonus15Data();
    }
  }, [
    tab,
    loadLeaves,
    loadTransfers,
    loadPromotions,
    loadSuspensions,
    loadAttachments,
    loadLoans,
    loadOpeningLoans,
    loadDemotions,
    loadSapHistory,
    loadBalances,
    loadBonus15Data,
  ]);

  const historyItems = useMemo(() => {
    const items = [];
    if (historyKind === "All" || historyKind === "Loans") {
      for (const l of loanRows || []) {
        const date = loanDisplayDate(l);
        const extraDates = [
          l.entry_date ? `Entry: ${fmtDate(l.entry_date)}` : null,
          l.approved_at ? `Approved: ${fmtDate(l.approved_at)}` : null,
          l.disbursement_date ? `Disbursed: ${fmtDate(l.disbursement_date)}` : null,
        ].filter(Boolean).join(" • ");
        items.push({
          _type: "LOAN", id: l.id, ref: l.transaction_code || l.employee_no || l.id, date,
          status: l.status || "Pending", title: l.loan_type || "Loan",
          subtitle: `Amount: ₱ ${money(l.amount)} • Term: ${l.term || "-"} • Interest: ${Number(l.interest || 0)}%`,
          extra: `Total: ₱ ${money(l.total)} • Per Month: ₱ ${money(l.per_month)}${extraDates ? ` • ${extraDates}` : ""}`,
          reason: l.reason || "", rejection_reason: l.rejection_reason || "",
        });
      }
    }
    if (historyKind === "All" || historyKind === "SAP") {
      for (const x of sapHistoryRows || []) {
        items.push({
          _type: "SAP", id: x.id, ref: x.id,
          date: x.entry_date || x.created_at || x.approved_at || x.rejected_at || null,
          status: x.status || "Pending", title: "Staff Accounts Payable",
          subtitle: `Amount: ₱ ${money(x.amount)} • Term: ${x.term || "-"} • Per Month: ₱ ${money(x.per_month)}`,
          extra: `Balance: ₱ ${money(x.balance)} • Description: ${x.description || "-"}`,
          reason: "", rejection_reason: x.rejection_reason || "",
        });
      }
    }
    if (historyKind === "All" || historyKind === "Demotions") {
      for (const d of demotionRows || []) {
        items.push({
          _type: "DEMOTION", id: d.id, ref: d.order_no || d.id,
          date: d.created_at || d.updated_at || d.effective_date || null,
          status: d.status || "Pending", title: "Demotion Order",
          subtitle: `Prev: ${d.old_position || "-"} → New: ${d.new_position || "-"}`,
          extra: `Effective: ${fmtDate(d.effective_date) || "-"} • To Branch: ${`${d.to_branch_code || ""} ${d.to_branch_name || ""}`.trim() || (d.to_branch_id ?? "-")}`,
          reason: d.details || "", rejection_reason: d.rejection_reason || "",
        });
      }
    }
    if (historyKind === "All" || historyKind === "Leaves") {
      for (const l of leaveRows || []) {
        items.push({
          _type: "LEAVE",
          id: l.id,
          ref: l.leave_no || l.request_no || l.id,
          date: l.created_at || l.date_created || l.start_date || null,
          status: l.status || "Pending",
          title: `${l.leave_type || "Leave"} Request`,
          subtitle: `${fmtDate(l.start_date)} → ${fmtDate(l.end_date)}`,
          extra: `Days: ${l.total_days || l.days || 0}`,
          reason: l.reason || l.details || "",
          rejection_reason: l.rejection_reason || "",
        });
      }
    }
    if (historyKind === "All" || historyKind === "Transfers") {
      for (const t of transferRows || []) {
        items.push({
          _type: "TRANSFER",
          id: t.id,
          ref: t.order_no || t.transfer_no || t.id,
          date: t.created_at || t.updated_at || t.effective_date || null,
          status: t.status || "Pending",
          title: "Transfer Staff Order",
          subtitle: `From: ${
            `${t.from_branch_code || ""} ${t.from_branch_name || ""}`.trim() ||
            t.prev_branch_name ||
            "-"
          } → To: ${
            `${t.to_branch_code || ""} ${t.to_branch_name || ""}`.trim() ||
            t.present_branch_name ||
            "-"
          }`,
          extra: `Effective: ${fmtDate(t.effective_date)} • Position: ${
            t.position || t.old_position || "-"
          }`,
          reason: t.details || t.remarks || "",
          rejection_reason: t.rejection_reason || "",
        });
      }
    }
    if (historyKind === "All" || historyKind === "Promotions") {
      for (const p of promotionRows || []) {
        items.push({
          _type: "PROMOTION",
          id: p.id,
          ref: p.order_no || p.promotion_no || p.id,
          date: p.created_at || p.updated_at || p.effective_date || null,
          status: p.status || p.final_status || "Pending",
          title: "Promotion Order",
          subtitle: `Prev: ${p.old_position || "-"} → New: ${p.new_position || "-"}`,
          extra: `Effective: ${fmtDate(p.effective_date)} • Branch: ${
            `${p.present_branch_code || ""} ${p.present_branch_name || ""}`.trim() ||
            `${p.branch_code || ""} ${p.branch_name || ""}`.trim() ||
            "-"
          }`,
          reason: p.details || p.remarks || "",
          rejection_reason: p.rejection_reason || "",
        });
      }
    }
    if (historyKind === "All" || historyKind === "Suspensions") {
      for (const s of suspensionRows || []) {
        items.push({
          _type: "SUSPENSION",
          id: s.id,
          ref: s.order_no || s.suspension_no || s.id,
          date: s.created_at || s.updated_at || s.effective_date || s.start_date || null,
          status: s.status || "Pending",
          title: "Suspension Order",
          subtitle: `${fmtDate(s.start_date || s.effective_date)} → ${fmtDate(s.end_date)}`,
          extra: `Days: ${s.total_days || s.days || "-"} • Branch: ${
            `${s.branch_code || ""} ${s.branch_name || ""}`.trim() ||
            s.branch ||
            "-"
          }`,
          reason: s.details || s.reason || s.remarks || "",
          rejection_reason: s.rejection_reason || "",
        });
      }
    }
    items.sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    });
    return items;
  }, [
    loanRows,
    sapHistoryRows,
    demotionRows,
    transferRows,
    leaveRows,
    promotionRows,
    suspensionRows,
    historyKind,
  ]);

  const filteredLeaves = useMemo(() => {
    const list = Array.isArray(leaveRows) ? leaveRows : [];
    if (leaveKind === "All") return list;
    return list.filter((r) => String(r.status || "").toLowerCase() === leaveKind.toLowerCase());
  }, [leaveRows, leaveKind]);

  const leaveUsage = useMemo(() => {
    const usage = {
      annual_leave: 0,
      sick_leave: 0,
      emergency_leave: 0,
      maternity_leave: 0,
      parental_leave: 0,
      slw_leave: 0,
      vawc_leave: 0,
    };

    (leaveRows || []).forEach((l) => {
      if (String(l.status).toLowerCase() !== "approved") return;

      const days =
        toNum(l.days) ||
        Math.max(
          1,
          (new Date(l.end_date) - new Date(l.start_date)) /
            (1000 * 60 * 60 * 24) +
            1
        );

      const type = String(l.leave_type || "").toLowerCase();

      if (type === "annual leave") usage.annual_leave += days;
      else if (type === "sick leave") usage.sick_leave += days;
      else if (type === "emergency leave") usage.emergency_leave += days;
      else if (type === "maternity leave") usage.maternity_leave += days;
      else if (type === "paternity leave") usage.parental_leave += days; // ✅ mapped
      else if (type.includes("slw")) usage.slw_leave += days;
      else if (type.includes("vawc")) usage.vawc_leave += days;

    });

    return usage;
  }, [leaveRows]);

  const bal = balances || {};

  const combinedBalances = useMemo(() => ({
    cbu: toNum(bal.cbu),
    cashbond: toNum(bal.cashbond),
    utility: toNum(bal.utility),
    salary_advance: toNum(bal.salary_advance),
    special_advance: toNum(bal.special_advance),
    cash_advance: toNum(bal.cash_advance),
    motorcycle_loan: toNum(bal.motorcycle_loan),
    pag_ibig_loan: toNum(bal.pag_ibig_loan),
    other_receivable: toNum(bal.other_receivable),
    staff_accounts_payable: toNum(bal.staff_accounts_payable),
  }), [bal]);

  const headerName = displayName(staff);
  const headerPosition = toStr(staff?.position) || "-";
  const headerStatus = toStr(staff?.status) || "Active";

  useEffect(() => {
    if (!canViewPrivateDetails && (tab === "contract" || tab === "balances")) {
      setTab("staff");
    }
  }, [canViewPrivateDetails, tab]);

  const renderEducation = () => {
    if (!educationArr.length) return <tr><td colSpan="2">-</td></tr>;
    return educationArr.map((e, idx) => (
      <React.Fragment key={`edu-${idx}`}>
        <tr><td style={{ fontWeight: 800 }}>School</td><td>{e?.school || e?.school_name || "-"}</td></tr>
        <tr><td>Level</td><td>{e?.level || "-"}</td></tr>
        <tr><td>Course</td><td>{e?.course || "-"}</td></tr>
        <tr><td>Year Graduated</td><td>{e?.year_graduated || e?.year_completed || "-"}</td></tr>
        <tr><td>Remarks</td><td>{e?.remarks || "-"}</td></tr>
        {idx !== educationArr.length - 1 && <tr><td colSpan="2"><hr /></td></tr>}
      </React.Fragment>
    ));
  };

  const renderEmployment = () => {
    if (!employmentArr.length) return <tr><td colSpan="2">-</td></tr>;
    return employmentArr.map((e, idx) => (
      <React.Fragment key={`emp-${idx}`}>
        <tr><td style={{ fontWeight: 800 }}>Company</td><td>{e?.company || "-"}</td></tr>
        <tr><td>Position</td><td>{e?.position || "-"}</td></tr>
        <tr><td>Year Started</td><td>{e?.year_started || "-"}</td></tr>
        <tr><td>Year Ended</td><td>{e?.year_ended || "-"}</td></tr>
        <tr><td>Contact Number</td><td>{e?.contact_number || "-"}</td></tr>
        <tr><td>Character Reference</td><td>{e?.character_reference || "-"}</td></tr>
        {idx !== employmentArr.length - 1 && <tr><td colSpan="2"><hr /></td></tr>}
      </React.Fragment>
    ));
  };

  const renderBeneficiaries = () => {
    if (!beneficiariesArr.length) return <tr><td colSpan="2">-</td></tr>;
    return beneficiariesArr.map((b, idx) => (
      <React.Fragment key={`ben-${idx}`}>
        <tr><td style={{ fontWeight: 800 }}>Name</td><td>{b?.name || "-"}</td></tr>
        <tr><td>Relation</td><td>{b?.relation || "-"}</td></tr>
        <tr><td>Contact Number</td><td>{b?.contact_number || "-"}</td></tr>
        {idx !== beneficiariesArr.length - 1 && <tr><td colSpan="2"><hr /></td></tr>}
      </React.Fragment>
    ));
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "92vw",
          maxWidth: 1500,
        }}
      >
        <div className="modal-head">
          <div><h3>Staff Profile</h3></div>
          <button className="icon-btn" onClick={onClose} type="button">✕</button>
        </div>

        <div className="modal-body staff-profile-scroll">
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0 14px 0" }}>
            <img
              src={signedPhotoUrl || "/default-avatar.png"}
              alt="staff"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }}
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                objectFit: "cover",
                flex: "0 0 auto",
              }}
            />

            <div
              className="staff-avatar-lg staff-avatar--fallback"
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                display: signedPhotoUrl ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {headerName.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{headerName}</div>
              <div style={{ opacity: 0.85, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{headerPosition}</div>
              <div style={{ marginTop: 6, fontWeight: 800, color: String(headerStatus).toLowerCase() === "inactive" ? "#ef4444" : "#22c55e" }}>{headerStatus}</div>
            </div>
          </div>

          <div className="staff-tabs" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["staff", "contract", "leave", "attachments", "history", "balances"]
              .filter((t) => canViewPrivateDetails || !["contract", "balances"].includes(t))
              .map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} type="button">
                {t === "staff" ? "Staff Details" : t === "contract" ? "Contract Details" : t === "leave" ? "Leave Details" : t === "attachments" ? "Attachments" : t === "history" ? "Transaction History" : "Personal Balances"}
              </button>
            ))}
          </div>

          <br />

          {tab === "staff" && (
            <table className="profile-table">
              <tbody>
                <tr><td><h2>Employee Details</h2></td></tr>
                <tr><td>ID</td><td>{staff.id}</td></tr>
                <tr><td>Employee No</td><td>{staff.employee_no || "-"}</td></tr>
                <tr><td>Name</td><td>{displayName(staff)}</td></tr>
                <tr><td>Start Date</td><td>{fmtDate(staff.start_date)}</td></tr>
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
                <tr><td><h2>Spouse & Children Information</h2></td></tr>
                <tr><td>Spouse Fullname</td><td>{staff.spouse_fullname || "-"}</td></tr>
                <tr><td>Spouse Address</td><td>{staff.spouse_address || "-"}</td></tr>
                <tr><td>Spouse Occupation</td><td>{staff.spouse_occupation || "-"}</td></tr>
                <tr><td>Spouse Employer</td><td>{staff.spouse_employer || "-"}</td></tr>
                <tr><td><h3>Children</h3></td></tr>
                {childrenArr.length === 0 ? (
                  <tr><td colSpan="2">-</td></tr>
                ) : (
                  childrenArr.map((c, idx) => (
                    <React.Fragment key={idx}>
                      <tr><td>Fullname</td><td>{c?.fullname || "-"}</td></tr>
                      <tr><td>Date of Birth</td><td>{c?.date_of_birth || "-"}</td></tr>
                      <tr><td>Place of Birth</td><td>{c?.place_of_birth || "-"}</td></tr>
                      <tr><td colSpan="2"><hr /></td></tr>
                    </React.Fragment>
                  ))
                )}
                <tr><td><h2>Parents / Guardian</h2></td></tr>
                <tr><td>Father Fullname</td><td>{staff.father_fullname || "-"}</td></tr>
                <tr><td>Father Address</td><td>{staff.father_address || "-"}</td></tr>
                <tr><td>Father Occupation</td><td>{staff.father_occupation || "-"}</td></tr>
                <tr><td>Father Employer</td><td>{staff.father_employer || "-"}</td></tr>
                <tr><td>Father Contact</td><td>{staff.father_contact || "-"}</td></tr>
                <tr><td>Mother Fullname</td><td>{staff.mother_fullname || "-"}</td></tr>
                <tr><td>Mother Address</td><td>{staff.mother_address || "-"}</td></tr>
                <tr><td>Mother Occupation</td><td>{staff.mother_occupation || "-"}</td></tr>
                <tr><td>Mother Employer</td><td>{staff.mother_employer || "-"}</td></tr>
                <tr><td>Mother Contact</td><td>{staff.mother_contact || "-"}</td></tr>
                <tr><td>Guardian Fullname</td><td>{staff.guardian_fullname || "-"}</td></tr>
                <tr><td>Guardian Address</td><td>{staff.guardian_address || "-"}</td></tr>
                <tr><td>Guardian Occupation</td><td>{staff.guardian_occupation || "-"}</td></tr>
                <tr><td>Guardian Employer</td><td>{staff.guardian_employer || "-"}</td></tr>
                <tr><td>Guardian Contact</td><td>{staff.guardian_contact || "-"}</td></tr>
                <tr><td colSpan="2"><h2>Education</h2></td></tr>
                {renderEducation()}
                <tr><td colSpan="2"><h2>Employment</h2></td></tr>
                {renderEmployment()}
                <tr><td colSpan="2"><h2>Beneficiaries</h2></td></tr>
                {renderBeneficiaries()}
                <tr><td><h2>Remittances</h2></td></tr>
                <tr><td>SSS No.</td><td>{staff.sss_no || "-"}</td></tr>
                <tr><td>PhilHealth No.</td><td>{staff.philhealth_no || "-"}</td></tr>
                <tr><td>Pag-Ibig No.</td><td>{staff.pagibig_no || "-"}</td></tr>
                <tr><td>TIN No.</td><td>{staff.tin_no || "-"}</td></tr>
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
                <tr><td>Basic Salary</td><td>{money(staff.salary)}</td></tr>
                <tr><td>Ecola</td><td>{money(staff.ecola)}</td></tr>
                <tr><td><h3>Total</h3></td><td>{money(totals.salaryTotal)}</td></tr>
                <tr><td><h2>Personal Deductions</h2></td></tr>
                <tr><td>CBU</td><td>{money(staff.cbu)}</td></tr>
                <tr><td>Cashbond</td><td>{money(staff.cashbond)}</td></tr>
                <tr><td>Utility</td><td>{money(staff.utility_charge ?? staff.utility)}</td></tr>
              </tbody>
            </table>
          )}

          {tab === "leave" && (
            <>
              {canEditLeaveDetails && !editingLeave && (
                <button
                  className="btn btn-outline"
                  onClick={() => setEditingLeave(true)}
                  style={{ marginBottom: 10 }}
                >
                  Edit Leave Details
                </button>
              )}

              {editingLeave && (
                <div className="leave-edit-card">
                  <div className="leave-edit-grid">
                    {[
                      ["Annual Leave", "annual_leave"],
                      ["Sick Leave", "sick_leave"],
                      ["Emergency Leave", "emergency_leave"],
                      ["Maternity Leave", "maternity_leave"],
                      ["Paternity Leave", "parental_leave"],
                    ].map(([label, key]) => (
                      <div key={key} className="leave-field">
                        <label className="leave-label">{label}</label>
                        <input
                          type="number"
                          value={leaveForm[key]}
                          onChange={(e) => handleLeaveChange(key, e.target.value)}
                          className="leave-input"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="leave-actions">
                    <button className="btn btn-primary" onClick={saveLeaveDetails}>
                      💾 Save Changes
                    </button>

                    <button
                      className="btn btn-outline"
                      onClick={() => setEditingLeave(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!editingLeave && (
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Available</th>
                      <th>Used</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Annual Leave</td>
                      <td>{toNum(localLeave.annual_leave)}</td>
                      <td>{leaveUsage.annual_leave}</td>
                      <td>
                        {toNum(localLeave.annual_leave) - leaveUsage.annual_leave}
                      </td>
                    </tr>

                    <tr>
                      <td>Sick Leave</td>
                      <td>{toNum(localLeave.sick_leave)}</td>
                      <td>{leaveUsage.sick_leave}</td>
                      <td>
                        {toNum(localLeave.sick_leave) - leaveUsage.sick_leave}
                      </td>
                    </tr>

                    <tr>
                      <td>Emergency Leave</td>
                      <td>{toNum(localLeave.emergency_leave)}</td>
                      <td>{leaveUsage.emergency_leave}</td>
                      <td>
                        {toNum(localLeave.emergency_leave) - leaveUsage.emergency_leave}
                      </td>
                    </tr>

                    <tr>
                      <td>Maternity Leave</td>
                      <td>{toNum(localLeave.maternity_leave)}</td>
                      <td>{leaveUsage.maternity_leave}</td>
                      <td>
                        {toNum(localLeave.maternity_leave) - leaveUsage.maternity_leave}
                      </td>
                    </tr>

                    <tr>
                      <td>Paternity Leave</td>
                      <td>{toNum(localLeave.parental_leave)}</td>
                      <td>{leaveUsage.parental_leave}</td>
                      <td>
                        {toNum(localLeave.parental_leave) - leaveUsage.parental_leave}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </>
          )}

          {tab === "attachments" && (
            <>
              {canManageAttachments && (
                <div
                  className="leave-edit-card"
                style={{
                  marginBottom: 14,
                  padding: 14,
                  borderRadius: 14,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 10 }}>
                  Upload Staff Attachment
                </div>

                <div
                  className="leave-edit-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <div className="leave-field">
                    <label className="leave-label">Rename File As</label>
                    <input
                      type="text"
                      className="leave-input"
                      value={attachmentName}
                      onChange={(e) => setAttachmentName(e.target.value)}
                      placeholder={
                        attachmentFiles.length > 1
                          ? "Used only when uploading one file"
                          : "Example: Contract 2026"
                      }
                      disabled={attachmentFiles.length > 1}
                    />
                  </div>

                  <div className="leave-field">
                    <label className="leave-label">Choose File(s)</label>
                    <input
                      id="staff-attachment-file-input"
                      type="file"
                      multiple
                      className="leave-input"
                      onChange={(e) =>
                        setAttachmentFiles(Array.from(e.target.files || []))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={uploadAttachment}
                    disabled={uploadingAttachment}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {uploadingAttachment ? "Uploading..." : "Upload"}
                  </button>
                </div>

                {attachmentFiles.length > 0 ? (
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>
                    Selected: {attachmentFiles.map((f) => f.name).join(", ")}
                  </div>
                ) : null}
          </div>
            )}

              {loadingAttachments ? (
                <div className="empty-state">Loading attachments…</div>
              ) : null}

              {!loadingAttachments && errAttachments ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>
                  {errAttachments}
                </div>
              ) : null}

              {!loadingAttachments && !errAttachments && attachments.length === 0 ? (
                <EmptyState
                  title="No attachments yet."
                  hint="Uploaded staff files will appear here."
                />
              ) : null}

              {!loadingAttachments && attachments.length > 0 ? (
                <div className="table-scroll" style={{ overflowX: "hidden" }}>
                  <table className="saas-table staffinfo-table">
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>File Name</th>
                        <th style={{ width: "25%" }}>Original Name</th>
                        <th style={{ width: 150 }}>Uploaded</th>
                        <th style={{ width: 320 }}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attachments.map((row) => (
                        <tr key={row.id}>
                          <td className="strong" style={{ wordBreak: "break-word" }}>
                            {row.file_name || row.original_name || "-"}
                          </td>
                          <td style={{ wordBreak: "break-word" }}>
                            {row.original_name || "-"}
                          </td>
                          <td className="mono">
                            {row.created_at ? fmtDate(row.created_at) : "-"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => downloadAttachment(row)}
                              >
                                Download
                              </button>

                              {canManageAttachments && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => renameAttachment(row)}
                                  >
                                    Rename
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => deleteAttachment(row)}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}




          {tab === "history" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <Chip label="All" active={historyKind === "All"} onClick={() => setHistoryKind("All")} />
                <Chip label="Leaves" active={historyKind === "Leaves"} onClick={() => setHistoryKind("Leaves")} />
                <Chip label="Transfers" active={historyKind === "Transfers"} onClick={() => setHistoryKind("Transfers")} />
                <Chip label="Promotions" active={historyKind === "Promotions"} onClick={() => setHistoryKind("Promotions")} />
                <Chip label="Suspensions" active={historyKind === "Suspensions"} onClick={() => setHistoryKind("Suspensions")} />
                <Chip label="Loans" active={historyKind === "Loans"} onClick={() => setHistoryKind("Loans")} />
                <Chip label="Demotions" active={historyKind === "Demotions"} onClick={() => setHistoryKind("Demotions")} />
                <Chip label="SAP" active={historyKind === "SAP"} onClick={() => setHistoryKind("SAP")} />
              </div>

              {(loadingLoan || loadingLeave || loadingTransfer || loadingPromotion || loadingSuspension || loadingDemotion || loadingSapHist) && (
                <div className="empty-state">Loading transaction history…</div>
              )}

              {!loadingLoan && errLoan ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errLoan}</div>
              ) : null}

              {!loadingDemotion && errDemotion ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errDemotion}</div>
              ) : null}

              {!loadingSapHist && errSapHist ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errSapHist}</div>
              ) : null}

              {!loadingTransfer && errTransfer ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errTransfer}</div>
              ) : null}

              {!loadingPromotion && errPromotion ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errPromotion}</div>
              ) : null}

              {!loadingSuspension && errSuspension ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errSuspension}</div>
              ) : null}

              {!loadingLeave && errLeave ? (
                <div className="empty-state" style={{ color: "#ef4444" }}>{errLeave}</div>
              ) : null}


              {!loadingLoan &&
              !loadingLeave &&
              !loadingTransfer &&
              !loadingPromotion &&
              !loadingSuspension &&
              !loadingDemotion &&
              !loadingSapHist &&
              !errLoan &&
              !errLeave &&
              !errTransfer &&
              !errPromotion &&
              !errSuspension &&
              !errDemotion &&
              !errSapHist &&
              historyItems.length === 0 ? (
                <EmptyState
                  title="No transaction history yet."
                  hint="Leaves, Transfers, Promotions, Suspensions, Loans, Demotions, and SAP records will appear here."
                />
              ) : null}

              {!loadingLoan &&
              !loadingLeave &&
              !loadingTransfer &&
              !loadingPromotion &&
              !loadingSuspension &&
              !loadingDemotion &&
              !loadingSapHist &&
              historyItems.length > 0 ? (
                <div className="table-scroll" style={{ overflowX: "hidden" }}>
                  <table className="saas-table staffinfo-table">
                    <thead>
                      <tr>
                        <th style={{ width: 120 }}>Type</th>
                        <th style={{ width: 200 }}>Ref</th>
                        <th>Details</th>
                        <th style={{ width: 140 }}>Date</th>
                        <th style={{ width: 130 }}>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {historyItems.map((it) => (
                        <tr key={`${it._type}-${it.id}`}>
                          <td className="mono">{it._type}</td>
                          <td className="mono">{it.ref}</td>
                          <td>
                            <div className="strong">{it.title}</div>
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                              {it.subtitle}
                            </div>

                            {it.extra ? (
                              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                                {it.extra}
                              </div>
                            ) : null}

                            {it.reason ? (
                              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                                Remarks: {it.reason}
                              </div>
                            ) : null}

                            {it.rejection_reason ? (
                              <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>
                                Rejection: {it.rejection_reason}
                              </div>
                            ) : null}
                          </td>

                          <td className="mono">{it.date ? fmtDate(it.date) : "-"}</td>
                          <td className="mono">{it.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}

          {tab === "balances" && (
            <>
              {loadingBal ? <div className="empty-state">Loading balances…</div> : null}
              {errBal ? <div className="empty-state" style={{ color: "#ef4444" }}>{errBal}</div> : null}
              {!loadingBal && !errBal ? (
                <>
                  <table className="profile-table">
                    <tbody>
                      <tr><td colSpan="2"><h2>Personal Savings</h2></td></tr>
                      <tr><td>CBU</td><td>{money(combinedBalances.cbu)}</td></tr>
                      <tr><td>Cashbond</td><td>{money(combinedBalances.cashbond)}</td></tr>
                      <tr><td>Utility</td><td>{money(combinedBalances.utility)}</td></tr>
                      <tr>
                        <td><strong>Total Personal Savings</strong></td>
                        <td>{money(combinedBalances.cbu + combinedBalances.cashbond + combinedBalances.utility)}</td>
                      </tr>

                      <tr><td>Salary Advance</td><td>{money(combinedBalances.salary_advance)}</td></tr>
                      <tr><td>Special Advance</td><td>{money(combinedBalances.special_advance)}</td></tr>
                      <tr><td>Cash Advance</td><td>{money(combinedBalances.cash_advance)}</td></tr>
                      <tr><td>Motorcycle Loan</td><td>{money(combinedBalances.motorcycle_loan)}</td></tr>
                      <tr><td>Pag-ibig Loan</td><td>{money(combinedBalances.pag_ibig_loan)}</td></tr>
                      <tr><td>Other Receivable</td><td>{money(combinedBalances.other_receivable)}</td></tr>
                      <tr><td>Staff Accounts Payable</td><td>{money(combinedBalances.staff_accounts_payable)}</td></tr>
                      <tr>
                        <td><strong>Total Personal Balance</strong></td>
                        <td>
                          {money(
                            combinedBalances.salary_advance +
                              combinedBalances.special_advance +
                              combinedBalances.cash_advance +
                              combinedBalances.motorcycle_loan +
                              combinedBalances.pag_ibig_loan +
                              combinedBalances.other_receivable +
                              combinedBalances.staff_accounts_payable
                          )}
                        </td>
                      </tr>

                      <tr><td colSpan="2"><h2>Tax Contribution (2316)</h2></td></tr>
                      <tr><td>Basic Salary</td><td>{money(staff.salary)}</td></tr>
                      <tr><td>Ecola</td><td>{money(staff.ecola)}</td></tr>
                      <tr><td><strong>Total Contribution</strong></td><td>{money(toNum(staff.salary) + toNum(staff.ecola))}</td></tr>

                      <tr><td colSpan="2"><h2>Remittances (EE)</h2></td></tr>
                      <tr><td>SSS</td><td>{money(staff.sss_ee)}</td></tr>
                      <tr><td>Philhealth</td><td>{money(staff.ph_ee)}</td></tr>
                      <tr><td>Pag-ibig</td><td>{money(staff.hdmf_ee)}</td></tr>
                      <tr><td><strong>Total (EE)</strong></td><td>{money(toNum(staff.sss_ee) + toNum(staff.ph_ee) + toNum(staff.hdmf_ee))}</td></tr>

                      <tr><td colSpan="2"><h2>Tax</h2></td></tr>
                      <tr><td>Tax</td><td>{money(staff.tax)}</td></tr>
                      <tr><td><strong>Total Tax</strong></td><td>{money(toNum(staff.tax))}</td></tr>

                      <tr><td colSpan="2"><h2>13th / 14th / 15th Month Computation ({thirteenthMonthData.year})</h2></td></tr>
                      <tr><td>Basic Salary</td><td>{money(thirteenthMonthData.basicSalary)}</td></tr>
                      <tr><td>Ecola</td><td>{money(thirteenthMonthData.ecola)}</td></tr>
                      <tr><td><strong>Monthly Compensation</strong></td><td>{money(thirteenthMonthData.monthlyCompensation)}</td></tr>

                      {thirteenthMonthData.rows.map((row) => (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{row.amount == null ? "-" : money(row.amount)}</td>
                        </tr>
                      ))}

                      <tr><td><strong>Total Compensation Earned</strong></td><td>{money(thirteenthMonthData.totalCompensationEarned)}</td></tr>
                      <tr><td><strong>13th Month Pay</strong></td><td>{money(thirteenthMonthData.thirteenthMonth)}</td></tr>
                      <tr><td><strong>14th Month Pay</strong></td><td>{money(thirteenthMonthData.fourteenthMonth)}</td></tr>
                      <tr><td><strong>15th Month Pay</strong></td><td>{money(thirteenthMonthData.fifteenthMonth)}</td></tr>
                    </tbody>
                  </table>

                  <div style={{ marginTop: 20 }}>
                    {loadingBonus15 ? (
                      <div className="empty-state">Loading bonus data…</div>
                    ) : null}

                    {errBonus15 ? (
                      <div className="empty-state" style={{ color: "#ef4444" }}>
                        {errBonus15}
                      </div>
                    ) : null}

                    {!loadingBonus15 && !errBonus15 ? (
                      <table className="profile-table">
                        <thead>
                          <tr>
                            <th>2025 13th Month</th>
                            <th>Percentage</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{money(bonus15Data.base || 0)}</td>
                            <td>{bonus15Data.percentage}%</td>
                            <td>{money(bonus15Data.result)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button">Close</button>
        </div>
      </div>
    </div>
  );
}
