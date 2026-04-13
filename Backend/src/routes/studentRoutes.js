const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.student_id, s.name, s.guardian_phone, s.created_at,
              CASE WHEN s.face_vector IS NOT NULL AND s.face_vector <> '' THEN 1 ELSE 0 END AS has_face,
              GROUP_CONCAT(l.lesson_name ORDER BY l.lesson_name SEPARATOR ', ') AS sessions
       FROM students s
       LEFT JOIN student_enrollment se ON se.student_id = s.student_id
       LEFT JOIN lessons l ON l.lesson_id = se.lesson_id
       GROUP BY s.student_id, s.name, s.guardian_phone, s.created_at
       ORDER BY created_at DESC`
    );
    return res.json({ success: true, students: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch students.", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { student_id, name, guardian_phone, faceData, lesson_id } = req.body;
    if (!student_id || !name) {
      return res.status(400).json({ success: false, message: "student_id and name are required." });
    }

    await db.query(
      `INSERT INTO students (student_id, name, guardian_phone, face_vector)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       guardian_phone = VALUES(guardian_phone),
       face_vector = VALUES(face_vector)`,
      [student_id, name, guardian_phone || null, faceData || null]
    );

    if (lesson_id) {
      await db.query(
        `INSERT INTO student_enrollment (student_id, lesson_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE enrolled_at = CURRENT_TIMESTAMP`,
        [student_id, Number(lesson_id)]
      );
    }

    return res.status(201).json({ success: true, message: "Student saved successfully with session enrollment." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to save student.", error: error.message });
  }
});

module.exports = router;
