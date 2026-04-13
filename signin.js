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

document.getElementById('signin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('signin-message');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    message.className = '';
    message.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    const payload = {
        institution_name: document.getElementById('institution_name').value.trim(),
        org_code: document.getElementById('org_code').value.trim(),
        admin_name: document.getElementById('admin_name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
    };

    try {
        if (!payload.institution_name || !payload.org_code || !payload.admin_name || !payload.email || !payload.password) {
            throw new Error('Please fill all fields.');
        }

        localStorage.setItem('devInstitutionAccount', JSON.stringify({
            ...payload,
            staff_id: 1
        }));

        message.className = 'ok';
        message.textContent = 'Institution saved locally. Redirecting to login...';
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1200);
    } catch (error) {
        message.className = 'error';
        message.textContent = error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Institution';
    }
});
