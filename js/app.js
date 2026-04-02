// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL
// =====================================================

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

// =====================================================
// NUEVA RESERVA - FUNCIONES DEL WIZARD
// =====================================================

let currentStep = 1;
let reservationData = {};

// Inicializar paso 1 del formulario de reserva
function initStep1() {
    currentStep = 1;
    reservationData = {};
    
    // Mostrar solo el paso 1, ocultar los demás
    document.querySelectorAll('.reservation-step').forEach((step, index) => {
        step.classList.toggle('hidden', index !== 0);
    });
    
    // Actualizar indicadores de paso
    updateStepIndicators();
    
    // Limpiar campos del paso 1
    const camposStep1 = ['guest-name', 'guest-email', 'guest-phone', 'guest-nationality'];
    camposStep1.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });
    
    // Cargar datos iniciales si es necesario
    console.log('Paso 1 inicializado');
}

// Inicializar paso 2 (información de fechas y habitación)
function initStep2() {
    currentStep = 2;
    
    // Guardar datos del paso 1
    reservationData.guestName = document.getElementById('guest-name')?.value?.trim();
    reservationData.guestEmail = document.getElementById('guest-email')?.value?.trim();
    reservationData.guestPhone = document.getElementById('guest-phone')?.value?.trim();
    reservationData.guestNationality = document.getElementById('guest-nationality')?.value?.trim();
    
    // Validar campos requeridos del paso 1
    if (!reservationData.guestName) {
        showToast('El nombre del huésped es requerido', 'error');
        return false;
    }
    
    // Mostrar solo el paso 2
    document.querySelectorAll('.reservation-step').forEach((step, index) => {
        step.classList.toggle('hidden', index !== 1);
    });
    
    updateStepIndicators();
    
    // Inicializar fechas por defecto
    const today = new Date().toISOString().split('T')[0];
    const checkIn = document.getElementById('check-in-date');
    const checkOut = document.getElementById('check-out-date');
    
    if (checkIn && !checkIn.value) checkIn.value = today;
    if (checkOut && !checkOut.value) checkOut.value = today;
    
    // Cargar habitaciones disponibles
    loadAvailableRooms();
    
    console.log('Paso 2 inicializado', reservationData);
    return true;
}

// Inicializar paso 3 (confirmación y pago)
function initStep3() {
    currentStep = 3;
    
    // Guardar datos del paso 2
    reservationData.checkIn = document.getElementById('check-in-date')?.value;
    reservationData.checkOut = document.getElementById('check-out-date')?.value;
    reservationData.roomId = document.getElementById('room-select')?.value;
    reservationData.guests = document.getElementById('guests-count')?.value || 1;
    
    // Validar
    if (!reservationData.checkIn || !reservationData.checkOut) {
        showToast('Las fechas son requeridas', 'error');
        return false;
    }
    
    if (!reservationData.roomId) {
        showToast('Debes seleccionar una habitación', 'error');
        return false;
    }
    
    // Mostrar solo el paso 3
    document.querySelectorAll('.reservation-step').forEach((step, index) => {
        step.classList.toggle('hidden', index !== 2);
    });
    
    updateStepIndicators();
    
    // Mostrar resumen de la reserva
    showReservationSummary();
    
    console.log('Paso 3 inicializado', reservationData);
    return true;
}

// Actualizar indicadores visuales de los pasos
function updateStepIndicators() {
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        indicator.classList.remove('active', 'completed');
        if (index + 1 === currentStep) {
            indicator.classList.add('active');
        } else if (index + 1 < currentStep) {
            indicator.classList.add('completed');
        }
    });
}

// Navegar al siguiente paso
function nextStep() {
    if (currentStep === 1) {
        if (!initStep2()) return;
    } else if (currentStep === 2) {
        if (!initStep3()) return;
    }
}

// Navegar al paso anterior
function prevStep() {
    if (currentStep === 2) {
        currentStep = 1;
        document.querySelectorAll('.reservation-step').forEach((step, index) => {
            step.classList.toggle('hidden', index !== 0);
        });
        updateStepIndicators();
    } else if (currentStep === 3) {
        currentStep = 2;
        document.querySelectorAll('.reservation-step').forEach((step, index) => {
            step.classList.toggle('hidden', index !== 1);
        });
        updateStepIndicators();
    }
}

// Actualizar disponibilidad según fecha seleccionada
function updateAvailability() {
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    
    console.log('Actualizando disponibilidad:', { checkIn, checkOut });
    
    if (!checkIn || !checkOut) return;
    
    // Validar que check-out sea posterior a check-in
    if (new Date(checkOut) <= new Date(checkIn)) {
        showToast('La fecha de salida debe ser posterior a la de entrada', 'error');
        return;
    }
    
    // Recargar habitaciones disponibles para las nuevas fechas
    loadAvailableRooms();
}

// Cargar habitaciones disponibles
async function loadAvailableRooms() {
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    const roomSelect = document.getElementById('room-select');
    
    if (!roomSelect || !checkIn || !checkOut) return;
    
    try {
        // Consultar habitaciones disponibles en Supabase
        const { data: rooms, error } = await db
            .from('rooms')
            .select('*')
            .eq('status', 'available');
        
        if (error) throw error;
        
        // Limpiar opciones actuales
        roomSelect.innerHTML = '<option value="">Seleccionar habitación</option>';
        
        // Agregar habitaciones disponibles
        rooms?.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = `${room.name} - ${room.type} ($${room.price}/noche)`;
            roomSelect.appendChild(option);
        });
        
        console.log('Habitaciones cargadas:', rooms?.length || 0);
        
    } catch (error) {
        console.error('Error cargando habitaciones:', error);
        showToast('Error al cargar habitaciones', 'error');
    }
}

// Mostrar resumen de la reserva antes de confirmar
function showReservationSummary() {
    const summaryDiv = document.getElementById('reservation-summary');
    if (!summaryDiv) return;
    
    const nights = Math.ceil(
        (new Date(reservationData.checkOut) - new Date(reservationData.checkIn)) / (1000 * 60 * 60 * 24)
    );
    
    summaryDiv.innerHTML = `
        <div class="summary-item">
            <span>Huésped:</span>
            <strong>${esc(reservationData.guestName)}</strong>
        </div>
        <div class="summary-item">
            <span>Email:</span>
            <strong>${esc(reservationData.guestEmail)}</strong>
        </div>
        <div class="summary-item">
            <span>Teléfono:</span>
            <strong>${esc(reservationData.guestPhone)}</strong>
        </div>
        <div class="summary-item">
            <span>Entrada:</span>
            <strong>${formatDate(reservationData.checkIn)}</strong>
        </div>
        <div class="summary-item">
            <span>Salida:</span>
            <strong>${formatDate(reservationData.checkOut)}</strong>
        </div>
        <div class="summary-item">
            <span>Noches:</span>
            <strong>${nights}</strong>
        </div>
        <div class="summary-item">
            <span>Habitación:</span>
            <strong>${esc(reservationData.roomId)}</strong>
        </div>
        <div class="summary-item">
            <span>Huéspedes:</span>
            <strong>${reservationData.guests}</strong>
        </div>
    `;
}

// Crear la reserva en Supabase
async function createReservation() {
    try {
        // Obtener datos de pago si existen
        const paymentMethod = document.getElementById('payment-method')?.value;
        const paymentAmount = parseFloat(document.getElementById('payment-amount')?.value || 0);
        const paymentNotes = document.getElementById('payment-notes')?.value?.trim();
        
        // Preparar objeto de reserva
        const newReservation = {
            guest_name: reservationData.guestName,
            guest_email: reservationData.guestEmail,
            guest_phone: reservationData.guestPhone,
            guest_nationality: reservationData.guestNationality,
            check_in: reservationData.checkIn,
            check_out: reservationData.checkOut,
            room_id: reservationData.roomId,
            guests_count: parseInt(reservationData.guests),
            status: 'confirmed',
            payment_method: paymentMethod,
            payment_amount: paymentAmount,
            payment_notes: paymentNotes,
            created_by: currentUser?.id,
            created_at: new Date().toISOString()
        };
        
        console.log('Creando reserva:', newReservation);
        
        // Insertar en Supabase
        const { data, error } = await db
            .from('reservations')
            .insert([newReservation])
            .select()
            .single();
        
        if (error) throw error;
        
        showToast('Reserva creada exitosamente', 'success');
        
        // Redirigir a la lista de reservas
        showReservations();
        
    } catch (error) {
        console.error('Error al crear reserva:', error);
        showToast('Error al crear reserva: ' + error.message, 'error');
    }
}

// Resetear formulario de reserva
function resetReservationForm() {
    currentStep = 1;
    reservationData = {};
    document.querySelectorAll('.reservation-step').forEach((step, index) => {
        step.classList.toggle('hidden', index !== 0);
    });
    updateStepIndicators();
    
    // Limpiar todos los campos
    const allFields = [
        'guest-name', 'guest-email', 'guest-phone', 'guest-nationality',
        'check-in-date', 'check-out-date', 'room-select', 'guests-count',
        'payment-method', 'payment-amount', 'payment-notes'
    ];
    
    allFields.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });
}

function showNewReservation() {
    document.getElementById('page-title').textContent = 'Nueva Reserva';
    resetReservationForm();
    showPage('new-reservation-page');
    initStep1();
}

// =====================================================
// RESTO DE FUNCIONES
// =====================================================

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

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        await loadUserProfile(session.user);
        showApp();
    } else {
        showLogin();
    }
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
    if (currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    const roleBadge = document.getElementById('user-role');
    roleBadge.textContent = currentProfile?.role === 'admin' ? 'Admin' : 'Voluntario';
    roleBadge.className = `badge badge-${currentProfile?.role}`;
    showDashboard();
}

async function loadUserProfile(user) {
    currentUser = user;
    const { data: profile, error } = await db.from('profiles').select('*').eq('id', user.id).single();
    if (error) {
        console.error('Error loading profile:', error);
        const { data: newProfile } = await db.from('profiles').insert([{
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email,
            role: 'volunteer'
        }]).select().single();
        currentProfile = newProfile;
    } else {
        currentProfile = profile;
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
    return date.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// =====================================================
// FUNCIONES PLACEHOLDER (para evitar errores si no existen)
// =====================================================

async function loadDashboard() {
    console.log('Cargando dashboard...');
    // Implementar según tu necesidad
}

async function loadReservationsByDate() {
    console.log('Cargando reservas por fecha...');
    // Implementar según tu necesidad
}

async function loadTasks() {
    console.log('Cargando tareas...');
    // Implementar según tu necesidad
}

async function loadFinances() {
    console.log('Cargando finanzas...');
    // Implementar según tu necesidad
}
