const key = (v) => String(v ?? "").trim().toLowerCase();

export function positionSelectState(options, current) {
  const cur = String(current ?? "").trim();
  if (!cur) return { value: "", extra: null };
  const hit = (Array.isArray(options) ? options : []).find((r) => key(r?.position) === key(cur));
  return hit ? { value: hit.position, extra: null } : { value: cur, extra: cur };
}