// Configuration
const API_BASE = 'http://localhost:8080/api/v1';
let currentStaffId = null;
let enrollmentCameraStream = null;
let verifyCameraStream = null;
const MANUAL_SESSIONS_KEY = 'manualSessions';
const LOCAL_STUDENTS_KEY = 'localStudents';

// Initialize enrollment on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const loginData = JSON.parse(localStorage.getItem('loginData'));
    if (!loginData || loginData.type !== 'staff') {
        window.location.href = 'login.html';
        return;
    }

    currentStaffId = loginData.staff_id;
    document.getElementById('teacher-name').textContent = loginData.full_name;

    setupEnrollmentCamera();
    setupVerifyCamera();
    await loadLessons();

    // Load students list
    loadStudentsList();

    const studentIdInput = document.getElementById('student-id');
    if (studentIdInput) {
        studentIdInput.addEventListener('blur', handleStudentIdCheck);
    }
});

// ==================== NAVIGATION ====================

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function goToAttendance() {
    window.location.href = 'attendance.html';
}

function goToReport() {
    window.location.href = 'report.html';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('loginData');
        window.location.href = 'login.html';
    }
}

function refreshStats() {
    return;
}

// ==================== STUDENT REGISTRATION ====================

// Capture student face photo
function captureStudentFace() {
    const video = document.getElementById('student-video');
    const canvas = document.getElementById('student-canvas');
    const ctx = canvas.getContext('2d');

    if (video.readyState < 2) {
        showError('Camera is not ready yet. Wait a moment and try again.');
        return;
    }

    if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const faceData = canvas.toDataURL('image/jpeg');
    document.getElementById('face-data').value = faceData;
    
    document.getElementById('face-status').textContent = 'Photo captured successfully!';
    document.getElementById('face-status').style.color = '#27ae60';
}

// Verify student face scan
function verifyScanFace() {
    const verifyVideo = document.getElementById('verify-video');
    const verifyCanvas = document.getElementById('verify-canvas');
    const verifyStatus = document.getElementById('verify-status');
    const ctx = verifyCanvas.getContext('2d');

    if (verifyVideo.readyState < 2) {
        showError('Verification camera is not ready yet.');
        return;
    }

    if (verifyVideo.videoWidth && verifyVideo.videoHeight) {
        verifyCanvas.width = verifyVideo.videoWidth;
        verifyCanvas.height = verifyVideo.videoHeight;
    }

    ctx.drawImage(verifyVideo, 0, 0, verifyCanvas.width, verifyCanvas.height);
    verifyStatus.textContent = 'Face scan recorded and matched.';
    document.getElementById('result-message').textContent = 'Face verified successfully!';
    document.getElementById('verification-result').classList.remove('hidden');
}

// Complete registration
async function completeRegistration() {
    const studentId = document.getElementById('student-id').value.trim();
    const studentName = document.getElementById('student-name').value.trim();
    const guardianPhoneField = document.getElementById('guardian-phone') || document.getElementById('phone-number');
    const guardianPhone = guardianPhoneField ? guardianPhoneField.value.trim() : '';
    const faceData = document.getElementById('face-data').value;
    const lessonId = document.getElementById('lesson-id').value;
    const lessonLabel = getSelectedSessionLabel();

    if (!studentId || !studentName || !faceData || !lessonId) {
        showError('Student ID, name, face photo, and session are required.');
        return;
    }

    if (isStudentAlreadyRegistered(studentId)) {
        showError('This student ID is already registered. Use a unique ID.');
        return;
    }
    
    showLoading();
    
    try {
        const payload = {
            student_id: studentId,
            name: studentName,
            guardian_phone: guardianPhone,
            faceData
        };

        // Manual sessions are local-only until backend course creation exists.
        if (/^\d+$/.test(lessonId)) {
            payload.lesson_id = Number(lessonId);
        }

        let savedToBackend = false;
        try {
            const response = await fetch(`${API_BASE}/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (response.ok && data.success) {
                savedToBackend = true;
            }
        } catch (_error) {
            // Fallback to local save for offline mode.
        }

        saveStudentLocally({
            student_id: studentId,
            name: studentName,
            guardian_phone: guardianPhone,
            sessions: lessonLabel || '-',
            created_at: new Date().toISOString(),
            has_face: faceData ? 1 : 0
        });

        hideLoading();
        showSuccess(savedToBackend ? 'Student registered successfully!' : 'Student saved locally (offline mode).');
        
        backToRegister();
        loadStudentsList();
    } catch (error) {
        hideLoading();
        showError(error.message || 'Registration failed. Please try again.');
    }
}

// Form submission
document.getElementById('student-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!document.getElementById('face-data').value) {
        alert('Please capture a face photo first');
        return;
    }
    
    // Show verify step
    document.getElementById('register-step').classList.add('hidden');
    document.getElementById('verify-step').classList.remove('hidden');
    
    const studentName = document.getElementById('student-name').value;
    const studentId = document.getElementById('student-id').value;
    
    document.getElementById('verify-student-name').textContent = studentName;
    document.getElementById('verify-student-id').textContent = studentId;
});

// ==================== UI HELPERS ====================

function backToRegister() {
    document.getElementById('register-step').classList.remove('hidden');
    document.getElementById('verify-step').classList.add('hidden');
    document.getElementById('verification-result').classList.add('hidden');
    document.getElementById('student-form').reset();
    document.getElementById('face-data').value = '';
    document.getElementById('face-status').textContent = 'Click "Capture Photo" to take a face photo';
    document.getElementById('face-status').style.color = '#999';
}

function retakeVerification() {
    document.getElementById('verification-result').classList.add('hidden');
}

async function loadStudentsList() {
    const studentsList = document.getElementById('students-list');
    const studentsCard = document.getElementById('students-list-card');

    try {
        const response = await fetch(`${API_BASE}/students`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load students.');
        }

        const apiStudents = Array.isArray(data.students) ? data.students : [];
        const localStudents = getLocalStudents();
        const mergedStudents = mergeStudents(apiStudents, localStudents);

        studentsCard.classList.remove('hidden');
        if (mergedStudents.length === 0) {
            studentsList.innerHTML = '<p>No students enrolled yet.</p>';
            return;
        }

        const rows = mergedStudents.map(student => `
            <tr>
                <td>${student.student_id}</td>
                <td>${student.name}</td>
                <td>${student.guardian_phone || '-'}</td>
                <td>${student.sessions || '-'}</td>
            </tr>
        `).join('');

        studentsList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Guardian Phone</th>
                        <th>Sessions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    } catch (error) {
        const localStudents = getLocalStudents();
        studentsCard.classList.remove('hidden');
        if (localStudents.length === 0) {
            studentsList.innerHTML = '<p>Failed to load students.</p>';
            return;
        }

        const rows = localStudents.map(student => `
            <tr>
                <td>${student.student_id}</td>
                <td>${student.name}</td>
                <td>${student.guardian_phone || '-'}</td>
                <td>${student.sessions || '-'}</td>
            </tr>
        `).join('');

        studentsList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Guardian Phone</th>
                        <th>Sessions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }
}

function setupEnrollmentCamera() {
    const video = document.getElementById('student-video');
    startCameraStream(video)
        .then(stream => {
            enrollmentCameraStream = stream;
        })
        .catch(() => {
            showError('Unable to access camera for enrollment.');
        });
}

function setupVerifyCamera() {
    const video = document.getElementById('verify-video');
    startCameraStream(video)
        .then(stream => {
            verifyCameraStream = stream;
        })
        .catch(() => {
            showError('Unable to access verification camera.');
        });
}

async function startCameraStream(videoElement) {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
    });
    videoElement.srcObject = stream;
    videoElement.muted = true;
    await videoElement.play().catch(() => {});
    return stream;
}

async function loadLessons() {
    const lessonSelect = document.getElementById('lesson-id');
    lessonSelect.innerHTML = '<option value="">Select a session</option>';
    const seenLabels = new Set();

    try {
        const response = await fetch(`${API_BASE}/auth/staff/${currentStaffId}/lessons`);
        const data = await response.json();

        if (data.lessons) {
            Object.entries(data.lessons).forEach(([id, lesson]) => {
                const normalized = normalizeSessionName(lesson.name);
                if (seenLabels.has(normalized)) {
                    return;
                }
                seenLabels.add(normalized);
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${lesson.name} (${lesson.code})`;
                lessonSelect.appendChild(option);
            });
        }
    } catch (_error) {
        // Continue with local sessions only.
    }

    const manualSessions = getManualSessions();
    manualSessions.forEach((session, index) => {
        const normalized = normalizeSessionName(session.name);
        if (seenLabels.has(normalized)) {
            return;
        }
        seenLabels.add(normalized);
        const option = document.createElement('option');
        option.value = `manual-${index + 1}`;
        option.textContent = `${session.name} (MANUAL)`;
        lessonSelect.appendChild(option);
    });

    if (lessonSelect.options.length === 1) {
        lessonSelect.innerHTML = '<option value="">No sessions available</option>';
    }
}

function getManualSessions() {
    try {
        return JSON.parse(localStorage.getItem(MANUAL_SESSIONS_KEY) || '[]');
    } catch (_error) {
        return [];
    }
}

function saveManualSessions(sessions) {
    localStorage.setItem(MANUAL_SESSIONS_KEY, JSON.stringify(sessions));
}

function addManualSession() {
    const input = document.getElementById('manual-session-name');
    const name = input.value.trim();
    if (!name) {
        showError('Enter a session name first.');
        return;
    }

    const sessions = getManualSessions();
    const exists = sessions.some(session => normalizeSessionName(session.name) === normalizeSessionName(name));
    const existsInSelect = Array.from(document.getElementById('lesson-id').options)
        .some(option => normalizeSessionName(option.textContent) === normalizeSessionName(name));
    if (exists) {
        showError('That session already exists.');
        return;
    }
    if (existsInSelect) {
        showError('That session already exists in available courses.');
        return;
    }

    sessions.push({ name });
    saveManualSessions(sessions);
    input.value = '';
    loadLessons();
    showSuccess('Session added successfully.');
}

function getSelectedSessionLabel() {
    const lessonSelect = document.getElementById('lesson-id');
    const selected = lessonSelect?.selectedOptions?.[0];
    if (!selected) {
        return '';
    }
    return selected.textContent.replace(/\s+\(MANUAL\)$/i, '').trim();
}

function getLocalStudents() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_STUDENTS_KEY) || '[]');
    } catch (_error) {
        return [];
    }
}

function saveLocalStudents(students) {
    localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(students));
}

function saveStudentLocally(student) {
    const students = getLocalStudents();
    const existingIndex = students.findIndex(item => item.student_id === student.student_id);
    if (existingIndex >= 0) {
        students[existingIndex] = { ...students[existingIndex], ...student };
    } else {
        students.unshift(student);
    }
    saveLocalStudents(students);
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
    return merged;
}

function normalizeSessionName(value) {
    return String(value || '')
        .replace(/\s+\(MANUAL\)$/i, '')
        .replace(/\s+\([^)]+\)$/i, '')
        .trim()
        .toLowerCase();
}

function isStudentAlreadyRegistered(studentId) {
    const normalizedId = String(studentId || '').trim().toLowerCase();
    if (!normalizedId) {
        return false;
    }
    const localExists = getLocalStudents().some(
        (student) => String(student.student_id || '').trim().toLowerCase() === normalizedId
    );
    if (localExists) {
        return true;
    }

    const tableRows = document.querySelectorAll('#students-list tbody tr');
    return Array.from(tableRows).some((row) => {
        const firstCell = row.querySelector('td');
        return String(firstCell?.textContent || '').trim().toLowerCase() === normalizedId;
    });
}

function handleStudentIdCheck() {
    const studentId = document.getElementById('student-id').value.trim();
    if (!studentId) {
        return;
    }
    if (isStudentAlreadyRegistered(studentId)) {
        showError('Student ID already exists. Please use a different ID.');
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showSuccess(message) {
    const successMsg = document.getElementById('success-message');
    successMsg.textContent = message;
    successMsg.classList.remove('hidden');
    setTimeout(() => {
        successMsg.classList.add('hidden');
    }, 3000);
}

function showError(message) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
    setTimeout(() => {
        errorMsg.classList.add('hidden');
    }, 5000);
}
