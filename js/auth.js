// =====================================================
// AUTENTICACIÓN
// =====================================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';
    
    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;

        console.log("Login OK:", data);

        await loadUserProfile(data.user);
        showApp();
        showToast('¡Bienvenido!', 'success');
        
    } catch (error) {
        errorDiv.textContent = 'Email o contraseña incorrectos';
        errorDiv.classList.add('show');
        console.error('Login error:', error);
    }
});
