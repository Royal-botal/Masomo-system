// Configuration
const API_BASE = 'http://localhost:8080/api/v1';
let currentStaffId = null;
const LOCAL_STUDENTS_KEY = 'localStudents';

// Initialize reports on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const loginData = JSON.parse(localStorage.getItem('loginData'));
    if (!loginData || loginData.type !== 'staff') {
        window.location.href = 'login.html';
        return;
    }

    currentStaffId = loginData.staff_id;
    document.getElementById('teacher-name').textContent = loginData.full_name;

    // Load attendance sessions
    await loadSessions();
    await loadRegisteredStudents();
});

// ==================== NAVIGATION ====================

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function goToEnrollment() {
window.location.href = 'enrolment.html';
}

function goToAttendance() {
    window.location.href = 'attendance.html';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('loginData');
        window.location.href = 'login.html';
    }
}

function refreshStats() {
    // Keep current page active from sidebar action.
    return;
}

// ==================== SESSION MANAGEMENT ====================

async function loadSessions() {
    try {
        // Get all sessions from backend
        const response = await fetch(`${API_BASE}/attendance/sessions`, {
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        const sessionSelect = document.getElementById('session-select');
        
        if (data.sessions && data.sessions.length > 0) {
            sessionSelect.innerHTML = '';
            data.sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.session_id;
                option.textContent = `Session ${session.session_id} - ${session.date || 'No date'}`;
                sessionSelect.appendChild(option);
            });
        } else {
            sessionSelect.innerHTML = '<option value="">No sessions available</option>';
        }

    } catch (error) {
        console.error('Error loading sessions:', error);
        document.getElementById('session-select').innerHTML = '<option value="">Error loading sessions</option>';
    }
}

async function loadRegisteredStudents() {
    const registeredBody = document.getElementById('registered-table');
    try {
        const response = await fetch(`${API_BASE}/students`);
        const data = await response.json();
        const apiStudents = response.ok && data.success && Array.isArray(data.students) ? data.students : [];
        const localStudents = getLocalStudents();
        const students = mergeStudents(apiStudents, localStudents);

        if (students.length === 0) {
            registeredBody.innerHTML = '<tr><td colspan="5">No registered students found.</td></tr>';
            return;
        }

        registeredBody.innerHTML = students.map((student) => `
            <tr>
                <td>${student.student_id || '-'}</td>
                <td>${student.name || '-'}</td>
                <td>${student.sessions || '-'}</td>
                <td>${formatDateTime(student.created_at)}</td>
                <td>${toFaceStatus(student)}</td>
            </tr>
        `).join('');
    } catch (_error) {
        const localStudents = getLocalStudents();
        if (localStudents.length === 0) {
            registeredBody.innerHTML = '<tr><td colspan="5">Failed to load registered students.</td></tr>';
            return;
        }

        registeredBody.innerHTML = localStudents.map((student) => `
            <tr>
                <td>${student.student_id || '-'}</td>
                <td>${student.name || '-'}</td>
                <td>${student.sessions || '-'}</td>
                <td>${formatDateTime(student.created_at)}</td>
                <td>${toFaceStatus(student)}</td>
            </tr>
        `).join('');
    }
}

// ==================== REPORT GENERATION ====================

async function loadReport() {
    const sessionSelect = document.getElementById('session-select');
    const sessionId = sessionSelect.value;

    if (!sessionId) {
        alert('Please select a session');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/attendance/report/${sessionId}`);
        const report = await response.json();

        // Display summary
        document.getElementById('report-total').textContent = report.total_students || 0;
        document.getElementById('report-present').textContent = report.total_present || 0;
        document.getElementById('report-absent').textContent = report.total_absent || 0;
        document.getElementById('report-rate').textContent = (report.attendance_rate || 0).toFixed(1) + '%';

        // Display present students
        const presentBody = document.querySelector('#present-table');
        presentBody.innerHTML = '';
        if (report.present_students && report.present_students.length > 0) {
            report.present_students.forEach(student => {
                const row = `
                    <tr>
                        <td>${student.student_id}</td>
                        <td>${student.name}</td>
                        <td>${student.check_in_time || '-'}</td>
                    </tr>
                `;
                presentBody.innerHTML += row;
            });
        } else {
            presentBody.innerHTML = '<tr><td colspan="3">No present students</td></tr>';
        }

        // Display absent students
        const absentBody = document.querySelector('#absent-table');
        absentBody.innerHTML = '';
        if (report.absent_students && report.absent_students.length > 0) {
            report.absent_students.forEach(student => {
                const row = `
                    <tr>
                        <td>${student.student_id}</td>
                        <td>${student.name}</td>
                    </tr>
                `;
                absentBody.innerHTML += row;
            });
        } else {
            absentBody.innerHTML = '<tr><td colspan="2">No absent students</td></tr>';
        }

        document.getElementById('report-display').classList.remove('hidden');
        await loadRegisteredStudents();

    } catch (error) {
        console.error('Error loading report:', error);
        alert('Failed to load report');
    }
}

function printReport() {
    window.print();
}

function getLocalStudents() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_STUDENTS_KEY) || '[]');
    } catch (_error) {
        return [];
    }
}

function mergeStudents(apiStudents, localStudents) {
    const merged = [...apiStudents];
    localStudents.forEach((localStudent) => {
        const index = merged.findIndex((apiStudent) => apiStudent.student_id === localStudent.student_id);
        if (index >= 0) {
            merged[index] = { ...merged[index], ...localStudent };
        } else {
            merged.push(localStudent);
        }
    });

    return merged.sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
    });
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

function toFaceStatus(student) {
    return Number(student.has_face || 0) > 0 ? 'Yes' : 'No';
}
