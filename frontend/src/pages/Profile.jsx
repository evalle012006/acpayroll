import { useState } from "react";
import "../styles/Profile.css";

const Profile = () => {
  const [image, setImage] = useState(localStorage.getItem("profileImage"));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      localStorage.setItem("profileImage", reader.result);
      setImage(reader.result);
      alert("Profile image updated!");
      window.location.reload(); // refresh header
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="profile-container">
      <h2>Admin Profile</h2>

      <div className="profile-card">
        {image ? (
          <img src={image} alt="profile" className="profile-image" />
        ) : (
          <div className="profile-placeholder">A</div>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
        />
      </div>
    </div>
  );
};

export default Profile;
