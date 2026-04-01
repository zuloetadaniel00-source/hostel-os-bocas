// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL (FIXED)
// =====================================================

// CONFIG SUPABASE
const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// ✅ Esperar a que cargue Supabase correctamente
document.addEventListener('DOMContentLoaded', async () => {

    if (!window.supabase) {
        console.error('Supabase no cargó');
        return;
    }

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser = null;
    let currentProfile = null;

    // =============================
    // LOGIN / SESSION CHECK
    // =============================

    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
            currentUser = session.user;
            showApp();
        } else {
            showLogin();
        }

    } catch (err) {
        console.error(err);
        showLogin();
    }

    // =============================
    // UI FUNCTIONS
    // =============================

    function showLogin() {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('app-screen')?.classList.add('hidden');
    }

    function showApp() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app-screen')?.classList.remove('hidden');

        hideLoading();
    }

    function hideLoading() {
        const loader = document.getElementById('loading');
        if (loader) loader.style.display = 'none';
    }

    // =============================
    // LOGIN FORM
    // =============================

    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                currentUser = data.user;
                showApp();

            } catch (err) {
                document.getElementById('login-error').textContent = err.message;
            }
        });
    }

    // =============================
    // LOGOUT GLOBAL
    // =============================

    window.logout = async function () {
        await supabase.auth.signOut();
        location.reload();
    };

});
