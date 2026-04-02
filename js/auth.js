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
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;

        console.log("Login OK:", data);

        // 🔥 ESTO ES LO CLAVE
        await loadUserProfile(data.user);

        // 🔥 LUEGO MUESTRAS LA APP
        showApp();

        showToast('¡Bienvenido!', 'success');
        
    } catch (error) {
        errorDiv.textContent = 'Email o contraseña incorrectos';
        errorDiv.classList.add('show');
        console.error('Login error:', error);
    }
});
