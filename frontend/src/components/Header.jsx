import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaBars, FaUser, FaCog, FaSignOutAlt, FaMoon, FaSun } from "react-icons/fa";
import "../styles/Header.css";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const readAvatar = () => localStorage.getItem("profileImage") || "";

const emitAuthChanged = () => window.dispatchEvent(new Event("auth-changed"));

const Header = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(() => readUser());
  const [avatar, setAvatar] = useState(() => readAvatar());
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const displayName = user?.username || "User";
  const displayRole = user?.role || "Unknown";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      setUser(readUser());
      setAvatar(readAvatar());
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, []);

  const handleLogout = useCallback(() => {
    setOpen(false);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    emitAuthChanged();

    navigate("/login", { replace: true });
  }, [navigate]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className="header">
      <FaBars className="menu-toggle" onClick={toggleSidebar} />

      <div className="header-right">
        <button className="theme-btn" onClick={toggleTheme} type="button">
          {theme === "light" ? <FaMoon /> : <FaSun />}
          <span className="theme-text">
            {theme === "light" ? "Dark" : "Light"}
          </span>
        </button>

        <div className="admin-profile" ref={dropdownRef}>
          <div className="admin-info" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
            <div className="admin-label">
              <div className="admin-name">{displayName}</div>
              <div className="admin-role">{displayRole}</div>
            </div>

            {avatar ? (
              <img src={avatar} alt="profile" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                {String(displayName).slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          {open && (
            <div className="dropdown">
              <div className="dropdown-item" onClick={() => {setOpen(false); navigate("/profile");}}><FaUser /> Profile</div>
              <div className="dropdown-item" onClick={() => {setOpen(false); navigate("/settings");}}><FaCog /> Settings</div>
              <div className="dropdown-item logout" onClick={handleLogout}><FaSignOutAlt /> Logout</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;