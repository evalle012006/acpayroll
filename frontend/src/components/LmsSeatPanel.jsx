import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";

/**
 * LmsSeatPanel
 * ------------
 * Shows which LMS account a staff member is linked to and lets an admin pick one.
 * The list is already limited to the staff member's SAVED position and branch code, so save staff
 * changes first. It is SEARCHABLE: type a name, email, LO number or branch to narrow it.
 *   - "Open seats"       : already reset. Choosing one issues a temporary password (shown once).
 *   - "Existing accounts": a live LMS account nobody has linked yet. Linked as-is: password and
 *                          settings are kept, name/phone/position are refreshed from HRIS.
 *
 * <LmsSeatPanel staffId={staff.id} />
 */
const norm = (v) => String(v ?? "").toLowerCase();

const haystack = (s) =>
  norm(
    [
      s.name,
      s.email,
      s.loNo !== null && s.loNo !== undefined ? `lo ${s.loNo} lo#${s.loNo} #${s.loNo}` : "",
      s.branch_code,
      s.branch_name,
      s.scope,
    ].join(" ")
  );

export default function LmsSeatPanel({ staffId, onAssigned }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [seatId, setSeatId] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null); // { password, seatLabel } shown once
  const [copied, setCopied] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/lms/staff/${staffId}/seats`);
      setData(res.data);
      setSeatId("");
      setQuery("");
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load LMS accounts.");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (staffId) load();
  }, [staffId, load]);

  const seats = data?.seats || [];
  const picked = seats.find((s) => s._id === seatId);

  const matches = useMemo(() => {
    const tokens = norm(query).trim().split(/\s+/).filter(Boolean);
    return seats.filter((s) => tokens.every((t) => haystack(s).includes(t)));
  }, [seats, query]);
  const openMatches = matches.filter((s) => s.kind === "vacant");
  const unlinkedMatches = matches.filter((s) => s.kind === "unlinked");
  const flat = [...openMatches, ...unlinkedMatches]; // same order as rendered

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const choose = (s) => {
    setSeatId(s._id);
    setQuery("");
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the staff form from here
      if (flat[active]) choose(flat[active]);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const assign = async () => {
    if (!picked) return;
    const moving = data?.current ? "\n\nTheir current account will be reset and become an open seat." : "";
    const question =
      picked.kind === "unlinked"
        ? `This account is currently used by "${picked.name || picked.email}".\nLink it to this staff member?\nIts password and settings are kept.${moving}`
        : `Give this staff member the open seat:\n${picked.label}?\nThe seat gets a new temporary password.${moving}`;
    if (!window.confirm(question)) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api.post(`/lms/staff/${staffId}/assign-seat`, { seat_id: seatId });
      if (res.data.mode === "assign" && res.data.temp_password) {
        setIssued({ password: res.data.temp_password, seatLabel: picked.label });
        setCopied(false);
      } else {
        setIssued(null);
        setNotice("Account linked. The user keeps their current password.");
      }
      onAssigned?.(res.data);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not link the account.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
    } catch {
      /* clipboard blocked: the password is visible, they can copy it by hand */
    }
  };

  const roleText = String(data?.role || "").replace(/_/g, " ");

  const renderRow = (s, index) => (
    <div
      key={s._id}
      role="option"
      aria-selected={flat[active]?._id === s._id}
      data-active={flat[active]?._id === s._id ? "true" : "false"}
      onMouseEnter={() => setActive(index)}
      onMouseDown={(e) => {
        e.preventDefault(); // keep focus in the search box
        choose(s);
      }}
      style={{
        padding: "6px 10px",
        cursor: "pointer",
        background: flat[active]?._id === s._id ? "#eff6ff" : "transparent",
      }}
    >
      {s.label}
    </div>
  );

  const groupLabel = (key, text) => (
    <div key={key} className="mini" style={{ padding: "6px 10px", background: "#f9fafb", fontWeight: 600 }}>
      {text}
    </div>
  );

  return (
    <div className="field" style={{ marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <label style={{ fontWeight: 600 }}>LMS account</label>
      <div className="mini" style={{ marginBottom: 8 }}>
        Based on the saved position and branch. Save staff changes first.
      </div>

      {loading ? <div className="mini">Loading…</div> : null}
      {error ? <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div> : null}
      {notice ? <div style={{ color: "#166534", marginBottom: 8 }}>{notice}</div> : null}

      {issued ? (
        <div style={{ background: "#fef3c7", padding: 10, borderRadius: 6, marginBottom: 10 }}>
          <div className="mini">Temporary password for {issued.seatLabel}</div>
          <div style={{ fontFamily: "monospace", fontSize: 20, margin: "6px 0" }}>{issued.password}</div>
          <button type="button" className="btn btn-outline" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <div className="mini" style={{ marginTop: 6 }}>
            Shown once and never stored. Give it to the staff member; they must change it at first login.
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setIssued(null)}>
            I have noted it
          </button>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          {data.needs_employee_no ? (
            <div className="mini">Add an Employee No. to this staff member and save before linking an account.</div>
          ) : null}

          {data.current ? (
            <div style={{ marginBottom: 8 }}>
              Linked account: <strong>{data.current.label}</strong>
            </div>
          ) : !data.needs_employee_no ? (
            <div className="mini" style={{ marginBottom: 8 }}>No LMS account linked yet.</div>
          ) : null}

          {!data.needs_employee_no && data.syncable === false ? (
            <div className="mini">
              {data.reason === "excluded"
                ? "This position does not get an LMS account."
                : "This position is not recognised. Choose a position from the list and save."}
            </div>
          ) : null}

          {!data.needs_employee_no && data.syncable !== false && data.branch_found === false ? (
            <div className="mini">This staff member's branch code is not in the LMS. Check the branch.</div>
          ) : null}

          {!data.needs_employee_no && data.syncable && data.branch_found !== false ? (
            seats.length ? (
              picked ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220, padding: "6px 10px", border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 6 }}>
                    <span className="mini">{picked.kind === "unlinked" ? "Existing account" : "Open seat"}: </span>
                    <strong>{picked.label}</strong>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setSeatId("")} disabled={busy}>
                    Change
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={assign}>
                    {busy
                      ? "Working…"
                      : picked.kind === "unlinked"
                      ? "Link account"
                      : data.current
                      ? "Move to seat"
                      : "Assign seat"}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    className="input"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="lms-account-list"
                    autoComplete="off"
                    placeholder="Search by name, email or LO #…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                  />
                  <div className="mini" style={{ margin: "4px 0" }}>
                    {matches.length} of {seats.length} {roleText} accounts
                  </div>
                  <div
                    id="lms-account-list"
                    role="listbox"
                    ref={listRef}
                    style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}
                  >
                    {matches.length === 0 ? (
                      <div className="mini" style={{ padding: 10 }}>No account matches “{query}”.</div>
                    ) : null}
                    {openMatches.length ? groupLabel("open", "Open seats (reset, new password)") : null}
                    {openMatches.map((s, i) => renderRow(s, i))}
                    {unlinkedMatches.length ? groupLabel("unlinked", "Existing accounts not yet linked") : null}
                    {unlinkedMatches.map((s, i) => renderRow(s, openMatches.length + i))}
                  </div>
                </div>
              )
            ) : (
              <div className="mini">
                No available {roleText} accounts here. Create one in the LMS first, or ask an LMS admin to open a seat.
              </div>
            )
          ) : null}
        </>
      ) : null}
    </div>
  );
}
