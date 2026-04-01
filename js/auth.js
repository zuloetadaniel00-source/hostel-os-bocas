document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    errDiv.classList.remove('show'); errDiv.textContent = '';
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if(error) throw error;
        await loadUserProfile(data.user);
        showApp();
        showToast('¡Bienvenido!', 'success');
    } catch(err) {
        errDiv.textContent = 'Email o contraseña incorrectos';
        errDiv.classList.add('show');
    }
});

supabase.auth.onAuthStateChange(async (event, session) => {
    if(event==='SIGNED_IN') await loadUserProfile(session.user);
    else if(event==='SIGNED_OUT') showLogin();
});
