import { useMemo, useState } from "react";
import "../styles/Profile.css";

const Profile = () => {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);

  const [image, setImage] = useState(localStorage.getItem("profileImage") || "");
  const [saving, setSaving] = useState(false);

  const initials = useMemo(() => {
    const name = user?.username || "Admin";
    return String(name).trim().charAt(0).toUpperCase();
  }, [user]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return alert("Please upload an image file.");
    if (file.size > 2 * 1024 * 1024) return alert("Max file size is 2MB.");

    setSaving(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      localStorage.setItem("profileImage", reader.result);
      setImage(reader.result);
      setSaving(false);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    localStorage.removeItem("profileImage");
    setImage("");
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <h2 className="profile-title">Profile</h2>
          <p className="profile-subtitle">Manage your account photo</p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-top">
          <div className="avatar">
            {image ? (
              <img src={image} alt="profile" />
            ) : (
              <div className="avatar-fallback">{initials}</div>
            )}
          </div>

          <div className="profile-meta">
            <div className="profile-name">{user?.username || "Admin"}</div>
            <div className="profile-role">{user?.role || "Administrator"}</div>
            <div className="profile-hint">PNG/JPG up to 2MB</div>
          </div>
        </div>

        <div className="profile-actions">
          <label className="btn-primary file-btn">
            {saving ? "Uploading..." : "Upload photo"}
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={saving} />
          </label>

          <button className="btn-secondary" type="button" onClick={removePhoto} disabled={!image || saving}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;