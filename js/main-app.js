// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL (VERSIÓN COMPLETA)
// =====================================================

// ⚠️ REEMPLAZA CON TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global de la aplicación
let currentUser = null;
let currentProfile = null;
let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
};

// =====================================================
// UTILIDADES DE SEGURIDAD Y FORMATO
// =====================================================

/**
 * Escapa HTML para prevenir XSS attacks
 * @param {string} str - Texto a escapar
 * @returns {string} Texto seguro
 */
const esc = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Crea un elemento DOM de forma segura (alternativa a innerHTML)
 * @param {string} tag - Etiqueta HTML
 * @param {string} text - Contenido de texto
 * @param {Array} classes - Clases CSS
 * @returns {HTMLElement} Elemento seguro
 */
const createSafeElement = (tag, text, classes = []) => {
    const el = document.createElement(tag);
    el.textContent = text || '';
    classes.forEach(c => el.classList.add(c));
    return el;
};

// =====================================================
// SISTEMA DE NOTIFICACIONES (TOAST)
// =====================================================

/**
 * Muestra notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duración en ms (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icono según tipo
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${esc(message)}</span>`;
    
    container.appendChild(toast);
    
    // Animación de entrada
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    // Auto-remover
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// =====================================================
// NAVEGACIÓN ENTRE PÁGINAS
// =====================================================

/**
 * Muestra una página específica y oculta las demás
 * @param {string} pageId - ID de la página a mostrar
 */
function showPage(pageId) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
        page.classList.remove('active');
    });
    
    // Mostrar página solicitada
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('active');
    }
    
    // Actualizar navegación inferior
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        const btnPage = btn.dataset.page;
        if (btnPage && pageId.includes(btnPage)) {
            btn.classList.add('active');
        }
    });
    
    // Scroll al top
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;
    
    // Actualizar título
    updatePageTitle(pageId);
}

/**
 * Actualiza el título de la página según la sección
 * @param {string} pageId 
 */
function updatePageTitle(pageId) {
    const titles = {
        'dashboard-page': 'Dashboard',
        'reservations-page': 'Reservas',
        'new-reservation-page': 'Nueva Reserva',
        'new-reservation-step2': 'Nueva Reserva',
        'new-reservation-step3': 'Nueva Reserva',
        'reservation-detail-page': 'Detalle de Reserva',
        'operations-page': 'Tareas',
        'finances-page': 'Caja'
    };
    
    const titleElement = document.getElementById('page-title');
    if (titleElement && titles[pageId]) {
        titleElement.textContent = titles[pageId];
    }
}

// Funciones de navegación específicas
function showDashboard() {
    showPage('dashboard-page');
    loadDashboard();
}

function showReservations() {
    showPage('reservations-page');
    loadReservationsByDate();
}

function showNewReservation() {
    resetReservationForm();
    showPage('new-reservation-page');
    initStep1();
}

function showOperations() {
    showPage('operations-page');
    loadTasks();
}

function showFinances() {
    // Verificación de permisos
    if (currentProfile?.role !== 'admin') {
        showToast('No tienes permiso para ver finanzas. Contacta al administrador.', 'error');
        return;
    }
    showPage('finances-page');
    loadFinances();
}

function goBack() {
    showReservations();
}

function goToStep(stepNumber) {
    const stepMap = {
        1: 'new-reservation-page',
        2: 'new-reservation-step2',
        3: 'new-reservation-step3'
    };
    
    if (stepMap[stepNumber]) {
        showPage(stepMap[stepNumber]);
    }
}

// =====================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Configurar fechas por defecto (hoy)
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['check-in-date', 'check-out-date', 'reservations-date', 'finance-date'];
    
    dateInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = today;
    });
    
    // Fecha mínima para check-in (hoy)
    const checkInInput = document.getElementById('check-in-date');
    if (checkInInput) checkInInput.min = today;
    
    // Verificar sesión existente
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            await loadUserProfile(session.user);
            showApp();
        } else {
            showLogin();
        }
    } catch (err) {
        console.error('Error al verificar sesión:', err);
        showLogin();
    }
});

// =====================================================
// GESTIÓN DE USUARIO Y AUTENTICACIÓN
// =====================================================

function showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appScreen) appScreen.classList.add('hidden');
}

async function showApp() {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    
    // Configurar UI según rol
    configureUIForRole();
    
    // Mostrar dashboard inicial
    showDashboard();
}

/**
 * Configura la interfaz según el rol del usuario
 */
function configureUIForRole() {
    if (!currentProfile) return;
    
    const isAdmin = currentProfile.role === 'admin';
    
    // Mostrar/ocultar elementos de admin
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', !isAdmin);
    });
    
    // Actualizar badge de rol
    const roleBadge = document.getElementById('user-role');
    if (roleBadge) {
        roleBadge.textContent = isAdmin ? 'Admin' : 'Voluntario';
        roleBadge.className = `badge badge-${currentProfile.role}`;
    }
}

/**
 * Carga el perfil del usuario desde la base de datos
 * @param {Object} user - Usuario de Supabase Auth
 */
async function loadUserProfile(user) {
    if (!user) return;
    
    currentUser = user;
    
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            // Perfil no existe, crear uno nuevo
            if (error.code === 'PGRST116') {
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                        role: 'volunteer', // Rol por defecto
                        created_at: new Date().toISOString()
                    }])
                    .select()
                    .single();
                
                if (createError) throw createError;
                currentProfile = newProfile;
                
                showToast('Perfil creado exitosamente', 'success');
            } else {
                throw error;
            }
        } else {
            currentProfile = profile;
        }
    } catch (err) {
        console.error('Error al cargar perfil:', err);
        showToast('Error al cargar perfil de usuario', 'error');
    }
}

/**
 * Cierra la sesión del usuario
 */
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        currentProfile = null;
        
        showLogin();
        showToast('Sesión cerrada', 'info');
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        showToast('Error al cerrar sesión', 'error');
    }
}

// =====================================================
// MODALES Y UTILIDADES UI
// =====================================================

/**
 * Muestra un modal
 * @param {string} modalId - ID del modal a mostrar
 */
function showModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);
    
    if (overlay) overlay.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
}

/**
 * Cierra todos los modales
 */
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    
    if (overlay) overlay.classList.add('hidden');
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
    
    // Restaurar scroll
    document.body.style.overflow = '';
}

// Cerrar modal al hacer clic en el overlay
document.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
        closeModal();
    }
});

// =====================================================
// FORMATEO DE DATOS
// =====================================================

/**
 * Formatea una fecha para mostrar
 * @param {string} dateStr - Fecha en formato ISO
 * @returns {string} Fecha formateada en español
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    const options = { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    };
    
    return date.toLocaleDateString('es-PA', options);
}

/**
 * Formatea un monto como moneda
 * @param {number|string} amount - Monto a formatear
 * @returns {string} Monto formateado como USD
 */
function formatCurrency(amount) {
    const num = parseFloat(amount || 0);
    return '$' + num.toFixed(2);
}

/**
 * Formatea fecha y hora
 * @param {string} isoString - Fecha ISO
 * @returns {string} Fecha y hora formateadas
 */
function formatDateTime(isoString) {
    if (!isoString) return '-';
    
    const date = new Date(isoString);
    return date.toLocaleString('es-PA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Calcula diferencia en días entre dos fechas
 * @param {string} date1 - Fecha inicial
 * @param {string} date2 - Fecha final
 * @returns {number} Número de días
 */
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// =====================================================
// RESET DE FORMULARIOS
// =====================================================

/**
 * Reinicia el formulario de reserva
 */
function resetReservationForm() {
    reservationData = {
        roomId: null,
        bedId: null,
        checkIn: null,
        checkOut: null,
        guestId: null
    };
    
    // Resetear formularios
    const forms = ['step1-form', 'step2-form', 'step3-form'];
    forms.forEach(id => {
        const form = document.getElementById(id);
        if (form) form.reset();
    });
    
    // Resetear UI
    document.getElementById('step1-continue')?.setAttribute('disabled', 'true');
    document.getElementById('total-amount') && (document.getElementById('total-amount').value = '0');
    document.getElementById('initial-payment') && (document.getElementById('initial-payment').value = '0');
    document.getElementById('balance-due') && (document.getElementById('balance-due').textContent = '$0.00');
    
    // Ocultar opciones
    document.getElementById('dormitory-options')?.classList.add('hidden');
    document.getElementById('private-options')?.classList.add('hidden');
    document.getElementById('receipt-upload-group')?.classList.add('hidden');
    
    // Limpiar previews
    const preview = document.getElementById('receipt-preview');
    if (preview) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
    }
}

// =====================================================
// INICIALIZACIÓN DE PASOS DE RESERVA
// =====================================================

/**
 * Inicializa el paso 1 de creación de reserva
 */
function initStep1() {
    // Limpiar selecciones previas
    document.querySelectorAll('.room-option').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.bed-option').forEach(el => el.classList.remove('selected'));
    
    // Cargar disponibilidad si hay fechas
    updateAvailability();
}

/**
 * Actualiza la disponibilidad según fechas seleccionadas
 */
async function updateAvailability() {
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    
    if (!checkIn || !checkOut) return;
    
    // Validar que check-out sea después de check-in
    if (new Date(checkOut) <= new Date(checkIn)) {
        showToast('La fecha de salida debe ser después de la entrada', 'warning');
        return;
    }
    
    reservationData.checkIn = checkIn;
    reservationData.checkOut = checkOut;
    
    // Recargar opciones si ya están visibles
    const dormOptions = document.getElementById('dormitory-options');
    const privOptions = document.getElementById('private-options');
    
    if (!dormOptions?.classList.contains('hidden')) {
        showDormitoryOptions();
    }
    if (!privOptions?.classList.contains('hidden')) {
        showPrivateOptions();
    }
}

// =====================================================
// MANEJO DE ERRORES GLOBAL
// =====================================================

window.onerror = function(msg, url, line, col, error) {
    console.error('Error global:', { msg, url, line, col, error });
    showToast('Ha ocurrido un error. Por favor recarga la página.', 'error');
    return false;
};

// Manejar promesas no capturadas
window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada:', event.reason);
    showToast('Error en operación asíncrona', 'error');
});
