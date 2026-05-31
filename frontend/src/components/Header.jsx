import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUser,
  FaCog,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBell,
  FaCheck,
  FaTrash,
} from "react-icons/fa";
import { IoChatbubbleEllipses } from "react-icons/io5";
import { BsMessenger } from "react-icons/bs";
import { GoSidebarCollapse } from "react-icons/go";
import api from "../api/axiosClient";
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
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  const displayName =
    [user?.first_name, user?.middle_name, user?.last_name]
      .filter(Boolean)
      .join(" ") ||
    user?.username ||
    "User";

  const displayRole = user?.role || "Unknown";

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.get("/notifications", {
        params: { limit: 20 },
      });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(
        "Failed to load notifications:",
        err?.response?.data || err?.message || err
      );
      setNotifications([]);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  const loadChatUnread = useCallback(async () => {
    try {
      const res = await api.get("/chat/unread-count");
      setChatUnread(Number(res.data?.unread_count || 0));
    } catch {
      setChatUnread(0);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    loadChatUnread();

    const interval = setInterval(() => {
      loadChatUnread();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadChatUnread]);

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
      loadNotifications();
      loadChatUnread();
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, [loadNotifications, loadChatUnread]);

  const handleLogout = useCallback(() => {
    setProfileOpen(false);
    setNotifOpen(false);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    emitAuthChanged();
    navigate("/login", { replace: true });
  }, [navigate]);

  const toggleNotif = async () => {
    setNotifOpen((v) => !v);
    setProfileOpen(false);

    if (!notifOpen) {
      await loadNotifications();
    }
  };

  const toggleProfile = () => {
    setProfileOpen((v) => !v);
    setNotifOpen(false);
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      await loadNotifications();
    } catch (err) {
      console.error(
        "Failed to mark all notifications read:",
        err?.response?.data || err?.message || err
      );
    }
  };

  const clearNotifs = async () => {
    if (!window.confirm("Clear visible notifications?")) return;

    try {
      await api.delete("/notifications/clear-all");
      await loadNotifications();
    } catch (err) {
      console.error(
        "Failed to clear notifications:",
        err?.response?.data || err?.message || err
      );
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      await loadNotifications();
    } catch (err) {
      console.error(
        "Failed to mark notification read:",
        err?.response?.data || err?.message || err
      );
    }
  };

  return (
    <div className="header">
      <button className="menu-toggle" onClick={toggleSidebar} type="button">
        <GoSidebarCollapse />
      </button>

      <div className="header-right">
        <button className="theme-btn" onClick={toggleTheme} type="button">
          {theme === "light" ? <FaMoon /> : <FaSun />}
          <span className="theme-text">
            {theme === "light" ? "Dark" : "Light"}
          </span>
        </button>

        <button
          className="notif-btn"
          type="button"
          onClick={() => {
            setNotifOpen(false);
            setProfileOpen(false);
            navigate("/chat");
          }}
          aria-label="Chat"
        >
          <BsMessenger />

          {chatUnread > 0 && (
            <span className="notif-badge">
              {chatUnread > 99 ? "99+" : chatUnread}
            </span>
          )}
        </button>

        <div className="notif-wrap" ref={notifRef}>
          <button
            className="notif-btn"
            type="button"
            onClick={toggleNotif}
            aria-label="Notifications"
          >
            <FaBell />

            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-head">
                <div className="notif-title">Notifications</div>

                <div className="notif-actions">
                  <button
                    className="notif-action"
                    type="button"
                    onClick={markAllRead}
                    title="Mark all as read"
                  >
                    <FaCheck />
                  </button>

                  <button
                    className="notif-action"
                    type="button"
                    onClick={clearNotifs}
                    title="Clear visible"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="notif-list">
                {loadingNotifs ? (
                  <div className="notif-empty">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="notif-empty">No notifications.</div>
                ) : (
                  notifications.slice(0, 12).map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.is_read ? "read" : "unread"}`}
                      onClick={() => markOneRead(n.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="notif-item-top">
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-time">
                          {toDateTimeLabel(n.created_at)}
                        </div>
                      </div>

                      {n.message ? (
                        <div className="notif-item-msg">{n.message}</div>
                      ) : null}

                      {n.target_branch_code || n.target_branch_name ? (
                        <div
                          className="notif-item-msg"
                          style={{ opacity: 0.75, marginTop: 4 }}
                        >
                          Branch:{" "}
                          {[n.target_branch_code, n.target_branch_name]
                            .filter(Boolean)
                            .join(" - ")}
                        </div>
                      ) : null}
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
          <div
            className="admin-info"
            onClick={toggleProfile}
            role="button"
            tabIndex={0}
          >
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