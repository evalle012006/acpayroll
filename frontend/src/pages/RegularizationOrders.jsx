import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/RegularizationOrder.css";

const clean = (v) => String(v ?? "").trim();

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toDate10 = (v) =>
  v ? String(v).slice(0, 10) : "";

const displayNameParts = (s) => {
  const ln = clean(s?.last_name);
  const fn = clean(s?.first_name);
  const mn = clean(s?.middle_name);

  const built = `${ln}${
    ln && fn ? ", " : ""
  }${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return (
    built ||
    clean(s?.fullname) ||
    "-"
  );
};

const readUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") ||
        "null"
    );
  } catch {
    return null;
  }
};

const LEAVE_FIELDS = [
  {
    name: "annual_leave",
    label: "Annual Leave",
  },
  {
    name: "sick_leave",
    label: "Sick Leave",
  },
  {
    name: "emergency_leave",
    label: "Emergency Leave",
  },
  {
    name: "maternity_leave",
    label: "Maternity Leave",
  },
  {
    name: "parental_leave",
    label: "Parental Leave",
  },
  {
    name: "slw_leave",
    label:
      "Special Leave for Women (SLW)",
  },
  {
    name: "vawc_leave",
    label: "VAWC Leave",
  },
];

export default function RegularizationOrders() {
  const navigate = useNavigate();
  const employeeBoxRef = useRef(null);

  const user = useMemo(
    () => readUser(),
    []
  );

  const role = String(
    user?.role || ""
  )
    .trim()
    .toLowerCase();

  const canCreate = [
    "admin",
    "hr",
    "accounting",
    "vice president",
    "senior vice president",
    "president",
  ].includes(role);

  const canApprove = [
    "admin",
    "hr",
    "accounting",
  ].includes(role);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      employee_no: "",
      employee_name: "",
      branch_id: "",
      branch_label: "",
      date_created: toDate10(
        new Date().toISOString()
      ),
      effective_date: "",
      previous_position: "",
      present_position: "",
      previous_salary: "",
      present_salary: "",
      previous_ecola: "",
      present_ecola: "",
      annual_leave: "",
      sick_leave: "",
      emergency_leave: "",
      maternity_leave: "",
      parental_leave: "",
      slw_leave: "",
      vawc_leave: "",
      remarks: "",
    }),
    []
  );

  const [orders, setOrders] =
    useState([]);
  const [staff, setStaff] =
    useState([]);
  const [positions, setPositions] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [err, setErr] = useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [
    employeeSearch,
    setEmployeeSearch,
  ] = useState("");

  const [
    showEmployeeDropdown,
    setShowEmployeeDropdown,
  ] = useState(false);

  const [attachFile, setAttachFile] =
    useState(null);

  const [form, setForm] =
    useState(emptyForm);

  /* SEARCH + PAGER */
  const [search, setSearch] =
    useState("");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const badgeClass = (status) => {
    const s = String(
      status || "Pending"
    ).toLowerCase();

    if (s === "approved")
      return "reg-badge reg-approved";

    if (s === "rejected")
      return "reg-badge reg-rejected";

    return "reg-badge reg-pending";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const [oRes, sRes, dRes] =
        await Promise.all([
          api.get(
            "/regularization-orders"
          ),

          api.get("/staff"),

          api
            .get("/departments")
            .catch(() => ({
              data: [],
            })),
        ]);

      const orderRows = Array.isArray(
        oRes.data
      )
        ? oRes.data
        : [];

      const staffRows = Array.isArray(
        sRes.data
      )
        ? sRes.data
        : [];

      const deptRows = Array.isArray(
        dRes.data
      )
        ? dRes.data
        : [];

      setOrders(orderRows);
      setStaff(staffRows);

      const posSet = new Set();

      staffRows.forEach((s) => {
        if (clean(s.position))
          posSet.add(
            clean(s.position)
          );
      });

      deptRows.forEach((d) => {
        if (clean(d.name))
          posSet.add(clean(d.name));

        if (clean(d.position))
          posSet.add(
            clean(d.position)
          );
      });

      setPositions(
        Array.from(posSet).sort(
          (a, b) =>
            a.localeCompare(b)
        )
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to load regularization orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showModal) return;

    const onMouseDown = (e) => {
      if (
        employeeBoxRef.current &&
        !employeeBoxRef.current.contains(
          e.target
        )
      ) {
        setShowEmployeeDropdown(
          false
        );
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmployeeDropdown(
          false
        );

        closeModal();
      }
    };

    document.addEventListener(
      "mousedown",
      onMouseDown
    );

    document.addEventListener(
      "keydown",
      onKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "mousedown",
        onMouseDown
      );

      document.removeEventListener(
        "keydown",
        onKeyDown
      );

      document.body.style.overflow =
        "";
    };
  }, [showModal]);

  const filteredStaff = useMemo(() => {
    const q =
      employeeSearch.toLowerCase();

    if (!q)
      return staff.slice(0, 20);

    return staff.filter((s) => {
      const haystack = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.middle_name,
        s.last_name,
        displayNameParts(s),
        s.position,
        s.branch_name,
        s.branch_code,
      ]
        .map((x) =>
          clean(x).toLowerCase()
        )
        .join(" ");

      return haystack.includes(q);
    });
  }, [employeeSearch, staff]);

  /* SEARCH + PAGER */
  const filteredOrders = useMemo(() => {
    const q =
      clean(search).toLowerCase();

    if (!q) return orders;

    return orders.filter((o) => {
      const haystack = [
        o.order_no,
        o.employee_no,
        o.employee_name,
        o.branch_label,
        o.previous_position,
        o.present_position,
        o.status,
      ]
        .map((x) =>
          clean(x).toLowerCase()
        )
        .join(" ");

      return haystack.includes(q);
    });
  }, [orders, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredOrders.length /
        pageSize
    )
  );

  const pagedOrders = useMemo(() => {
    const start =
      (page - 1) * pageSize;

    return filteredOrders.slice(
      start,
      start + pageSize
    );
  }, [
    filteredOrders,
    page,
    pageSize,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const openCreate = () => {
    setErr("");

    setForm({
      ...emptyForm,
      date_created: toDate10(
        new Date().toISOString()
      ),
    });

    setAttachFile(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(
      false
    );

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setAttachFile(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(
      false
    );

    setForm({
      ...emptyForm,
      date_created: toDate10(
        new Date().toISOString()
      ),
    });
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find(
      (x) =>
        String(x.id) === String(id)
    );

    if (!emp) return;

    const branchLabel = [
      clean(emp.branch_code),

      clean(
        emp.branch_name ||
          emp.branch
      ),
    ]
      .filter(Boolean)
      .join(" - ");

    const next = {
      ...emptyForm,

      employee_id: String(emp.id),

      employee_no: clean(
        emp.employee_no
      ),

      employee_name:
        clean(emp.fullname) ||
        displayNameParts(emp),

      branch_id: emp.branch_id
        ? String(emp.branch_id)
        : "",

      branch_label: branchLabel,

      date_created: toDate10(
        new Date().toISOString()
      ),

      effective_date: "",

      previous_position: clean(
        emp.position
      ),

      present_position: clean(
        emp.position
      ),

      previous_salary: String(
        toNum(emp.salary)
      ),

      present_salary: String(
        toNum(emp.salary)
      ),

      previous_ecola: String(
        toNum(emp.ecola)
      ),

      present_ecola: String(
        toNum(emp.ecola)
      ),

      annual_leave: String(
        toNum(emp.annual_leave)
      ),

      sick_leave: String(
        toNum(emp.sick_leave)
      ),

      emergency_leave: String(
        toNum(emp.emergency_leave)
      ),

      maternity_leave: String(
        toNum(emp.maternity_leave)
      ),

      parental_leave: String(
        toNum(emp.parental_leave)
      ),

      slw_leave: String(
        toNum(emp.slw_leave)
      ),

      vawc_leave: String(
        toNum(emp.vawc_leave)
      ),

      remarks: "",
    };

    setForm(next);

    setEmployeeSearch(
      `${emp.id} — ${displayNameParts(
        emp
      )}${
        emp.employee_no
          ? ` (${emp.employee_no})`
          : ""
      }`
    );

    setShowEmployeeDropdown(
      false
    );
  };

  const submitCreate = async (
    e
  ) => {
    e.preventDefault();

    if (!canCreate || saving)
      return;

    setErr("");

    if (!clean(form.employee_id))
      return setErr(
        "Select employee."
      );

    if (
      !clean(form.effective_date)
    )
      return setErr(
        "Effective date required."
      );

    if (
      !clean(form.present_position)
    )
      return setErr(
        "Present position required."
      );

    setSaving(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "employee_id",
        clean(form.employee_id)
      );

      formData.append(
        "employee_no",
        clean(form.employee_no)
      );

      formData.append(
        "employee_name",
        clean(form.employee_name)
      );

      formData.append(
        "branch_id",
        clean(form.branch_id)
      );

      formData.append(
        "branch_label",
        clean(form.branch_label)
      );

      formData.append(
        "date_created",
        clean(form.date_created)
      );

      formData.append(
        "effective_date",
        clean(form.effective_date)
      );

      formData.append(
        "previous_position",
        clean(
          form.previous_position
        )
      );

      formData.append(
        "present_position",
        clean(
          form.present_position
        )
      );

      formData.append(
        "previous_salary",
        String(
          toNum(
            form.previous_salary
          )
        )
      );

      formData.append(
        "present_salary",
        String(
          toNum(
            form.present_salary
          )
        )
      );

      formData.append(
        "previous_ecola",
        String(
          toNum(
            form.previous_ecola
          )
        )
      );

      formData.append(
        "present_ecola",
        String(
          toNum(
            form.present_ecola
          )
        )
      );

      LEAVE_FIELDS.forEach(
        (field) => {
          formData.append(
            field.name,
            String(
              toNum(
                form[field.name]
              )
            )
          );
        }
      );

      formData.append(
        "remarks",
        clean(form.remarks)
      );

      if (attachFile) {
        formData.append(
          "attachment",
          attachFile
        );
      }

      await api.post(
        "/regularization-orders",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

      closeModal();
      await loadData();
    } catch (e2) {
      setErr(
        e2?.response?.data
          ?.message ||
          "Failed to create regularization order."
      );
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (
    row
  ) => {
    if (!canApprove) return;

    if (
      !window.confirm(
        "Approve this regularization order?"
      )
    )
      return;

    try {
      await api.put(
        `/regularization-orders/${row.id}/approve`
      );

      await loadData();
    } catch (e) {
      setErr(
        e?.response?.data
          ?.message ||
          "Failed to approve."
      );
    }
  };

  const rejectOrder = async (
    row
  ) => {
    if (!canApprove) return;

    const reason =
      window.prompt(
        "Enter rejection reason:"
      );

    if (!clean(reason)) return;

    try {
      await api.put(
        `/regularization-orders/${row.id}/reject`,
        { reason }
      );

      await loadData();
    } catch (e) {
      setErr(
        e?.response?.data
          ?.message ||
          "Failed to reject."
      );
    }
  };

  const downloadAttachment =
    async (id) => {
      try {
        const res =
          await api.get(
            `/regularization-orders/${id}/download`,
            {
              responseType:
                "blob",
            }
          );

        const url =
          window.URL.createObjectURL(
            new Blob([res.data])
          );

        const a =
          document.createElement(
            "a"
          );

        a.href = url;

        a.download = `regularization-order-${id}`;

        document.body.appendChild(
          a
        );

        a.click();

        a.remove();

        window.URL.revokeObjectURL(
          url
        );
      } catch (e) {
        alert(
          e?.response?.data
            ?.message ||
            "Failed to download attachment."
        );
      }
    };

  return (
    <div className="reg-page">
      <div className="reg-topbar">
        <div>
          <h2 className="reg-title">
            Regularization
          </h2>

          <p className="reg-subtitle">
            Create and manage
            staff regularization
            orders.
          </p>
        </div>

        <div className="reg-topbar-actions">
          <button
            className="reg-btn reg-btn-outline"
            onClick={() =>
              navigate(-1)
            }
            type="button"
          >
            ← Back
          </button>

          <button
            className="reg-btn reg-btn-outline"
            onClick={loadData}
            disabled={loading}
            type="button"
          >
            Refresh
          </button>

          {canCreate && (
            <button
              className="reg-btn reg-btn-primary"
              onClick={
                openCreate
              }
              type="button"
            >
              + Create
            </button>
          )}
        </div>
      </div>

      {err ? (
        <div
          style={{
            color: "#ef4444",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}

      <div className="reg-card">
        <div className="reg-toolbar">
          <div className="reg-toolbar-left">
            <input
              type="text"
              className="reg-search-main"
              placeholder="Search order no, employee, branch, position..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />

            <select
              className="reg-page-size"
              value={pageSize}
              onChange={(e) =>
                setPageSize(
                  Number(
                    e.target.value
                  )
                )
              }
            >
              <option value={25}>
                25
              </option>

              <option value={50}>
                50
              </option>

              <option value={75}>
                75
              </option>

              <option value={100}>
                100
              </option>
            </select>
          </div>

          <div className="reg-toolbar-count">
            {
              filteredOrders.length
            }{" "}
            result(s)
          </div>
        </div>

        <div className="reg-table-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>
                  Employee No
                </th>
                <th>Employee</th>
                <th>Branch</th>
                <th>
                  Previous
                  Position
                </th>
                <th>
                  Present
                  Position
                </th>
                <th>
                  Effective Date
                </th>
                <th>Status</th>
                <th>
                  Attachment
                </th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="reg-empty"
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredOrders.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="reg-empty"
                  >
                    No
                    regularization
                    orders found.
                  </td>
                </tr>
              ) : (
                pagedOrders.map(
                  (o) => {
                    const pending =
                      String(
                        o.status ||
                          ""
                      ).toLowerCase() ===
                      "pending";

                    return (
                      <tr
                        key={o.id}
                      >
                        <td>
                          {
                            o.order_no
                          }
                        </td>

                        <td>
                          {o.employee_no ||
                            "-"}
                        </td>

                        <td>
                          {
                            o.employee_name
                          }
                        </td>

                        <td>
                          {o.branch_label ||
                            "-"}
                        </td>

                        <td>
                          {o.previous_position ||
                            "-"}
                        </td>

                        <td>
                          {o.present_position ||
                            "-"}
                        </td>

                        <td>
                          {toDate10(
                            o.effective_date
                          )}
                        </td>

                        <td>
                          <span
                            className={badgeClass(
                              o.status
                            )}
                          >
                            {o.status ||
                              "Pending"}
                          </span>
                        </td>

                        <td>
                          {o.attachment_path ? (
                            <button
                              className="reg-mini-btn reg-download"
                              type="button"
                              onClick={() =>
                                downloadAttachment(
                                  o.id
                                )
                              }
                            >
                              Download
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td>
                          <div className="reg-row-actions">
                            {canApprove ? (
                              <>
                                <button
                                  className="reg-mini-btn reg-approve"
                                  onClick={() =>
                                    approveOrder(
                                      o
                                    )
                                  }
                                  disabled={
                                    !pending
                                  }
                                  type="button"
                                >
                                  Approve
                                </button>

                                <button
                                  className="reg-mini-btn reg-reject"
                                  onClick={() =>
                                    rejectOrder(
                                      o
                                    )
                                  }
                                  disabled={
                                    !pending
                                  }
                                  type="button"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span
                                style={{
                                  opacity: 0.7,
                                }}
                              >
                                -
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="reg-pager">
          <div className="reg-page-info">
            Page {page} of{" "}
            {totalPages}
          </div>

          <div className="reg-page-buttons">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                setPage((p) =>
                  Math.max(
                    1,
                    p - 1
                  )
                )
              }
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                page >=
                totalPages
              }
              onClick={() =>
                setPage((p) =>
                  Math.min(
                    totalPages,
                    p + 1
                  )
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}