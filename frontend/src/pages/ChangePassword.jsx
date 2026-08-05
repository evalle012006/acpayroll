import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Login2.css";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (newPassword.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.put(
        "/users/me/change-password",
        {
          new_password: newPassword,
        }
      );

      alert(
        "Password changed successfully. Please sign in using your new password."
        );

      localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.dispatchEvent(
        new Event("auth-changed")
        );

        navigate("/login", {
        replace: true,
        });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to change password."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-stack">
        <div className="auth-card">
          <div className="auth-head">
            <h2>Create New Password</h2>

            <p>
              Your account requires a new
              password before continuing.
            </p>
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={submit}
          >
            <div className="field">
              <span>New Password</span>

              <input
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="field">
              <span>Confirm Password</span>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                required
              />
            </div>

            <button
              className="auth-btn"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save New Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}