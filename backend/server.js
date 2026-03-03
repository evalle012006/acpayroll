// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const reportRoutes = require("./routes/reportRoutes");
const bonusRoutes = require("./routes/bonusRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const settlementsRoutes = require("./routes/settlementsRoutes");
const sapRoutes = require("./routes/sapRoutes");
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

const app = express();

/* ------------------------- Middleware ------------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

/* ------------------------- Static Files ------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ------------------------- Routes ------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// keep exact prefixes for these
app.use("/api/bonus", bonusRoutes);
app.use("/api/schedule-balances", scheduleBalancesRoutes);

// feature routes mounted under /api
app.use("/api", compRatesRoutes);
app.use("/api", staffRoutes);
app.use("/api", reportRoutes);
app.use("/api", settlementsRoutes);
app.use("/api", sapRoutes);
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


/* ------------------------- Health Check ------------------------- */
app.get("/test", (_req, res) => res.send("Backend is working!"));

/* ------------------------- Start Server ------------------------- */
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});