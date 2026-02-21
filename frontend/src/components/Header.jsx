import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaBars, FaUser, FaCog, FaSignOutAlt, FaMoon, FaSun } from "react-icons/fa";
import "../styles/Header.css";

const Header = ({ toggleSidebar }) => {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(localStorage.getItem("profileImage"));

  // ✅ Theme state (light/dark)
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // ✅ Apply theme to <html data-theme="...">
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

  // Update avatar when changed
  useEffect(() => {
    const image = localStorage.getItem("profileImage");
    setAvatar(image);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className="header">
      <FaBars className="menu-toggle" onClick={toggleSidebar} />

      {/* ✅ Right side */}
      <div className="header-right">
        {/* ✅ Dark mode button */}
        <button className="theme-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? <FaMoon /> : <FaSun />}
          <span className="theme-text">{theme === "light" ? "Dark" : "Light"}</span>
        </button>

        <div className="admin-profile" ref={dropdownRef}>
          <div className="admin-info" onClick={() => setOpen(!open)}>
            <span>Admin</span>

            {avatar ? (
              <img src={avatar} alt="profile" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">A</div>
            )}
          </div>

          {open && (
            <div className="dropdown">
              <div className="dropdown-item" onClick={() => navigate("/profile")}>
                <FaUser /> Profile
              </div>

              <div className="dropdown-item" onClick={() => navigate("/settings")}>
                <FaCog /> Settings
              </div>

              <div className="dropdown-item logout" onClick={handleLogout}>
                <FaSignOutAlt /> Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;