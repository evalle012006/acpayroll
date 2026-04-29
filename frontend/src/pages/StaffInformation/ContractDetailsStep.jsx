  import React, { useMemo } from "react";
  import { norm, toStr } from "./staffInfoUtils";

  export default function ContractDetailsStep({form, branches, positionRates = [], onChange, branchSearch, setBranchSearch, }) {
    const positionOptions = Array.isArray(positionRates)
      ? [...new Map(
          positionRates
            .filter((r) => String(r?.position || "").trim())
            .map((r) => [String(r.position).trim().toLowerCase(), r])
        ).values()].sort((a, b) =>
          String(a.position || "").localeCompare(String(b.position || ""))
        )
      : [];

      const filteredBranches = useMemo(() => {
      const q = norm(branchSearch);
      if (!q) return branches.slice(0, 30);

      return branches.filter((b) => {
        const hay = [b.id, b.code, b.name, b.area, b.region, b.division]
          .map((x) => norm(x))
          .join(" ");
        return hay.includes(q);
      });
    }, [branches, branchSearch]);

    const handleBranchSelect = (branch) => {
      onChange({
        target: {
          name: "branch_id",
          value: String(branch?.id ?? ""),
        },
      });

      onChange({
        target: {
          name: "area",
          value: branch?.area ?? "",
        },
      });

      onChange({
        target: {
          name: "region",
          value: branch?.region ?? "",
        },
      });

      onChange({
        target: {
          name: "division",
          value: branch?.division ?? "",
        },
      });

      setBranchSearch(
        `${toStr(branch?.code)}${branch?.name ? ` - ${toStr(branch.name)}` : ""}`.trim()
      );
    };

    const handlePositionChange = (e) => {
      const selectedPosition = String(e.target.value || "").trim();
      const matched = positionOptions.find(
        (r) => String(r.position || "").trim().toLowerCase() === selectedPosition.toLowerCase()
      );

      onChange({
        target: {
          name: "position",
          value: selectedPosition,
        },
      });

      if (matched) {
        onChange({
          target: {
            name: "salary",
            value: matched.salary ?? "",
          },
        });

        onChange({
          target: {
            name: "ecola",
            value: matched.ecola ?? "",
          },
        });

        onChange({
          target: {
            name: "cbu",
            value: matched.cbu ?? "",
          },
        });

        onChange({
          target: {
            name: "cashbond",
            value: matched.cashbond ?? "",
          },
        });

        onChange({
          target: {
            name: "utility_charge",
            value: matched.utility_charge ?? matched.utility ?? "",
          },
        });

        onChange({
          target: {
            name: "utility",
            value: matched.utility ?? matched.utility_charge ?? "",
          },
        });

        onChange({
          target: {
            name: "sss_er",
            value: matched.sss_er ?? "",
          },
        });

        onChange({
          target: {
            name: "ph_er",
            value: matched.philhealth_er ?? matched.ph_er ?? "",
          },
        });

        onChange({
          target: {
            name: "hdmf_er",
            value: matched.pagibig_er ?? matched.hdmf_er ?? "",
          },
        });

        onChange({
          target: {
            name: "sss_ee",
            value: matched.sss_ee ?? "",
          },
        });

        onChange({
          target: {
            name: "ph_ee",
            value: matched.philhealth_ee ?? matched.ph_ee ?? "",
          },
        });

        onChange({
          target: {
            name: "hdmf_ee",
            value: matched.pagibig_ee ?? matched.hdmf_ee ?? "",
          },
        });

        onChange({
          target: {
            name: "tax",
            value: matched.tax ?? "",
          },
        });
      }
    };

    return (
      <div className="modal-body staff-add-grid">
        <div className="staff-add-left" style={{ width: "100%" }}>
          <div className="field">
            <label>Position *</label>
            <select
              className="input"
              name="position"
              value={form.position}
              onChange={handlePositionChange}
              required
            >
              <option value="">Select position...</option>
              {positionOptions.map((r) => (
                <option key={r.id || r.position} value={r.position}>
                  {r.position}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Department</label>
            <input className="input" name="department" value={form.department} onChange={onChange} />
          </div>

          <div className="field">
            <label>Area</label>
            <input className="input" name="area" value={form.area} onChange={onChange} />
          </div>

          <div className="field">
            <label>Region</label>
            <input className="input" name="region" value={form.region} onChange={onChange} />
          </div>

          <div className="field">
            <label>Division</label>
            <input className="input" name="division" value={form.division} onChange={onChange} />
          </div>

          <div className="field" style={{ position: "relative" }}>
            <label>Branch</label>
            <input
              className="input"
              value={branchSearch}
              onChange={(e) => {
                setBranchSearch(e.target.value);
                onChange({
                  target: {
                    name: "branch_id",
                    value: "",
                  },
                });
                onChange({
                  target: {
                    name: "area",
                    value: "",
                  },
                });
                onChange({
                  target: {
                    name: "region",
                    value: "",
                  },
                });
                onChange({
                  target: {
                    name: "division",
                    value: "",
                  },
                });
              }}
              placeholder="Search branch code or name..."
            />

            {!!filteredBranches.length && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  marginTop: 6,
                  maxHeight: 240,
                  overflowY: "auto",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0f1a2e",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                }}
              >
                {filteredBranches.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleBranchSelect(b)}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      color: "#e7edf7",
                    }}
                  >
                    {`${toStr(b.code)} - ${toStr(b.name)}`.trim()}
                  </div>
                ))}
              </div>
            )}

          </div>
          <div className="field">
            <label>Status</label>
            <select className="input" name="status" value={form.status} onChange={onChange}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="field"><label>Start Date</label><input className="input" name="start_date" type="date" value={form.start_date} onChange={onChange} /></div>
          <div className="field"><label>Regularization Date</label><input className="input" name="regularization_date" type="date" value={form.regularization_date} onChange={onChange} /></div>
          <div className="field"><label>Basic Salary</label><input className="input" name="salary" value={form.salary} onChange={onChange} /></div>
          <div className="field"><label>Ecola</label><input className="input" name="ecola" value={form.ecola} onChange={onChange} /></div>
          <div className="field"><label>CBU (staff table default)</label><input className="input" name="cbu" value={form.cbu} onChange={onChange} /></div>
          <div className="field"><label>Cashbond (staff table default)</label><input className="input" name="cashbond" value={form.cashbond} onChange={onChange} /></div>
          <div className="field"><label>Utility (staff table default)</label><input className="input" name="utility" value={form.utility ?? form.utility_charge ?? ""} onChange={onChange} /></div>
          <div className="field"><label>Transportation</label><input className="input" name="transportation" value={form.transportation} onChange={onChange} /></div>
          <div className="field"><label>Repairing</label><input className="input" name="repairing" value={form.repairing} onChange={onChange} /></div>
          <div className="field"><label>Postage</label><input className="input" name="postage" value={form.postage} onChange={onChange} /></div>
          <div className="field"><label>Additional Target</label><input className="input" name="additional_target" value={form.additional_target} onChange={onChange} /></div>
          <div className="field"><label>Additional Monitoring</label><input className="input" name="additional_monitoring" value={form.additional_monitoring} onChange={onChange} /></div>
          <div className="field"><label>Other Deduction</label><input className="input" name="other_deduction" value={form.other_deduction} onChange={onChange} /></div>
          <div className="field"><label>SSS ER</label><input className="input" name="sss_er" value={form.sss_er} onChange={onChange} /></div>
          <div className="field"><label>PhilHealth ER</label><input className="input" name="ph_er" value={form.ph_er} onChange={onChange} /></div>
          <div className="field"><label>HDMF ER</label><input className="input" name="hdmf_er" value={form.hdmf_er} onChange={onChange} /></div>
          <div className="field"><label>SSS EE</label><input className="input" name="sss_ee" value={form.sss_ee} onChange={onChange} /></div>
          <div className="field"><label>PhilHealth EE</label><input className="input" name="ph_ee" value={form.ph_ee} onChange={onChange} /></div>
          <div className="field"><label>HDMF EE</label><input className="input" name="hdmf_ee" value={form.hdmf_ee} onChange={onChange} /></div>
          <div className="field"><label>Withheld Tax</label><input className="input" name="tax" value={form.tax} onChange={onChange} /></div>
        </div>
      </div>
    );
  }
