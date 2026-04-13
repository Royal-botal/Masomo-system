const express = require("express");
const db = require("../db");
const crypto = require("crypto");

const router = express.Router();
const hashPassword = (value) => crypto.createHash("sha256").update(value).digest("hex");

router.post("/signin", async (req, res) => {
  try {
    const { institution_name, org_code, admin_name, email, password } = req.body;
    if (!institution_name || !org_code || !admin_name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const passwordHash = hashPassword(password);
    const [orgResult] = await db.query(
      `INSERT INTO organizations (org_name, org_code, admin_password_hash)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE org_name = VALUES(org_name), admin_password_hash = VALUES(admin_password_hash)`,
      [institution_name, org_code, passwordHash]
    );

    const orgId = orgResult.insertId || (await db.query(`SELECT org_id FROM organizations WHERE org_code = ? LIMIT 1`, [org_code]))[0][0].org_id;

    await db.query(
      `INSERT INTO staff (org_id, full_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'Admin')
       ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       password_hash = VALUES(password_hash),
       org_id = VALUES(org_id)`,
      [orgId, admin_name, email, passwordHash]
    );

    return res.status(201).json({ success: true, message: "Institution account created." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create account.", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const [rows] = await db.query(
      `SELECT s.staff_id, s.full_name, s.email, s.password_hash, s.role, o.org_name
       FROM staff s
       INNER JOIN organizations o ON o.org_id = s.org_id
       WHERE s.email = ?
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0 || rows[0].password_hash !== hashPassword(password)) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const user = rows[0];
    return res.json({
      success: true,
      loginData: {
        type: "staff",
        staff_id: user.staff_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        institution: user.org_name
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed.", error: error.message });
  }
});

router.get("/staff/:staffId/lessons", async (req, res) => {
  try {
    const staffId = Number(req.params.staffId);
    if (!staffId) {
      return res.status(400).json({ success: false, message: "Invalid staff id." });
    }

    const [rows] = await db.query(
      `SELECT lesson_id, lesson_name, lesson_code
       FROM lessons
       WHERE staff_id = ?
       ORDER BY lesson_name ASC`,
      [staffId]
    );

    const lessons = {};
    rows.forEach((row) => {
      lessons[row.lesson_id] = {
        name: row.lesson_name,
        code: row.lesson_code
      };
    });

    return res.json({ success: true, lessons });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load lessons.", error: error.message });
  }
});

module.exports = router;
