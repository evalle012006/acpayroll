import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import "../styles/Permissions.css";

const roles = [
  "admin",
  "it",
  "hr",
  "accounting",
  "tread",
  "branch manager",
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
  "president",
];

const departments = [
  "",
  "IT DEPARTMENT",
  "OPERATION DEPARTMENT",
  "HR DEPARTMENT",
  "ACCOUNTING DEPARTMENT",
  "AUDIT DEPARTMENT",
  "TREAD DEPARTMENT",
  "PRODUCTION & LOGISTIC DEPARTMENT",
  "OFFICE OF THE PRESIDENT",
];

const modules = [
  "staff",
  "branch",
  "bonus",
  "salary_history",
  "status_history",
  "transportation_history",
  "transportation_override",
  "pending_staff",

  "department",
  "staff_balance",
  "staff_bonus_history",
  "staff_loan_opening_balance",
  "schedule_balance",

  "loan_request",
  "cbu_withdrawal",
  "reimbursement_request",

  "transfer_staff_order",
  "leave_request",
  "promotion_order",
  "demotion_order",
  "deployment_order",
  "suspension_order",
  "statement_of_account",
  "exit_staff_order",
  "resignation_request",
  "sbf_order",
  "regularization_order",

  "staff_accounts_payable",
  "other_receivable",

  "board_resolution",
  "staff_report",

  "area_configuration",
  "consolidation",

  "logistic_package",
  "users",
  "permissions",
  "report",

  "comp_rate",
];

const actions = [
  "view",
  "view_all",
  "create",
  "edit",
  "approve",
  "reject",
  "void",
  "delete",
  "bypass",
  "upload_approved",
  "upload_final_file",
];

const formatLabel = (value) =>
  String(value || "").replaceAll("_", " ").toUpperCase();

export default function Permissions() {
  const [rows, setRows] = useState([]);
  const [selectedRole, setSelectedRole] = useState("admin");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");

  const keyOf = (role, department, moduleName, actionName) =>
    `${role}__${department || ""}__${moduleName}__${actionName}`;

  const permissionMap = useMemo(() => {
    const map = {};

    rows.forEach((r) => {
      map[
        keyOf(r.role, r.department || "", r.module_name, r.action_name)
      ] = Boolean(r.allowed);
    });

    return map;
  }, [rows]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/role-permissions");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const togglePermission = async (moduleName, actionName, checked) => {
    const payload = {
      role: selectedRole,
      department: selectedDepartment || null,
      module_name: moduleName,
      action_name: actionName,
      allowed: checked,
    };

    const key = keyOf(
      selectedRole,
      selectedDepartment,
      moduleName,
      actionName
    );

    setSavingKey(key);

    setRows((prev) => {
      const exists = prev.some(
        (r) =>
          keyOf(r.role, r.department || "", r.module_name, r.action_name) === key
      );

      if (exists) {
        return prev.map((r) =>
          keyOf(r.role, r.department || "", r.module_name, r.action_name) === key
            ? {
                ...r,
                allowed: checked,
                department: selectedDepartment || null,
              }
            : r
        );
      }

      return [...prev, payload];
    });

    try {
      await api.put("/role-permissions", payload);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save permission.");
      loadPermissions();
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="approval-page permissions-page">
      <div className="permissions-top">
        <div>
          <h2 className="approval-title">Role Permissions</h2>
          <p className="approval-subtitle">
            Manage role and department-based access.
          </p>
        </div>

        <button
          className="btn-secondary"
          type="button"
          onClick={loadPermissions}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="table-card" style={{ padding: 20 }}>
        <div className="permissions-filters">
          <div>
            <label className="form-label">Select Role</label>

            <select
              className="input"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Select Department</label>

            <select
              className="input"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d || "default"} value={d}>
                  {d || "ALL DEPARTMENTS / ROLE DEFAULT"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            marginBottom: 18,
            fontWeight: 900,
          }}
        >
          Editing: {selectedRole.toUpperCase()}
          {selectedDepartment
            ? ` / ${selectedDepartment}`
            : " / ROLE DEFAULT"}
        </div>

        <div className="permissions-grid">
          {modules.map((moduleName) => (
            <div className="permission-card" key={moduleName}>
              <div className="permission-title">
                {formatLabel(moduleName)}
              </div>

              <div className="permission-actions">
                {actions.map((actionName) => {
                  const key = keyOf(
                    selectedRole,
                    selectedDepartment,
                    moduleName,
                    actionName
                  );

                  const checked = permissionMap[key] || false;

                  return (
                    <label className="permission-check" key={actionName}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={savingKey === key}
                        onChange={(e) =>
                          togglePermission(
                            moduleName,
                            actionName,
                            e.target.checked
                          )
                        }
                      />

                      {formatLabel(actionName)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}