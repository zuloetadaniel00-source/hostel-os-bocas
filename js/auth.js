// =====================================================
// AUTENTICACIÓN
// =====================================================
document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('login-form');

    if (!loginForm) {
        console.error('❌ login-form no encontrado en el DOM');
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        const btn = loginForm.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Ingresando...';
        }

        try {
            if (!window.supabaseClient) {
                throw new Error('Base de datos no inicializada');
            }

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            console.log('✅ Login OK:', data.user.email);

            await loadUserProfile(data.user);
            showApp();
            showToast('¡Bienvenido!', 'success');

        } catch (error) {
            errorDiv.textContent = 'Email o contraseña incorrectos';
            errorDiv.classList.add('show');
            console.error('❌ Login error:', error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Ingresar';
            }
        }
    });

});
