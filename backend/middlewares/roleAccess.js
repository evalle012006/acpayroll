const normalizeRole = (value) => String(value ?? "").trim().toLowerCase();

const getRole = (req) => normalizeRole(req.user?.role);

const hasAnyRole = (req, roles = []) => {
  const role = getRole(req);
  return roles.map(normalizeRole).includes(role);
};

const VIEW_ONLY_ROLES = ["tread"];
const CREATOR_ROLES = [
  "admin",
  "hr",
  "accounting",
  "branch manager",
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
  "president",
];
const FINAL_APPROVER_ROLES = [
  "admin",
  "hr",
  "accounting",
  "vice president",
  "senior vice president",
  "president",
];
const FULL_VIEW_ROLES = [
  "admin",
  "hr",
  "accounting",
  "tread",
  "assistant vice president",
  "vice president",
  "senior vice president",
  "president",
];

const isAdmin = (req) => hasAnyRole(req, ["admin"]);
const isHr = (req) => hasAnyRole(req, ["hr"]);
const isAccounting = (req) => hasAnyRole(req, ["accounting"]);
const isTread = (req) => hasAnyRole(req, ["tread"]);
const isBranchManager = (req) => hasAnyRole(req, ["branch manager"]);
const isAreaManager = (req) => hasAnyRole(req, ["area manager"]);
const isRegionalManager = (req) => hasAnyRole(req, ["regional manager"]);
const isAssistantVicePresident = (req) =>
  hasAnyRole(req, ["assistant vice president"]);
const isVicePresident = (req) => hasAnyRole(req, ["vice president"]);
const isSeniorVicePresident = (req) =>
  hasAnyRole(req, ["senior vice president"]);
const isPresident = (req) => hasAnyRole(req, ["president"]);

const canViewAll = (req) => hasAnyRole(req, FULL_VIEW_ROLES);
const canCreate = (req) => hasAnyRole(req, CREATOR_ROLES);
const canFinalApprove = (req) => hasAnyRole(req, FINAL_APPROVER_ROLES);
const isViewOnlyUser = (req) => hasAnyRole(req, VIEW_ONLY_ROLES);

module.exports = {
  normalizeRole,
  getRole,
  hasAnyRole,
  VIEW_ONLY_ROLES,
  CREATOR_ROLES,
  FINAL_APPROVER_ROLES,
  FULL_VIEW_ROLES,
  isAdmin,
  isHr,
  isAccounting,
  isTread,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
  canViewAll,
  canCreate,
  canFinalApprove,
  isViewOnlyUser,
};