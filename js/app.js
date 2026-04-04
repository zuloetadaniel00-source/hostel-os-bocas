App · JS
Copiar

// =====================================================
// APP PRINCIPAL - OPTIMIZADO
// =====================================================
 
let currentUser = null;
let currentProfile = null;
 
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
    if (!container) return;
    
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
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('hidden');
        document.getElementById('main-content').scrollTop = 0;
    }
    
    const pageName = pageId.replace('-page', '');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageName) btn.classList.add('active');
    });
}
 
function showDashboard() {
    document.getElementById('page-title').textContent = 'Dashboard';
    showPage('dashboard-page');
    setTimeout(() => loadDashboard(), 0);
}
 
function showReservations() {
    document.getElementById('page-title').textContent = 'Reservas';
    showPage('reservations-page');
    setTimeout(() => loadReservationsByDate(), 0);
}
 
function showNewReservation() {
    document.getElementById('page-title').textContent = 'Nueva Reserva';
    resetReservationForm();
    showPage('new-reservation-page');
}
 
function showOperations() {
    document.getElementById('page-title').textContent = 'Tareas';
    showPage('operations-page');
    setTimeout(() => loadTasks(), 0);
}
 
function showCashRegister() {
    document.getElementById('page-title').textContent = 'Caja';
    showPage('cash-page');
    setTimeout(() => loadCashBalance(), 0);
}
 
function showFinances() {
    if (currentProfile?.role !== 'admin') {
        showToast('No tienes permiso', 'error');
        return;
    }
    document.getElementById('page-title').textContent = 'Finanzas';
 
    // CORRECCIÓN: actualizar rango de fechas CADA VEZ que se abre finanzas
    // Desde el primer día del mes actual hasta hoy (no mes siguiente)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = now.toISOString().split('T')[0];
    const firstDayStr = firstDay.toISOString().split('T')[0];
 
    const dateFromEl = document.getElementById('finance-date-from');
    const dateToEl   = document.getElementById('finance-date-to');
    if (dateFromEl) dateFromEl.value = firstDayStr;
    if (dateToEl)   dateToEl.value   = today;
 
    showPage('finances-page');
    setTimeout(() => loadFinances(), 0);
}
 
function goBack() {
    showReservations();
}
 
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
 
    // Primer día del mes actual
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayStr = firstDay.toISOString().split('T')[0];
 
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
 
    setValue('check-in-date',      todayStr);
    setValue('check-out-date',     todayStr);
    setValue('reservations-date',  todayStr);
 
    // CORRECCIÓN: desde primer día del mes hasta HOY (no mes siguiente)
    setValue('finance-date-from',  firstDayStr);
    setValue('finance-date-to',    todayStr);
});
 
function showLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-screen')?.classList.add('hidden');
}
 
function showApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-screen')?.classList.remove('hidden');
}
 
function showModal(modalId) {
    document.getElementById('modal-overlay')?.classList.remove('hidden');
    document.getElementById(modalId)?.classList.remove('hidden');
}
 
function closeModal() {
    document.getElementById('modal-overlay')?.classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}
 
function closeEditModal() {
    document.getElementById('edit-reservation-modal')?.classList.add('hidden');
    document.getElementById('modal-overlay')?.classList.add('hidden');
}
 
function formatDate(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric', month: 'short' });
}
 
function formatCurrency(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2);
}
 
function formatDateTime(isoString) {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
 
window.showDashboard    = showDashboard;
window.showReservations = showReservations;
window.showNewReservation = showNewReservation;
window.showOperations   = showOperations;
window.showCashRegister = showCashRegister;
window.showFinances     = showFinances;
window.goBack           = goBack;
window.showModal        = showModal;
window.closeModal       = closeModal;
window.closeEditModal   = closeEditModal;
window.showToast        = showToast;
window.esc              = esc;
window.formatDate       = formatDate;
window.formatCurrency   = formatCurrency;
window.formatDateTime   = formatDateTime;
