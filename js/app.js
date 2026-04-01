// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL
// =====================================================

const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global
let currentUser = null;
let currentProfile = null;
let currentReservation = null;

// Utilidades de seguridad (XSS protection)
const esc = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Toast notifications
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

// Navegación entre páginas
function showPage(pageId) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    // Mostrar página solicitada
    document.getElementById(pageId).classList.remove('hidden');
    
    // Actualizar navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageId.replace('-page', '')) {
            btn.classList.add('active');
        }
    });
    
    // Scroll to top
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
    initStep1();
}

function showOperations() {
    document.getElementById('page-title').textContent = 'Tareas';
    showPage('operations-page');
    loadTasks();
}

function showFinances() {
    if (currentProfile?.role !== 'admin') {
        showToast('No tienes permiso para ver finanzas', 'error');
        return;
    }
    document.getElementById('page-title').textContent = 'Caja';
    showPage('finances-page');
    loadFinances();
}

function goBack() {
    showReservations();
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        await loadUserProfile(session.user);
        showApp();
    } else {
        showLogin();
    }
    
    // Configurar fecha por defecto en inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('check-in-date').value = today;
    document.getElementById('check-out-date').value = today;
    document.getElementById('reservations-date').value = today;
    document.getElementById('finance-date').value = today;
});

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    
    // Mostrar/ocultar elementos según rol
    if (currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    
    // Mostrar badge de rol
    const roleBadge = document.getElementById('user-role');
    roleBadge.textContent = currentProfile?.role === 'admin' ? 'Admin' : 'Voluntario';
    roleBadge.className = `badge badge-${currentProfile?.role}`;
    
    showDashboard();
}

async function loadUserProfile(user) {
    currentUser = user;
    
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (error) {
        console.error('Error loading profile:', error);
        // Crear perfil si no existe
        const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email,
                role: 'volunteer' // Default
            }])
            .select()
            .single();
        currentProfile = newProfile;
    } else {
        currentProfile = profile;
    }
}

// Logout
async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showLogin();
}

// Modal functions
function showModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// Format helpers
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PA', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
}

function formatCurrency(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2);
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('es-PA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
