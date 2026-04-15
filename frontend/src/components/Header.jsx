import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {FaBars, FaUser, FaCog, FaSignOutAlt, FaMoon, FaSun, FaBell, FaCheck, FaTrash,} from "react-icons/fa";
import { TbMessageCircle } from "react-icons/tb";
import { GoSidebarCollapse } from "react-icons/go";
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

const NOTIF_KEY = "notifications_v1";

const readNotifs = () => {
  try {
    const v = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const writeNotifs = (list) => localStorage.setItem(NOTIF_KEY, JSON.stringify(list));

const newNotif = ({ title = "Notification", message = "", type = "info" } = {}) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  message,
  type,
  read: false,
  created_at: new Date().toISOString(),
});

const toDateTimeLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

const Header = ({ toggleSidebar }) => {
  const navigate = useNavigate();

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [user, setUser] = useState(() => readUser());
  const [avatar, setAvatar] = useState(() => readAvatar());
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [notifications, setNotifications] = useState(() => readNotifs());

  const displayName = user?.username || "User";
  const displayRole = user?.role || "Unknown";

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  useEffect(() => {
    const handleClickOutside = (event) => {
      const p = profileRef.current;
      const n = notifRef.current;

      const clickedProfile = p && p.contains(event.target);
      const clickedNotif = n && n.contains(event.target);

      if (!clickedProfile) setProfileOpen(false);
      if (!clickedNotif) setNotifOpen(false);
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

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === NOTIF_KEY) setNotifications(readNotifs());
    };

    const onNotify = (e) => {
      const detail = e?.detail || {};
      setNotifications((prev) => {
        const next = [newNotif(detail), ...prev].slice(0, 50);
        writeNotifs(next);
        return next;
      });
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("notify", onNotify);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("notify", onNotify);
    };
  }, []);

  const handleLogout = useCallback(() => {
    setProfileOpen(false);
    setNotifOpen(false);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    emitAuthChanged();
    navigate("/login", { replace: true });
  }, [navigate]);

  const toggleNotif = () => {
    setNotifOpen((v) => !v);
    setProfileOpen(false);
  };

  const toggleProfile = () => {
    setProfileOpen((v) => !v);
    setNotifOpen(false);
  };

  const markAllRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      writeNotifs(next);
      return next;
    });
  };

  const clearNotifs = () => {
    if (!window.confirm("Clear all notifications?")) return;
    setNotifications([]);
    writeNotifs([]);
  };

  const markOneRead = (id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      writeNotifs(next);
      return next;
    });
  };

  return (
    <div className="header">
      <button className="menu-toggle" onClick={toggleSidebar}>
        <GoSidebarCollapse />
      </button>

      <div className="header-right">

        <button className="theme-btn" onClick={toggleTheme} type="button">
          {theme === "light" ? <FaMoon /> : <FaSun />}
          <span className="theme-text">{theme === "light" ? "Dark" : "Light"}</span>
        </button>

        <TbMessageCircle />

        <div className="notif-wrap" ref={notifRef}>
          <button className="notif-btn" type="button" onClick={toggleNotif} aria-label="Notifications">
            <FaBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-head">
                <div className="notif-title">Notifications</div>

                <div className="notif-actions">
                  <button className="notif-action" type="button" onClick={markAllRead} title="Mark all as read">
                    <FaCheck />
                  </button>
                  <button className="notif-action" type="button" onClick={clearNotifs} title="Clear all">
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications.</div>
                ) : (
                  notifications.slice(0, 12).map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? "read" : "unread"}`}
                      onClick={() => markOneRead(n.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="notif-item-top">
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-time">{toDateTimeLabel(n.created_at)}</div>
                      </div>
                      {n.message ? <div className="notif-item-msg">{n.message}</div> : null}
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 12 ? (
                <div className="notif-foot">
                  <span style={{ opacity: 0.8, fontSize: 12 }}>
                    Showing 12 of {notifications.length}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="admin-profile" ref={profileRef}>
          <div className="admin-info" onClick={toggleProfile} role="button" tabIndex={0}>
            <div className="admin-label">
              <div className="admin-name">{displayName}</div>
              <div className="admin-role">{displayRole}</div>
            </div>

            {avatar ? (
              <img src={avatar} alt="profile" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">{String(displayName).slice(0, 1).toUpperCase()}</div>
            )}
          </div>

          {profileOpen && (
            <div className="dropdown">
              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/profile");
                }}
              >
                <FaUser /> Profile
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/settings");
                }}
              >
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