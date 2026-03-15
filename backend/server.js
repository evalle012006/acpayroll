require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const reportRoutes = require("./routes/reportRoutes");
const bonusRoutes = require("./routes/bonusRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const settlementsRoutes = require("./routes/settlementsRoutes");
const departmentsRoutes = require("./routes/departmentsRoutes");
const promotionRoutes = require("./routes/promotionRoutes");
const deploymentRoutes = require("./routes/deploymentRoutes");
const compRatesRoutes = require("./routes/compRatesRoutes");
const scheduleBalancesRoutes = require("./routes/scheduleBalancesRoutes");
const staffBalancesRoutes = require("./routes/staffBalancesRoutes");
const transferStaffOrdersRoutes = require("./routes/transferStaffOrdersRoutes");
const demotionRoutes = require("./routes/demotionRoutes");
const suspensionRoutes = require("./routes/suspensionRoutes");
const exitStaffRoutes = require("./routes/exitStaffRoutes");
const loanRequestsRoutes = require("./routes/loanRequestsRoutes");
const staffAccountsPayableRoutes = require("./routes/staffAccountsPayableRoutes");
const transportOverrideRoutes = require("./routes/transportOverrideRoutes");
const branchesRoutes = require("./routes/branchesRoutes");
const sbfRoutes = require("./routes/sbfRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use("/api/bonus", bonusRoutes);
app.use("/api/schedule-balances", scheduleBalancesRoutes);
app.use("/api/transport-overrides", transportOverrideRoutes);

app.use("/api", compRatesRoutes);
app.use("/api", staffRoutes);
app.use("/api", reportRoutes);
app.use("/api", settlementsRoutes);
app.use("/api", leaveRoutes);
app.use("/api", departmentsRoutes);
app.use("/api", promotionRoutes);
app.use("/api", deploymentRoutes);
app.use("/api", staffBalancesRoutes);
app.use("/api", transferStaffOrdersRoutes);
app.use("/api", demotionRoutes);
app.use("/api", suspensionRoutes);
app.use("/api", exitStaffRoutes);
app.use("/api", loanRequestsRoutes);
app.use("/api", staffAccountsPayableRoutes);
app.use("/api", branchesRoutes);
app.use("/api", sbfRoutes);

app.get("/test", (_req, res) => {
  res.send("Backend is working!");
});

app.get("/", (_req, res) => {
  res.send("HRIS API is running");
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});