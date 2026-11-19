const norm = (value) => String(value ?? "").trim().toLowerCase();

export const MAIN_OFFICE_PAYROLL_GROUPS = [
  { id: "1", key: "admin_main_office", label: "ADMIN-MAIN OFFICE" },
  { id: "2", key: "tread_lms", label: "TREAD & LMS" },
  { id: "3", key: "audit", label: "AUDIT" },
  { id: "4", key: "svp_vp_avp_operation", label: "SVP, VP & AVP-OPERATION" },
  { id: "5", key: "rm_arm_operation", label: "RM & ARM-OPERATION" },
  { id: "6", key: "am_operation", label: "AM-OPERATION" },
  { id: "7", key: "aam_1_operation", label: "AAM OPERATION" },  
  { id: "8", key: "nao_staff", label: "NO ADMIN ORDER STAFF" },
];

export function getMainOfficePayrollGroup(staff) {
  const position = norm(staff?.position);
  const department = norm(staff?.department || staff?.department_name);
  const fields = [
    staff?.position,
    staff?.department,
    staff?.department_name,
    staff?.area,
    staff?.region,
    staff?.division,
  ];
  const allFields = fields.map(norm).join(" ");

  // AAM 1 and AAM 2 need an explicit marker to keep their reports separate.
  if (/(?:\baam|\bacting area manager)\s*[-#]?\s*1\b/i.test(allFields)) {
    return "aam_1_operation";
  }
  if (/(?:\baam|\bacting area manager)\s*[-#]?\s*2\b/i.test(allFields)) {
    return "aam_2_operation";
  }

  if (
    /audit|auditor/.test(`${position} ${department}`) ||
    /(?:^|[-\s])(?:avp|svp)-ia(?:$|\s)/.test(position)
  ) {
    return "audit";
  }

  if (/tread|lms|rec/.test(`${position} ${department}`)) {
    return "tread_lms";
  }

  if (
    /^admin personnel\b/.test(position) ||
    position === "maintenance" ||
    /admin[-\s]*(?:main office|department)/.test(department)
  ) {
    return "admin_main_office";
  }

  if (
    /^(?:president|senior vice president|svp|vice president|vp|assistant vice president|avp)(?:$|\b)/.test(
      position
    )
  ) {
    return "svp_vp_avp_operation";
  }

  if (/^(?:acting\s+)?regional manager$/.test(position)) {
    return "rm_arm_operation";
  }

  if (/^area manager$/.test(position)) {
    return "am_operation";
  }

  // Initial default: other B000 staff go into NAO Staff.
  return "nao_staff";
}