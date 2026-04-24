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
        "accounting",
        "tread",
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
        "hr",
        "accounting",
        "tread",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Demotion Order",
      desc: "Adjust role/position downward.",
      path: "/transactions/demotion",
      roles: [
        "admin",
        "hr",
        "accounting",
        "tread",
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
        "hr",
        "accounting",
        "tread",
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Suspension Order",
      desc: "Temporarily suspend staff work.",
      path: "/transactions/suspension",
      roles: [
        "admin",
        "hr",
        "accounting",
        "tread",
        "area manager",
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
        "hr",
        "accounting",
        "tread",
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
        "hr",
        "accounting",
        "tread",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Resignation Requests",
      desc: "Create and manage resignation requests.",
      path: "/transactions/resignation",
      roles: [
        "admin",
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
      title: "SBF Order",
      desc: "Staff Benevolent Fund request.",
      path: "/transactions/sbf",
      roles: [
        "admin",
        "hr",
        "accounting",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
    {
      title: "Regularization Order",
      desc: "Staff Regularization Order",
      path: "/transactions/regularization",
      roles: [
        "admin",
        "hr",
        "accounting",
        "vice president",
        "senior vice president",
        "president",
      ],
    },
  ];

  const filteredCards = cards.filter((c) => c.roles.includes(role));

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