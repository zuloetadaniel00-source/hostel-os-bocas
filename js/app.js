// REEMPLAZA con tus credenciales de Supabase
const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentProfile = null;

// XSS Protection
const esc = (str) => str == null ? '' : String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

// Toast
function showToast(msg, type='info') {
    const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// Navigation
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (document.querySelector(`[data-page="${id.replace('-page','')}"]`)) {
        document.querySelector(`[data-page="${id.replace('-page','')}"]`).classList.add('active');
    }
}
function showDashboard() { document.getElementById('page-title').textContent='Dashboard'; showPage('dashboard-page'); loadDashboard(); }
function showReservations() { document.getElementById('page-title').textContent='Reservas'; showPage('reservations-page'); loadReservationsByDate(); }
function showNewReservation() { document.getElementById('page-title').textContent='Nueva Reserva'; resetReservationForm(); showPage('new-reservation-page'); initStep1(); }
function showOperations() { document.getElementById('page-title').textContent='Tareas'; showPage('operations-page'); loadTasks(); }
function showFinances() { if(currentProfile?.role!=='admin'){showToast('Sin permiso','error');return;} document.getElementById('page-title').textContent='Caja'; showPage('finances-page'); loadFinances(); }
function goBack() { showReservations(); }
function goToStep(n) { document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); if(n===1)showPage('new-reservation-page'); else if(n===2)showPage('new-reservation-step2'); }

// Format helpers
function formatDate(d) { return new Date(d).toLocaleDateString('es-PA',{weekday:'short',day:'numeric',month:'short'}); }
function formatCurrency(a) { return '$'+parseFloat(a||0).toFixed(2); }

// Init
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    ['check-in-date','check-out-date','reservations-date','finance-date'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = today;
    });
    
    const { data:{session} } = await supabase.auth.getSession();
    if(session){ await loadUserProfile(session.user); showApp(); } else { showLogin(); }
});

function showLogin() { document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('app-screen').classList.add('hidden'); }
function showApp() {
    document.getElementById('login-screen').classList.add('hidden'); 
    document.getElementById('app-screen').classList.remove('hidden');
    if(currentProfile?.role==='admin') document.querySelectorAll('.admin-only').forEach(e=>e.classList.remove('hidden'));
    const b = document.getElementById('user-role'); b.textContent = currentProfile?.role==='admin'?'Admin':'Voluntario'; b.className = `badge badge-${currentProfile?.role}`;
    showDashboard();
}

async function loadUserProfile(user) {
    currentUser = user;
    const { data:p, error } = await supabase.from('profiles').select('*').eq('id',user.id).single();
    if(error){
        const { data:np } = await supabase.from('profiles').insert([{id:user.id,email:user.email,full_name:user.email,role:'volunteer'}]).select().single();
        currentProfile = np;
    } else { currentProfile = p; }
}

async function logout() { await supabase.auth.signOut(); currentUser=null; currentProfile=null; showLogin(); }

function showModal(id) { document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById(id).classList.remove('hidden'); }
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden')); }
