// =====================================================
// AUTENTICACIÓN
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const btn = document.querySelector('#login-form button[type="submit"]');
        errorDiv.classList.remove('show');
        errorDiv.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Ingresando...';
        try {
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await loadUserProfile(data.user);
            showApp();
            showToast('¡Bienvenido!', 'success');
        } catch (error) {
            errorDiv.textContent = 'Email o contraseña incorrectos';
            errorDiv.classList.add('show');
            console.error('Login error:', error);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Ingresar';
        }
    });
 
    db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
            showLogin();
        }
    });
 
});
