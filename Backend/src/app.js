const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    return res.json({ success: true, status: "ok" });
  } catch (error) {
    return res.status(500).json({ success: false, status: "db_error", error: error.message });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/attendance", attendanceRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.listen(port, () => {
  console.log(`Masomo backend listening on http://localhost:${port}`);
});
