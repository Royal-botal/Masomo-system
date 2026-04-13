const API_BASE = 'http://localhost:8080/api/v1';
const LOCAL_STUDENTS_KEY = 'localStudents';
const MANUAL_SESSIONS_KEY = 'manualSessions';
let selectedSessionName = '';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Cyberpunk Dashboard Loaded');
    const activeUser = JSON.parse(localStorage.getItem('loginData'));
    if (!activeUser || activeUser.type !== 'staff') {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('teacher-name').textContent = activeUser?.full_name || 'Demo Teacher';

    await loadSessionFilter(activeUser.staff_id);
    await refreshStats();
    initCardParticles();
    initParallax();
});

function animateCounters(counters) {
    Object.entries(counters).forEach(([id, targetValue]) => {
        const element = document.getElementById(id);
        if (element) {
            const target = Number(targetValue || 0);
            let current = 0;
            const increment = Math.max(1, Math.ceil(target / 50));
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    element.textContent = target;
                    clearInterval(timer);
                } else {
                    element.textContent = Math.floor(current);
                }
            }, 20);
        }
    });
}

async function computeDashboardStats() {
    const fallback = getFallbackStats();

    try {
        const [studentsResponse, sessionsResponse] = await Promise.all([
            fetch(`${API_BASE}/students`),
            fetch(`${API_BASE}/attendance/sessions`)
        ]);

        const studentsData = await studentsResponse.json();
        const sessionsData = await sessionsResponse.json();

        const apiStudents = studentsResponse.ok && studentsData.success && Array.isArray(studentsData.students)
            ? studentsData.students
            : [];
        const localStudents = getLocalStudents();
        const mergedStudents = mergeStudents(apiStudents, localStudents);

        const sessions = sessionsResponse.ok && sessionsData.success && Array.isArray(sessionsData.sessions)
            ? sessionsData.sessions
            : [];

        const activeSessions = sessions.filter((session) => session.status === 'Active').length;
        const completedSessions = sessions.filter((session) => session.status === 'Closed').length;

        return {
            'active-sessions': activeSessions,
            'total-students': mergedStudents.length,
            'completed-sessions': completedSessions,
            'students-in-session': countStudentsInSession(mergedStudents, selectedSessionName)
        };
    } catch (_error) {
        return fallback;
    }
}

function getFallbackStats() {
    const localStudents = getLocalStudents();
    return {
        'active-sessions': 0,
        'total-students': localStudents.length,
        'completed-sessions': 0,
        'students-in-session': countStudentsInSession(localStudents, selectedSessionName)
    };
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
    return merged;
}

async function loadSessionFilter(staffId) {
    const sessionFilter = document.getElementById('session-filter');
    const sessionNames = new Set();
    sessionFilter.innerHTML = '<option value="">All Sessions</option>';

    try {
        const response = await fetch(`${API_BASE}/auth/staff/${staffId}/lessons`);
        const data = await response.json();
        if (response.ok && data.success && data.lessons) {
            Object.values(data.lessons).forEach((lesson) => {
                const normalized = normalizeSessionName(lesson.name);
                if (!normalized || sessionNames.has(normalized)) {
                    return;
                }
                sessionNames.add(normalized);
                const option = document.createElement('option');
                option.value = lesson.name;
                option.textContent = lesson.name;
                sessionFilter.appendChild(option);
            });
        }
    } catch (_error) {
        // Use local/manual sessions below.
    }

    const manualSessions = getManualSessions();
    manualSessions.forEach((session) => {
        const normalized = normalizeSessionName(session.name);
        if (!normalized || sessionNames.has(normalized)) {
            return;
        }
        sessionNames.add(normalized);
        const option = document.createElement('option');
        option.value = session.name;
        option.textContent = session.name;
        sessionFilter.appendChild(option);
    });

    sessionFilter.addEventListener('change', () => {
        selectedSessionName = sessionFilter.value || '';
        refreshStats();
    });
}

function getManualSessions() {
    try {
        return JSON.parse(localStorage.getItem(MANUAL_SESSIONS_KEY) || '[]');
    } catch (_error) {
        return [];
    }
}

function normalizeSessionName(value) {
    return String(value || '')
        .replace(/\s+\(MANUAL\)$/i, '')
        .replace(/\s+\([^)]+\)$/i, '')
        .trim()
        .toLowerCase();
}

function countStudentsInSession(students, sessionName) {
    if (!sessionName) {
        return students.length;
    }
    const target = normalizeSessionName(sessionName);
    return students.filter((student) => {
        const sessionsRaw = String(student.sessions || '');
        const sessions = sessionsRaw
            .split(',')
            .map((entry) => normalizeSessionName(entry))
            .filter(Boolean);
        return sessions.includes(target);
    }).length;
}

// Particle Burst on Card Hover
function initCardParticles() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', createParticles);
    });
}

function createParticles(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            width: 4px;
            height: 4px;
            background: var(--neon-cyan);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            box-shadow: 0 0 8px var(--neon-cyan);
        `;
        
        document.body.appendChild(particle);
        
        const angle = (Math.PI * 2 * i) / 12;
        const velocity = 100 + Math.random() * 100;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        let progress = 0;
        const duration = 800;
        const start = performance.now();
        
        const animate = (now) => {
            progress = (now - start) / duration;
            if (progress > 1) progress = 1;
            
            const x = centerX + vx * progress;
            const y = centerY + vy * progress;
            const opacity = 1 - progress;
            
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.opacity = opacity;
            particle.style.transform = `scale(${1 - progress})`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                particle.remove();
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Parallax Scroll Effect
function initParallax() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallax = document.querySelector('.dashboard-container::before');
        if (parallax) {
            parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
    });
}

// Smart Single Page Navigation - Same Tab
function goToEnrollment() {
    window.location.href = 'enrolment.html';
}

function goToAttendance() {
    window.location.href = 'attendance.html';
}

function goToReport() {
    window.location.href = 'report.html';
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function refreshStats() {
    computeDashboardStats().then((counters) => animateCounters(counters));
}

function logout() {
    if (confirm('Log out of MASOMO-TRACK?')) {
        localStorage.removeItem('loginData');
        window.location.href = 'login.html';
    }
}

// Export global functions
window.goToEnrollment = goToEnrollment;
window.goToAttendance = goToAttendance;
window.goToReport = goToReport;
window.goToDashboard = goToDashboard;
window.logout = logout;
window.refreshStats = refreshStats;
