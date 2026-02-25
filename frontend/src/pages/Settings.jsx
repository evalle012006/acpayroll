import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Settings.css";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const emitAuthChanged = () => window.dispatchEvent(new Event("auth-changed"));

const Settings = () => {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [displayName, setDisplayName] = useState(() => user?.username || "");
  const [avatar, setAvatar] = useState(() => localStorage.getItem("profileImage") || "");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const saveName = () => {
    setMsg("");

    const u = readUser();
    if (!u) {
      setMsg("No user found. Please login again.");
      return;
    }

    const next = { ...u, username: String(displayName || "").trim() || u.username };
    localStorage.setItem("user", JSON.stringify(next));
    emitAuthChanged();
    setMsg("Saved display name.");
  };

  const onPickAvatar = (file) => {
    setMsg("");
    if (!file) return;

    // basic type check
    if (!file.type.startsWith("image/")) {
      setMsg("Please select an image file.");
      return;
    }

    // Read as base64 and store in localStorage
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      localStorage.setItem("profileImage", dataUrl);
      setAvatar(dataUrl);
      emitAuthChanged();
      setMsg("Profile photo updated.");
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    localStorage.removeItem("profileImage");
    setAvatar("");
    emitAuthChanged();
    setMsg("Profile photo removed.");
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>Settings</h2>
          <p>Theme and profile preferences.</p>
        </div>

        <button className="btn btn-outline" onClick={() => navigate(-1)} type="button">
          ← Back
        </button>
      </div>

      {msg ? <div className="settings-msg">{msg}</div> : null}

      {/* THEME */}
      <div className="card settings-card">
        <div className="settings-card-title">Appearance</div>

        <div className="settings-row">
          <div className="settings-label">
            <div className="settings-label-title">Theme</div>
            <div className="settings-label-sub">Switch between light and dark mode.</div>
          </div>

          <div className="settings-actions">
            <button
              className={`btn ${theme === "light" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setTheme("light")}
              type="button"
            >
              Light
            </button>
            <button
              className={`btn ${theme === "dark" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setTheme("dark")}
              type="button"
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      {/* PROFILE */}
      <div className="card settings-card">
        <div className="settings-card-title">Profile</div>

        <div className="settings-row">
          <div className="settings-label">
            <div className="settings-label-title">Display Name</div>
            <div className="settings-label-sub">Shown in the header dropdown.</div>
          </div>

          <div className="settings-actions settings-actions-wide">
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
            <button className="btn btn-primary" onClick={saveName} type="button">
              Save
            </button>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-row">
          <div className="settings-label">
            <div className="settings-label-title">Profile Photo</div>
            <div className="settings-label-sub">Stored locally in this browser.</div>
          </div>

          <div className="settings-actions settings-actions-wide">
            <div className="avatar-preview">
              {avatar ? <img src={avatar} alt="avatar" /> : <div className="avatar-fallback">No Photo</div>}
            </div>

            <label className="btn btn-outline" style={{ cursor: "pointer" }}>
              Upload
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onPickAvatar(e.target.files?.[0])}
              />
            </label>

            <button className="btn btn-ghost" onClick={removeAvatar} type="button">
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="settings-note">
        Note: These settings are saved in <span className="mono">localStorage</span> for this device/browser.
      </div>
    </div>
  );
};

export default Settings;