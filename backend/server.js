require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const apiRoutes = require("./routes/apiRoutes");      // NEW (branches + staff moved here)
const staffRoutes = require("./routes/staffRoutes");  // keep leave/loan/staff-balances here
const reportRoutes = require("./routes/reportRoutes");
const bonusRoutes = require("./routes/bonusRoutes");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use("/api", apiRoutes);     // branches/staff + transfer/payable here / transfer-staff-orders
app.use("/api", staffRoutes);   // leave/loan/staff-balances here

app.use("/api", reportRoutes);
app.use("/api/bonus", bonusRoutes);

app.get("/test", (_req, res) => res.send("Backend is working!"));

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});