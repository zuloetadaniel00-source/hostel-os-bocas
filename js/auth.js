// =====================================================
// AUTENTICACION - OPTIMIZADO
// =====================================================

let authInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    if (authInitialized) return;
    authInitialized = true;

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    checkSession();
});

async function checkSession() {
    try {
        const { data: { session }, error } = await db.auth.getSession();

        if (session?.user) {
            showApp();
            loadUserProfile(session.user).catch(console.error);
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Session check error:', error);
        showLogin();
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const btn = e.target.querySelector('button[type="submit"]');

    errorDiv.classList.remove('show');
    btn.disabled = true;
    btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
        </svg>
        Ingresando...
    `;

    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;

        showApp();
        loadUserProfile(data.user).catch(console.error);

    } catch (error) {
        errorDiv.textContent = 'Email o contraseña incorrectos';
        errorDiv.classList.add('show');
        btn.disabled = false;
        btn.innerHTML = `
            <span>Ingresar</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px;">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
    }
}

async function loadUserProfile(user) {
    currentUser = user;

    try {
        const { data: existing } = await db
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (existing) {
            currentProfile = existing;
            updateUIForRole();
            showDashboard();
            return;
        }

        const { data: profile, error: insertError } = await db
            .from('profiles')
            .insert([{
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email,
                role: 'volunteer'
            }])
            .select()
            .single();

        if (!insertError) {
            currentProfile = profile;
            updateUIForRole();
            showDashboard();
        }

    } catch (error) {
        console.error('Profile error:', error);
        currentProfile = { role: 'volunteer', full_name: user.email };
        updateUIForRole();
        showDashboard();
    }
}

function updateUIForRole() {
    const roleBadge = document.getElementById('user-role');
    if (roleBadge) {
        roleBadge.textContent = currentProfile?.role === 'admin' ? 'Admin' : 'Voluntario';
        roleBadge.className = 'badge badge-' + currentProfile?.role;
    }

    if (currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        const adminCash = document.getElementById('admin-cash-actions');
        const volCash = document.getElementById('volunteer-cash-actions');
        if (adminCash) adminCash.classList.remove('hidden');
        if (volCash) volCash.classList.add('hidden');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        const adminCash = document.getElementById('admin-cash-actions');
        const volCash = document.getElementById('volunteer-cash-actions');
        if (adminCash) adminCash.classList.add('hidden');
        if (volCash) volCash.classList.remove('hidden');
    }
}

async function logout() {
    await db.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showLogin();
}

db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        showLogin();
    }
});

window.logout = logout;
