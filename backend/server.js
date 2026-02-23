require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", staffRoutes);
app.use("/api", reportRoutes);

app.get("/test", (_req, res) => res.send("Backend is working!"));

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});