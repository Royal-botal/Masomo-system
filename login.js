const API_BASES = [
    'http://localhost:8080/api/v1',
    'http://127.0.0.1:8080/api/v1'
];

async function checkBackendStatus() {
    const statusEl = document.getElementById('backend-status');
    if (!statusEl) return;
    statusEl.textContent = 'Offline mode: server bypass enabled.';
    statusEl.classList.add('status-ok');
    statusEl.classList.remove('status-bad');
}

async function postWithFallback(path, payload) {
    let lastError = null;

    for (const base of API_BASES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${base}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();
            return { response, data };
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(
        lastError?.name === 'AbortError'
            ? 'Server timeout. Ensure backend is running on port 8080.'
            : 'Cannot reach backend server. Start backend and try again.'
    );
}

checkBackendStatus();

document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('login-message');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    message.className = '';
    message.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        if (!email || !password) {
            throw new Error('Please provide email and password.');
        }

        const savedAccount = JSON.parse(localStorage.getItem('devInstitutionAccount') || '{}');
        const fullName = savedAccount.admin_name || email.split('@')[0] || 'Staff User';
        const institution = savedAccount.institution_name || 'KCA University';
        const staffId = Number(savedAccount.staff_id || 1);

        localStorage.setItem('loginData', JSON.stringify({
            type: 'staff',
            staff_id: staffId,
            full_name: fullName,
            email,
            role: 'Admin',
            institution
        }));
        window.location.href = 'dashboard.html';
    } catch (error) {
        message.className = 'error';
        message.textContent = error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});
