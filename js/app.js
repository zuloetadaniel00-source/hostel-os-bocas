// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL
// =====================================================

let currentUser = null;
let currentProfile = null;
let currentReservation = null;

const esc = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageId.replace('-page', '')) btn.classList.add('active');
    });
    document.getElementById('main-content').scrollTop = 0;
}

function showDashboard() {
    document.getElementById('page-title').textContent = 'Dashboard';
    showPage('dashboard-page');
    loadDashboard();
}

function showReservations() {
    document.getElementById('page-title').textContent = 'Reservas';
    showPage('reservations-page');
    loadReservationsByDate();
}

function showNewReservation() {
    document.getElementById('page-title').textContent = 'Nueva Reserva';
    resetReservationForm();
    showPage('new-reservation-page');
}

function showOperations() {
    document.getElementById('page-title').textContent = 'Tareas';
    showPage('operations-page');
    loadTasks();
}

function showFinances() {
    document.getElementById('page-title').textContent = 'Caja';
    showPage('finances-page');
    loadFinances();
}

function goBack() {
    showReservations();
}

document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('check-in-date').value = today;
    document.getElementById('check-out-date').value = today;
    document.getElementById('reservations-date').value = today;

    const { data: { session } } = await db.auth.getSession();
    if (session) {
        await loadUserProfile(session.user);
        showApp();
    } else {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    const isAdmin = currentProfile?.role === 'admin';
    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    const roleBadge = document.getElementById('user-role');
    roleBadge.textContent = isAdmin ? 'Admin' : 'Voluntario';
    roleBadge.className = `badge badge-${currentProfile?.role}`;

    showDashboard();
}

async function loadUserProfile(user) {
    currentUser = user;
    const { data: profile, error } = await db
        .from('profiles')
        .upsert([{
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email,
            role: 'volunteer'
        }], { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .single();

    if (!error) {
        currentProfile = profile;
    } else {
        const { data: existing } = await db.from('profiles').select('*').eq('id', user.id).single();
        currentProfile = existing;
    }
}

async function logout() {
    await db.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showLogin();
}

function showModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatCurrency(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2);
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
