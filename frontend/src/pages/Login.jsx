import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Login2.css";
import amber from "../assets/amber.jpg";
import { FaFacebookF, FaTiktok } from "react-icons/fa";

const emitAuthChanged = () => window.dispatchEvent(new Event("auth-changed"));

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { username, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      emitAuthChanged();

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-stack">
        <div className="auth-card fade-in">
          <div className="auth-brand">
            <img src={amber} alt="AmberCash Logo" className="auth-logo-img" />
            <div>
              <div className="auth-title">AmberCash PH</div>
              <div className="auth-subtitle">Payroll System</div>
            </div>
          </div>

          <div className="auth-head">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your dashboard</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="field">
              <span>Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <div className="social-section">
          <p className="social-title">Follow us on social media</p>
          <div className="social-icons">
            <a
              href="https://www.facebook.com/ambercashphofficial"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon facebook"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>
            <a
              href="https://www.tiktok.com/@ambercashph"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon tiktok"
              aria-label="TikTok"
            >
              <FaTiktok />
            </a>
          </div>

          <p className="copyright">
            © 2022-{new Date().getFullYear()} AmberCash PH. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;