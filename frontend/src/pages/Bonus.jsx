import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Bonus.css";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

const Bonus = () => {
  const { branchId } = useParams();
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [branchesRes, staffRes] = await Promise.all([
          api.get("/branches"),
          api.get("/staff"),
        ]);

        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];
        const found = branches.find((b) => Number(b.id) === Number(branchId));
        if (!found) {
          setError("Branch not found.");
          return;
        }

        setBranch(found);

        const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];
        const byBranch = allStaff.filter((s) => Number(s.branch_id) === Number(branchId));

        const filtered =
          byBranch.length > 0
            ? byBranch
            : allStaff.filter((s) => norm(s.area) === norm(found.area));

        setStaff(filtered);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load bonus.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [branchId]);

    const computed = useMemo(() => {
        return staff.map((s) => {
    const salary = toNum(s.salary);

    const thirteenth = salary / 12;
    const fourteenth = salary / 12;
    const fifteenth = salary / 12;

        return {
            ...s,
            salary,
            thirteenth,
            fourteenth,
            fifteenth,
        };
    });
    }, [staff]);

    const total13 = computed.reduce((sum, s) => sum + toNum(s.thirteenth), 0);
    const total14 = computed.reduce((sum, s) => sum + toNum(s.fourteenth), 0);
    const total15 = computed.reduce((sum, s) => sum + toNum(s.fifteenth), 0);

  if (loading) return <div className="bonus-page">Loading bonus...</div>;
  if (error) return <div className="bonus-page error">{error}</div>;

  return (
    <div className="bonus-page">
      <div className="bonus-header">
        <div>
          <h2>Branch Bonus</h2>
          <p>
            {branch?.code} • {branch?.name} • {branch?.area}
          </p>
        </div>

        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

    <div className="bonus-card">
    <table className="bonus-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Position</th>
                <th>Salary</th>
                <th>13th Month</th>
                <th>14th Month</th>
                <th>15th Month</th>
            </tr>
        </thead>

        <tbody>
            {computed.map((s) => (
                <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.fullname}</td>
                    <td>{s.position}</td>
                    <td>{s.salary.toLocaleString()}</td>
                    <td className="strong">{s.thirteenth.toLocaleString()}</td>
                    <td className="strong">{s.fourteenth.toLocaleString()}</td>
                    <td className="strong">{s.fifteenth.toLocaleString()}</td>
                </tr>
            ))}

                <tr className="total-row">
                    <td colSpan={4}>TOTAL</td>
                        <td className="strong">{total13.toLocaleString()}</td>
                        <td className="strong">{total14.toLocaleString()}</td>
                        <td className="strong">{total15.toLocaleString()}</td>
                </tr>
        </tbody>
        </table>
      </div>
    </div>
  );
};

export default Bonus;