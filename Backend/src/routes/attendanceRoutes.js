const express = require("express");
const db = require("../db");

const router = express.Router();

router.post("/start-session", async (req, res) => {
  try {
    const lessonId = Number(req.body.lesson_id);
    if (!lessonId) {
      return res.status(400).json({ success: false, message: "lesson_id is required." });
    }

    const [existing] = await db.query(
      `SELECT session_id
       FROM attendance_sessions
       WHERE lesson_id = ? AND session_date = CURDATE() AND status = 'Active'
       LIMIT 1`,
      [lessonId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, session_id: existing[0].session_id, reused: true });
    }

    const [result] = await db.query(
      `INSERT INTO attendance_sessions (lesson_id, session_date, status)
       VALUES (?, CURDATE(), 'Active')`,
      [lessonId]
    );

    return res.json({ success: true, session_id: result.insertId });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to start session.", error: error.message });
  }
});

router.post("/close-session", async (req, res) => {
  try {
    const sessionId = Number(req.body.session_id);
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "session_id is required." });
    }

    await db.query(
      `UPDATE attendance_sessions
       SET status = 'Closed', session_end = NOW()
       WHERE session_id = ?`,
      [sessionId]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to close session.", error: error.message });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const sessionId = Number(req.body.session_id);
    const faceData = req.body.faceData || null;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "session_id is required." });
    }

    const [sessionRows] = await db.query(
      `SELECT lesson_id, status
       FROM attendance_sessions
       WHERE session_id = ?
       LIMIT 1`,
      [sessionId]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    if (sessionRows[0].status !== "Active") {
      return res.status(400).json({ success: false, message: "Session is not active." });
    }

    const lessonId = sessionRows[0].lesson_id;

    const [students] = await db.query(
      `SELECT student_id
       FROM students
       ORDER BY created_at ASC`
    );

    if (students.length === 0) {
      return res.json({ success: false, message: "No students available for recognition." });
    }

    let matchedStudentId = null;
    for (const student of students) {
      const [existingLog] = await db.query(
        `SELECT log_id FROM attendance_logs
         WHERE session_id = ? AND student_id = ?
         LIMIT 1`,
        [sessionId, student.student_id]
      );
      if (existingLog.length === 0) {
        matchedStudentId = student.student_id;
        break;
      }
    }

    if (!matchedStudentId) {
      return res.json({ success: false, message: "All students are already marked present." });
    }

    await db.query(
      `INSERT INTO attendance_logs (session_id, student_id, lesson_id, status, check_in_time, face_capture)
       VALUES (?, ?, ?, 'Present', NOW(), ?)`,
      [sessionId, matchedStudentId, lessonId, faceData]
    );

    return res.json({ success: true, student_id: matchedStudentId });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Face verification failed.", error: error.message });
  }
});

router.get("/sessions", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT session_id, session_date AS date, status
       FROM attendance_sessions
       ORDER BY session_id DESC`
    );
    return res.json({ success: true, sessions: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load sessions.", error: error.message });
  }
});

router.get("/report/:sessionId", async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Invalid session id." });
    }

    const [sessionRows] = await db.query(
      `SELECT lesson_id FROM attendance_sessions WHERE session_id = ? LIMIT 1`,
      [sessionId]
    );
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const lessonId = sessionRows[0].lesson_id;

    const [allStudents] = await db.query(
      `SELECT student_id, name
       FROM students
       ORDER BY name ASC`
    );

    const [presentStudents] = await db.query(
      `SELECT s.student_id, s.name, al.check_in_time
       FROM attendance_logs al
       INNER JOIN students s ON s.student_id = al.student_id
       WHERE al.session_id = ? AND al.lesson_id = ? AND al.status = 'Present'
       ORDER BY al.check_in_time ASC`,
      [sessionId, lessonId]
    );

    const presentIds = new Set(presentStudents.map((student) => student.student_id));
    const absentStudents = allStudents.filter((student) => !presentIds.has(student.student_id));
    const totalStudents = allStudents.length;
    const totalPresent = presentStudents.length;
    const totalAbsent = absentStudents.length;
    const attendanceRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

    return res.json({
      success: true,
      total_students: totalStudents,
      total_present: totalPresent,
      total_absent: totalAbsent,
      attendance_rate: attendanceRate,
      present_students: presentStudents,
      absent_students: absentStudents
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load report.", error: error.message });
  }
});

module.exports = router;
