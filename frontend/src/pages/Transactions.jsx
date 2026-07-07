import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Transactions.css";

/* ---------------- Helpers ---------------- */
const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

export default function Transactions() {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isBranchManager = role === "branch manager";

  const go = (path) => navigate(path);

  /* ---------------- ROLE-BASED FILTER ---------------- */
  const cards = [
    {
      title: "Transfer Staff Order",
      desc: "Move staff to another branch/area.",
      path: "/transactions/transfer",
      roles: [
        "admin",
        "hr",
        "it",
        "accounting",
        "tread",
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Leave Requests",
      desc: "Create and manage leave requests.",
      path: "/transactions/leave",
      roles: [
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
      ],
    },
    {
      title: "Promotion Order",
      desc: "Change position and/or salary upward.",
      path: "/transactions/promotion",
      roles: [
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
      ],
    },
    {
      title: "Demotion",
      desc: "Adjust role/position downward.",
      path: "/transactions/demotion",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "tread",
        "area manager",
        "regional manager",
        "assistant vice president",
        "senior vice president",
        "vice president",
        "president",
      ],
    },
    {
      title: "Deployment Order",
      desc: "Staff newly hired / service recommence.",
      path: "/transactions/deployment",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Suspension",
      desc: "Temporarily suspend staff work.",
      path: "/transactions/suspension",
      roles: [
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
      ],
    },
    {
      title: "Statement of Accounts",
      desc: "Exit staff last pay / liabilities.",
      path: "/transactions/soa",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Exit Staff",
      desc: "Process resignation or termination.",
      path: "/transactions/exit",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "tread",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Resignation",
      desc: "Create and manage resignation requests.",
      path: "/transactions/resignation",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "tread",
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        "accounting",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "SBF",
      desc: "Staff Benevolent Fund request.",
      path: "/transactions/sbf",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Regularization",
      desc: "Staff Regularization Order",
      path: "/transactions/regularization",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Staff Accounts Payable",
      desc: "Create and approve staff accounts payable.",
      path: "/transactions/staff-accounts-payable",
      roles: [
        "admin",
        "it",
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
        "president",
        "hr",
        "accounting",
      ],
    },
    {
      title: "Other Receivable",
      desc: "Manage employee liabilities and receivables.",
      path: "/transactions/other-receivable",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
        "tread",
      ],
    },
    {
    title: "Board Resolution Requests",
      desc: "Create and approve board resolution requests.",
      path: "/transactions/board-resolution",
      roles: [
        "admin",
        "it",
        "hr",
        "accounting",
        "tread",
        "regional manager",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
  {
    title: "Staff Report",
    desc: "Generate and manage staff reports.",
    path: "/transactions/staff-report",
    roles: [
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
    ],
  },

  {
    title: "Notice to Explain",
    desc: "Create and manage notice to explain reports.",
    path: "/transactions/notice-to-explain",
    roles: [
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
    ],
  },

  {
    title: "Termination of Contract",
    desc: "Create and manage termination reports.",
    path: "/transactions/termination-of-contract",
  },
];

  const department = norm(
  user?.department ||
    user?.department_name ||
    user?.user_department ||
    user?.departmentName ||
    user?.dept
);

const ROLE_GROUP = [
  "branch manager",
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
];

const isRoleGroup = ROLE_GROUP.includes(role);

const isBackOfficeFullDept =
  department.includes("hr") ||
  department.includes("accounting") ||
  department.includes("audit") ||
  department.includes("it") ||
  department.includes("tread") ||
  department.includes("office of the president");

const isProductionLogisticDept =
  department.includes("production") && department.includes("logistic");

const isOperationDept = department.includes("operation");

const allowedTransactionPaths = () => {
  if (isAdmin || role === "it") return cards.map((c) => c.path);

  if (isRoleGroup && isBackOfficeFullDept) {
    return cards.map((c) => c.path);
  }

  if (isRoleGroup && isProductionLogisticDept) {
    return [
      "/transactions/transfer",
      "/transactions/leave",
      "/transactions/promotion",
      "/transactions/demotion",
      "/transactions/suspension",
      "/transactions/soa",
      "/transactions/resignation",
      "/transactions/sbf",
      "/transactions/regularization",
      "/transactions/staff-accounts-payable",
      "/transactions/other-receivable",
      "/transactions/staff-report",
    ];
  }

  if (isRoleGroup && isOperationDept) {
    if (role === "senior vice president") {
      return [
        "/transactions/transfer",
        "/transactions/leave",
        "/transactions/promotion",
        "/transactions/demotion",
        "/transactions/deployment",
        "/transactions/suspension",
        "/transactions/soa",
        "/transactions/exit",
        "/transactions/resignation",
        "/transactions/sbf",
        "/transactions/regularization",
        "/transactions/staff-accounts-payable",
        "/transactions/other-receivable",
        "/transactions/board-resolution",
        "/transactions/staff-report",
      ];
    }

    return cards
      .filter((c) => c.title !== "Deployment Order" && c.title !== "Exit Staff")
      .map((c) => c.path);
  }

  return cards.filter((c) => c.roles.includes(role)).map((c) => c.path);
};

const filteredCards = cards.filter((c) =>
  allowedTransactionPaths().includes(c.path)
);

  return (
    <div className="transactions-page">
      <div className="transactions-page-header">
        <div>
          <h2 className="transactions-title">
            {isBranchManager ? "Branch Transactions" : "Transactions"}
          </h2>
          <p className="transactions-subtitle">
            {isBranchManager
              ? "View and manage branch-level transactions."
              : "Create and manage all HRIS transactions."}
          </p>
        </div>
      </div>

      <div className="transactions-grid">
        {filteredCards.map((card, i) => (
          <button
            key={i}
            type="button"
            className="transactions-card"
            onClick={() => go(card.path)}
          >
            <div className="transactions-card-head">
              <div>
                <div className="transactions-card-title">{card.title}</div>
                <div className="transactions-card-meta">{card.desc}</div>
              </div>

              <span className="transactions-pill">
                {isAdmin ? "Manage" : "Open"}
              </span>
            </div>

            <div className="transactions-card-body">
              <p className="transactions-mini">
                {isBranchManager
                  ? "Limited access (no approvals)."
                  : "Full access including approvals."}
              </p>

              <div className="transactions-actions">
                <span className="transactions-link">Proceed →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}