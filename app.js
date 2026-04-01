// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL
// =====================================================

// REEMPLAZA con tus credenciales de Supabase
const SUPABASE_URL = 'https://tusnumerosyletras.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let reservationData = { roomId: null, bedId: null, checkIn: null, checkOut: null, guestId: null };

const esc = (str) => str == null ? '' : String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

function showToast(msg, type='info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span style="margin-right:8px;">${type==='success'?'✓':type==='error'?'✕':type==='warning'?'⚠':'ℹ'}</span>${esc(msg)}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity='0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(pageId);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btnPage = pageId.replace('-page','').replace('new-reservation-','');
    const activeBtn = document.querySelector(`[data-page="${btnPage}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
}

function showDashboard() { showPage('dashboard-page'); loadDashboard(); }
function showReservations() { showPage('reservations-page'); loadReservationsByDate(); }
function showNewReservation() { resetReservationForm(); showPage('new-reservation-page'); initStep1(); }
function showOperations() { showPage('operations-page'); loadTasks(); }
function showFinances() { 
    if (currentProfile?.role !== 'admin') { showToast('Sin permiso','error'); return; }
    showPage('finances-page'); loadFinances(); 
}
function goBack() { showReservations(); }
function goToStep(n) {
    const map = {1:'new-reservation-page',2:'new-reservation-step2',3:'new-reservation-step3'};
    if (map[n]) showPage(map[n]);
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('es-PA',{weekday:'short',day:'numeric',month:'short'}) : '-'; }
function formatCurrency(a) { return '$' + parseFloat(a||0).toFixed(2); }
function formatDateTime(iso) { return iso ? new Date(iso).toLocaleString('es-PA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'; }

document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    ['check-in-date','check-out-date','reservations-date','finance-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });
    const checkIn = document.getElementById('check-in-date');
    if (checkIn) checkIn.min = today;
    
    try {
        const { data:{session} } = await supabase.auth.getSession();
        if (session) { await loadUserProfile(session.user); showApp(); }
        else { showLogin(); }
    } catch(err) { console.error(err); showLogin(); }
});

function showLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-screen')?.classList.add('hidden');
}

async function showApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-screen')?.classList.remove('hidden');
    if (currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('
