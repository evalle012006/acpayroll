import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import api from "../api/axiosClient";

import "../styles/Approval.css";
import "../styles/BoardResolutionRequests.css";


/* =========================================================
   CONSTANTS
========================================================= */

const STATUS_PENDING = "Pending Approval";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";


/* =========================================================
   HELPERS
========================================================= */

const readUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
};


const toStr = (value) =>
  String(value ?? "").trim();


const norm = (value) =>
  toStr(value).toLowerCase();


const fmtDate = (value) => {
  if (!value) return "-";

  return String(value).slice(0, 10);
};


const todayDate = () =>
  new Date().toISOString().slice(0, 10);


const defaultForm = () => ({
  date_created: todayDate(),

  to: "",

  thru: "",

  subject: "",

  body: "",

  attachment: null,
});


/* =========================================================
   COMPONENT
========================================================= */

export default function BoardResolutionRequests() {
  const navigate = useNavigate();

  const user = useMemo(
    () => readUser(),
    []
  );


  /* =======================================================
     USER / PERMISSION
  ======================================================= */

  const role = norm(user?.role);

  const department = norm(
    user?.department ||
      user?.department_name ||
      user?.departmentName ||
      ""
  );


  const isITDepartment =
    department === "it department";


  const isITDepartmentManager =
    isITDepartment &&
    [
      "branch manager",
      "acting branch manager",

      "area manager",
      "acting area manager",

      "regional manager",
      "acting regional manager",

      "assistant vice president",

      "vice president",

      "senior vice president",
    ].includes(role);


  const isAdmin =
    role === "admin" ||
    role === "it";


  const isHrDepartment =
    department === "hr department";


  const isAccountingDepartment =
    department === "accounting department";


  const canApprove =
    isAdmin ||
    isHrDepartment ||
    isAccountingDepartment ||
    isITDepartment;


  const isAreaManager =
    role === "area manager";


  const isRegionalManager =
    role === "regional manager";


  const isAssistantVicePresident =
    role === "assistant vice president";


  const isVp =
    role === "vice president";


  const isSvp =
    role === "senior vice president";


  const isPresident =
    role === "president";


  const canCreate =
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isAdmin ||
    isITDepartmentManager;


  const canViewPage =
    canCreate ||
    canApprove ||
    isVp ||
    isSvp ||
    isPresident;


  /* =======================================================
     STATE
  ======================================================= */

  const [rows, setRows] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [actionLoadingId, setActionLoadingId] =
    useState(null);


  /* CREATE */

  const [showCreate, setShowCreate] =
    useState(false);

  const [form, setForm] =
    useState(defaultForm);


  /* SEARCH */

  const [searchText, setSearchText] =
    useState("");

  const [search, setSearch] =
    useState("");


  /* PAGINATION */

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);


  /* =======================================================
     LOAD REQUESTS
  ======================================================= */

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get(
        "/board-resolution-requests"
      );

      setRows(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "LOAD BOARD RESOLUTION ERROR:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to load board resolution requests."
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (canViewPage) {
      loadRows();
    }
  }, [
    canViewPage,
    loadRows,
  ]);


  /* =======================================================
     FILTER
  ======================================================= */

  const filteredRows = useMemo(() => {
    const keyword =
      norm(search);

    if (!keyword) {
      return rows;
    }

    return rows.filter((row) => {
      const searchable = [
        row.request_no,

        row.to_text,

        row.thru_text,

        row.title,

        row.details,

        row.created_by_role,

        row.created_by_department,

        row.status,

        row.rejection_reason,

        row.date_created,

        row.created_at,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [
    rows,
    search,
  ]);


  /* =======================================================
     SUMMARY COUNTS
  ======================================================= */

  const totalRequests =
    filteredRows.length;


  const pendingRequests =
    filteredRows.filter(
      (row) =>
        norm(row.status) ===
        norm(STATUS_PENDING)
    ).length;


  const approvedRequests =
    filteredRows.filter(
      (row) =>
        norm(row.status) ===
        norm(STATUS_APPROVED)
    ).length;


  const rejectedRequests =
    filteredRows.filter(
      (row) =>
        norm(row.status) ===
        norm(STATUS_REJECTED)
    ).length;


  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length /
          pageSize
      )
    );


  const pagedRows =
    useMemo(() => {
      const start =
        (page - 1) *
        pageSize;

      return filteredRows.slice(
        start,
        start + pageSize
      );
    }, [
      filteredRows,
      page,
      pageSize,
    ]);


  useEffect(() => {
    setPage(1);
  }, [
    search,
    pageSize,
  ]);


  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [
    page,
    totalPages,
  ]);


  const getPageNumbers = () => {
    const pages = [];

    const maxButtons = 5;

    let start =
      Math.max(
        1,
        page - 2
      );

    let end =
      Math.min(
        totalPages,
        start +
          maxButtons -
          1
      );


    if (
      end - start <
      maxButtons - 1
    ) {
      start =
        Math.max(
          1,
          end -
            maxButtons +
            1
        );
    }


    for (
      let current = start;
      current <= end;
      current++
    ) {
      pages.push(current);
    }


    return pages;
  };


  /* =======================================================
     CREATE MODAL
  ======================================================= */

  const closeCreate = () => {
    setShowCreate(false);

    setForm(
      defaultForm()
    );
  };


  const createRequest = async (
    event
  ) => {
    event.preventDefault();


    if (!form.to.trim()) {
      alert(
        "Employee is required."
      );

      return;
    }


    if (
      !form.subject.trim()
    ) {
      alert(
        "Subject is required."
      );

      return;
    }


    try {
      setSaving(true);


      const fd =
        new FormData();


      fd.append(
        "date_created",
        form.date_created
      );


      fd.append(
        "to",
        form.to.trim()
      );


      fd.append(
        "thru",
        form.thru.trim()
      );


      fd.append(
        "title",
        form.subject.trim()
      );


      fd.append(
        "details",
        form.body.trim()
      );


      if (
        form.attachment
      ) {
        fd.append(
          "attachment",
          form.attachment
        );
      }


      await api.post(
        "/board-resolution-requests",
        fd,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );


      alert(
        "Board Resolution Request created."
      );


      closeCreate();


      await loadRows();
    } catch (err) {
      console.error(
        "CREATE BOARD RESOLUTION ERROR:",
        err
      );


      alert(
        err?.response?.data?.message ||
          "Failed to create request."
      );
    } finally {
      setSaving(false);
    }
  };


  /* =======================================================
     DOWNLOAD
  ======================================================= */

  const downloadFile = async (
    row
  ) => {
    try {
      const res =
        await api.get(
          `/board-resolution-requests/${row.id}/download`,
          {
            responseType:
              "blob",
          }
        );


      const blob =
        new Blob([
          res.data,
        ]);


      const url =
        window.URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href = url;


      link.download =
        row.request_attachment_name ||
        `board-resolution-${row.id}`;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      window.URL.revokeObjectURL(
        url
      );
    } catch (err) {
      console.error(
        "DOWNLOAD BOARD RESOLUTION ERROR:",
        err
      );


      alert(
        err?.response?.data?.message ||
          "Failed to download file."
      );
    }
  };


  /* =======================================================
     DELETE
  ======================================================= */

  const deleteRequest = async (
    row
  ) => {
    if (
      !window.confirm(
        "Delete this Board Resolution request?"
      )
    ) {
      return;
    }


    try {
      setActionLoadingId(
        row.id
      );


      await api.delete(
        `/board-resolution-requests/${row.id}`
      );


      await loadRows();


      alert(
        "Board Resolution request deleted."
      );
    } catch (err) {
      console.error(
        "DELETE BOARD RESOLUTION ERROR:",
        err
      );


      alert(
        err?.response?.data?.message ||
          "Failed to delete request."
      );
    } finally {
      setActionLoadingId(
        null
      );
    }
  };


  /* =======================================================
     APPROVE
  ======================================================= */

  const approveRequest = async (
    row
  ) => {
    if (
      !window.confirm(
        "Approve this Board Resolution request?"
      )
    ) {
      return;
    }


    try {
      setActionLoadingId(
        row.id
      );


      await api.put(
        `/board-resolution-requests/${row.id}/approve`
      );


      await loadRows();


      alert(
        "Board Resolution request approved."
      );
    } catch (err) {
      console.error(
        "APPROVE BOARD RESOLUTION ERROR:",
        err
      );


      alert(
        err?.response?.data?.message ||
          "Failed to approve request."
      );
    } finally {
      setActionLoadingId(
        null
      );
    }
  };


  /* =======================================================
     REJECT
  ======================================================= */

  const rejectRequest = async (
    row
  ) => {
    const reason =
      window.prompt(
        "Reason for rejection:"
      );


    if (
      !reason ||
      !reason.trim()
    ) {
      return;
    }


    try {
      setActionLoadingId(
        row.id
      );


      await api.put(
        `/board-resolution-requests/${row.id}/reject`,
        {
          reason:
            reason.trim(),
        }
      );


      await loadRows();


      alert(
        "Board Resolution request rejected."
      );
    } catch (err) {
      console.error(
        "REJECT BOARD RESOLUTION ERROR:",
        err
      );


      alert(
        err?.response?.data?.message ||
          "Failed to reject request."
      );
    } finally {
      setActionLoadingId(
        null
      );
    }
  };


  /* =======================================================
     DELETE PERMISSION
  ======================================================= */

  const canDeleteRow = (
    row
  ) =>
    String(
      row.created_by
    ) ===
      String(
        user?.id
      ) ||
    isAdmin;


  /* =======================================================
     STATUS
  ======================================================= */

  const statusClass = (
    status
  ) => {
    const value =
      norm(status);


    if (
      value ===
      norm(
        STATUS_APPROVED
      )
    ) {
      return "badge badge-approved";
    }


    if (
      value ===
      norm(
        STATUS_REJECTED
      )
    ) {
      return "badge badge-rejected";
    }


    return "badge badge-pending";
  };


  /* =======================================================
     ACCESS DENIED
  ======================================================= */

  if (!canViewPage) {
    return (
      <div className="board-page">
        <div className="empty-state">
          You do not have access to
          Board Resolution Requests.
        </div>
      </div>
    );
  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="board-page">

      {/* ===================================================
          HERO
      =================================================== */}

      <section className="board-hero">
        <div className="board-hero-main">

          <div className="board-hero-copy">

            <span className="board-eyebrow">
              HRIS TRANSACTIONS
            </span>


            <h1>
              Board Resolution Requests
            </h1>


            <p>
              Create, review,
              approve and manage Board
              Resolution requests
              throughout the
              organization.
            </p>


            <div className="board-flow">

              <span>
                APPROVAL FLOW
              </span>


              <b>
                Board Resolution Request
                → Final Approval
              </b>

            </div>

          </div>


          <div className="board-hero-actions">

            <button
              className="board-btn board-btn-secondary"
              type="button"
              onClick={() =>
                navigate(-1)
              }
            >
              ← Back
            </button>


            <button
              className="board-btn board-btn-secondary"
              type="button"
              onClick={loadRows}
              disabled={loading}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>


            {canCreate && (
              <button
                className="board-btn board-btn-primary"
                type="button"
                onClick={() =>
                  setShowCreate(
                    true
                  )
                }
              >
                + Compose
              </button>
            )}

          </div>

        </div>
      </section>


      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section className="board-summary-grid">

        <article className="board-summary-card board-summary-total">

          <div className="board-summary-icon">
            ALL
          </div>


          <div>
            <span>
              Total Requests
            </span>

            <strong>
              {totalRequests}
            </strong>

            <small>
              All Board Resolution
              records
            </small>
          </div>

        </article>


        <article className="board-summary-card board-summary-pending">

          <div className="board-summary-icon">
            P
          </div>


          <div>
            <span>
              Pending
            </span>

            <strong>
              {pendingRequests}
            </strong>

            <small>
              Awaiting final action
            </small>
          </div>

        </article>


        <article className="board-summary-card board-summary-approved">

          <div className="board-summary-icon">
            A
          </div>


          <div>
            <span>
              Approved
            </span>

            <strong>
              {approvedRequests}
            </strong>

            <small>
              Completed requests
            </small>
          </div>

        </article>


        <article className="board-summary-card board-summary-rejected">

          <div className="board-summary-icon">
            R
          </div>


          <div>
            <span>
              Rejected
            </span>

            <strong>
              {rejectedRequests}
            </strong>

            <small>
              Rejected requests
            </small>
          </div>

        </article>

      </section>


      {/* ===================================================
          SEARCH
      =================================================== */}

      <section className="board-search-panel">

        <div className="board-search-controls">

          <input
            type="text"
            className="board-search-input"
            placeholder="Search request no, employee, branch, subject, status..."
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                setSearch(
                  searchText
                );
              }
            }}
          />


          <button
            className="board-btn board-btn-secondary"
            type="button"
            onClick={() =>
              setSearch(
                searchText
              )
            }
          >
            Search
          </button>


          <button
            className="board-btn board-btn-secondary"
            type="button"
            onClick={() => {
              setSearchText("");
              setSearch("");
            }}
          >
            Clear
          </button>

        </div>


        <span className="board-result-count">
          {filteredRows.length}{" "}
          {filteredRows.length ===
          1
            ? "result"
            : "results"}
        </span>

      </section>


      {/* ===================================================
          TABLE
      =================================================== */}

      <section className="board-list-card">

        <div className="board-table-wrap">

          <table className="board-table">

            <thead>
              <tr>
                <th>
                  Request No
                </th>

                <th>
                  Date Created
                </th>

                <th>
                  Employee
                </th>

                <th>
                  Branch
                </th>

                <th>
                  Subject
                </th>

                <th>
                  Body
                </th>

                <th>
                  Created
                </th>

                <th>
                  Status
                </th>

                <th>
                  Actions
                </th>
              </tr>
            </thead>


            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="board-empty"
                  >
                    Loading Board
                    Resolution requests...
                  </td>
                </tr>
              ) : filteredRows.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="board-empty"
                  >
                    No Board Resolution
                    requests found.
                  </td>
                </tr>
              ) : (
                pagedRows.map(
                  (row) => (
                    <tr key={row.id}>

                      <td className="board-request-no">
                        {row.request_no ||
                          row.id ||
                          "-"}
                      </td>


                      <td>
                        {fmtDate(
                          row.date_created
                        )}
                      </td>


                      <td className="board-employee">
                        {row.to_text ||
                          "-"}
                      </td>


                      <td>
                        {row.thru_text ||
                          "-"}
                      </td>


                      <td className="board-subject">
                        {row.title ||
                          "-"}
                      </td>


                      <td
                        className="board-body-cell"
                        title={
                          row.details ||
                          ""
                        }
                      >
                        {row.details
                          ? row.details
                              .length >
                            80
                            ? `${row.details.slice(
                                0,
                                80
                              )}...`
                            : row.details
                          : "-"}
                      </td>


                      <td>
                        {fmtDate(
                          row.created_at
                        )}
                      </td>


                      <td>
                        <span
                          className={statusClass(
                            row.status
                          )}
                        >
                          {row.status ||
                            STATUS_PENDING}
                        </span>
                      </td>


                      <td>

                        <div className="board-row-actions">

                          {canApprove &&
                            row.status ===
                              STATUS_PENDING && (
                              <>
                                <button
                                  type="button"
                                  className="board-action-btn board-action-approve"
                                  disabled={
                                    actionLoadingId ===
                                    row.id
                                  }
                                  onClick={() =>
                                    approveRequest(
                                      row
                                    )
                                  }
                                >
                                  Approve
                                </button>


                                <button
                                  type="button"
                                  className="board-action-btn board-action-reject"
                                  disabled={
                                    actionLoadingId ===
                                    row.id
                                  }
                                  onClick={() =>
                                    rejectRequest(
                                      row
                                    )
                                  }
                                >
                                  Reject
                                </button>
                              </>
                            )}


                          {row.request_attachment_path && (
                            <button
                              type="button"
                              className="board-action-btn board-action-download"
                              disabled={
                                actionLoadingId ===
                                row.id
                              }
                              onClick={() =>
                                downloadFile(
                                  row
                                )
                              }
                            >
                              Download
                            </button>
                          )}


                          {canDeleteRow(
                            row
                          ) && (
                            <button
                              type="button"
                              className="board-action-btn board-action-delete"
                              disabled={
                                actionLoadingId ===
                                row.id
                              }
                              onClick={() =>
                                deleteRequest(
                                  row
                                )
                              }
                            >
                              Delete
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>


        {/* =================================================
            PAGINATION
        ================================================= */}

        <div className="board-pager">

          <div className="board-pager-left">

            <span>
              Rows per page
            </span>


            <select
              value={pageSize}
              onChange={(
                event
              ) =>
                setPageSize(
                  Number(
                    event.target
                      .value
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


          <div className="board-pager-right">

            <button
              type="button"
              className="board-page-btn"
              disabled={
                page <= 1
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
            >
              ‹
            </button>


            {getPageNumbers().map(
              (
                pageNumber
              ) => (
                <button
                  key={
                    pageNumber
                  }
                  type="button"
                  className={`board-page-number ${
                    page ===
                    pageNumber
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setPage(
                      pageNumber
                    )
                  }
                >
                  {pageNumber}
                </button>
              )
            )}


            <button
              type="button"
              className="board-page-btn"
              disabled={
                page >=
                totalPages
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.min(
                      totalPages,
                      current + 1
                    )
                )
              }
            >
              ›
            </button>


            <span className="board-page-summary">
              Page {page} of{" "}
              {totalPages}
            </span>

          </div>

        </div>

      </section>


      {/* ===================================================
          CREATE MODAL
      =================================================== */}

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target.classList.contains(
                "modal-overlay"
              )
            ) {
              closeCreate();
            }
          }}
        >

          <div
            className="modal saas-modal board-create-modal"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="modal-head">

              <div>

                <h3 className="modal-title">
                  Compose Board
                  Resolution Request
                </h3>


                <p className="modal-subtitle">
                  Enter the employee,
                  branch, subject,
                  request details and
                  supporting file.
                </p>

              </div>


              <button
                type="button"
                className="modal-x"
                onClick={
                  closeCreate
                }
              >
                ✕
              </button>

            </div>


            <form
              className="modal-form"
              onSubmit={
                createRequest
              }
            >

              <div className="modal-grid">

                {/* DATE */}

                <div className="form-group">

                  <label>
                    Date Created
                  </label>


                  <input
                    type="date"
                    value={
                      form.date_created
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          previous
                        ) => ({
                          ...previous,

                          date_created:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    required
                  />

                </div>


                {/* EMPTY COLUMN FOR LAYOUT */}

                <div className="form-group">
                  <label>
                    Request Type
                  </label>

                  <input
                    value="Board Resolution"
                    readOnly
                  />
                </div>


                {/* EMPLOYEE */}

                <div className="form-group full">

                  <label>
                    Employee
                  </label>


                  <textarea
                    rows={3}
                    value={
                      form.to
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          previous
                        ) => ({
                          ...previous,

                          to:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Employee Full Name & Position (e.g. Juan Dela Cruz - Area Manager)"
                    required
                  />

                </div>


                {/* BRANCH */}

                <div className="form-group full">

                  <label>
                    Branch
                  </label>


                  <textarea
                    rows={3}
                    value={
                      form.thru
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          previous
                        ) => ({
                          ...previous,

                          thru:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Branch Code & Name (e.g. B101 - Main Branch)"
                  />

                </div>


                {/* SUBJECT */}

                <div className="form-group full">

                  <label>
                    Subject
                  </label>


                  <input
                    value={
                      form.subject
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          previous
                        ) => ({
                          ...previous,

                          subject:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Request for Board Resolution..."
                    required
                  />

                </div>


                {/* BODY */}

                <div className="form-group full">

                  <label>
                    Body
                  </label>


                  <textarea
                    rows={8}
                    value={
                      form.body
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          previous
                        ) => ({
                          ...previous,

                          body:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Write the request details here..."
                  />

                </div>


                {/* FILE */}

                <div className="form-group full">

                  <label>
                    Upload File
                  </label>


                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          previous
                        ) => ({
                          ...previous,

                          attachment:
                            event
                              .target
                              .files?.[0] ||
                            null,
                        })
                      )
                    }
                  />

                </div>

              </div>


              <div className="modal-buttons">

                <button
                  className="btn-secondary"
                  type="button"
                  onClick={
                    closeCreate
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  className="btn-primary"
                  type="submit"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Creating..."
                    : "Create Request"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}