// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL
// =====================================================

// Estado global
let currentUser = null;
let currentProfile = null;
let supabase = null; // Cliente de Supabase - UNIFICADO con reservations.js

// =====================================================
// INICIALIZACIÓN DE SUPABASE
// =====================================================

function initSupabase() {
    // Verifica que la librería supabase esté disponible globalmente
    if (typeof window.supabase !== 'undefined') {
        // Usar las credenciales de tu proyecto
        const SUPABASE_URL = 'https://tu-url-de-supabase.supabase.co'; // ← REEMPLAZA ESTO
        const SUPABASE_ANON_KEY = 'tu-anon-key'; // ← REEMPLAZA ESTO
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Hacer disponible globalmente para otros scripts
        window.supabaseClient = supabase;
        
        console.log('✅ Supabase inicializado correctamente');
        return true;
    } else {
        console.error('❌ Error: Librería Supabase no cargada');
        showToast('Error: No se pudo conectar con la base de datos', 'error');
        return false;
    }
}

// =====================================================
// UTILIDADES GLOBALES
// =====================================================

// Escape HTML para prevenir XSS
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Formatear fecha
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PA', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
    });
}

// Formatear fecha y hora
function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString('es-PA', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Formatear moneda
function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toFixed(2);
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container no encontrado');
        alert(message);
        return;
    }
    
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

// =====================================================
// NAVEGACIÓN
// =====================================================

function showPage(pageId) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    
    // Mostrar página solicitada
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('hidden');
    } else {
        console.error(`❌ Página ${pageId} no encontrada`);
    }
    
    // Actualizar navegación activa
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        const btnPage = btn.dataset.page || btn.getAttribute('onclick')?.match(/show(\w+)\(\)/)?.[1].toLowerCase();
        if (btnPage && pageId.includes(btnPage)) {
            btn.classList.add('active');
        }
    });
    
    // Scroll al inicio
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;
}

function showDashboard() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Dashboard';
    showPage('dashboard-page');
    
    // Cargar datos si la función existe
    if (typeof loadDashboard === 'function') {
        loadDashboard();
    }
}

function showReservations() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Reservas';
    showPage('reservations-page');
    
    // Establecer fecha de hoy si está vacía
    const dateInput = document.getElementById('reservations-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Cargar reservas si la función existe
    if (typeof loadReservationsByDate === 'function') {
        loadReservationsByDate();
    }
}

function showNewReservation() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Nueva Reserva';
    
    // Resetear y mostrar wizard de reserva
    if (typeof resetReservationForm === 'function') {
        resetReservationForm();
    }
    
    showPage('new-reservation-page');
}

function showOperations() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Tareas';
    showPage('operations-page');
    
    if (typeof loadTasks === 'function') {
        loadTasks();
    }
}

function showFinances() {
    // Verificar permisos de admin
    if (currentProfile?.role !== 'admin') {
        showToast('⛔ No tienes permiso para ver finanzas', 'error');
        return;
    }
    
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Caja';
    showPage('finances-page');
    
    if (typeof loadFinances === 'function') {
        loadFinances();
    }
}

function goBack() {
    showReservations();
}

// =====================================================
// MODALES
// =====================================================

function showModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);
    
    if (overlay) overlay.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// =====================================================
// AUTENTICACIÓN
// =====================================================

function showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appScreen) appScreen.classList.add('hidden');
}

function showApp() {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    
    // Mostrar elementos de admin si aplica
    if (currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.remove('hidden');
        });
    }
    
    // Actualizar badge de rol
    const roleBadge = document.getElementById('user-role');
    if (roleBadge) {
        roleBadge.textContent = currentProfile?.role === 'admin' ? 'Admin' : 'Voluntario';
        roleBadge.className = `badge badge-${currentProfile?.role || 'volunteer'}`;
    }
    
    showDashboard();
}

async function loadUserProfile(user) {
    currentUser = user;
    
    if (!supabase) {
        console.error('❌ No se puede cargar perfil: Supabase no inicializado');
        return;
    }
    
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.log('Perfil no encontrado, creando uno nuevo...');
            
            // Crear perfil automáticamente
            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email,
                    role: 'volunteer' // Por defecto es voluntario
                }])
                .select()
                .single();
            
            if (insertError) {
                console.error('❌ Error creando perfil:', insertError);
                return;
            }
            
            currentProfile = newProfile;
            console.log('✅ Perfil creado:', newProfile);
        } else {
            currentProfile = profile;
            console.log('✅ Perfil cargado:', profile);
        }
        
    } catch (error) {
        console.error('❌ Error en loadUserProfile:', error);
    }
}

async function logout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
    currentUser = null;
    currentProfile = null;
    showLogin();
}

// =====================================================
// INICIALIZACIÓN PRINCIPAL
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM cargado, inicializando Hostel-OS...');
    
    // 1. Inicializar Supabase PRIMERO
    const supabaseReady = initSupabase();
    
    if (!supabaseReady) {
        showToast('Error crítico: No se pudo conectar con la base de datos', 'error');
        return;
    }
    
    // 2. Configurar fechas por defecto en todos los inputs de fecha
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = {
        'check-in-date': today,
        'check-out-date': today,
        'reservations-date': today,
        'finance-date': today
    };
    
    Object.entries(dateInputs).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input && !input.value) {
            input.value = value;
        }
    });
    
    // 3. Verificar sesión existente
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            console.log('✅ Sesión existente encontrada');
            await loadUserProfile(session.user);
            showApp();
        } else {
            console.log('ℹ️ No hay sesión activa');
            showLogin();
        }
        
    } catch (error) {
        console.error('❌ Error verificando sesión:', error);
        showLogin();
    }
    
    // 4. Escuchar cambios de autenticación
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event);
        
        if (event === 'SIGNED_IN') {
            await loadUserProfile(session.user);
            showApp();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentProfile = null;
            showLogin();
        }
    });
});

// =====================================================
// FUNCIONES PLACEHOLDER (se sobrescriben en otros archivos)
// =====================================================

// Estas funciones se definen aquí para evitar errores, 
// pero deben ser sobrescritas en sus respectivos archivos (dashboard.js, etc.)

if (typeof loadDashboard !== 'function') {
    window.loadDashboard = async function() {
        console.log('⚠️ loadDashboard no implementado');
    };
}

if (typeof loadReservationsByDate !== 'function') {
    window.loadReservationsByDate = async function() {
        console.log('⚠️ loadReservationsByDate no implementado');
    };
}

if (typeof loadTasks !== 'function') {
    window.loadTasks = async function() {
        console.log('⚠️ loadTasks no implementado');
    };
}

if (typeof loadFinances !== 'function') {
    window.loadFinances = async function() {
        console.log('⚠️ loadFinances no implementado');
    };
}

// Funciones del wizard de reserva (se sobrescriben en reservations.js)
if (typeof resetReservationForm !== 'function') {
    window.resetReservationForm = function() {
        console.log('⚠️ resetReservationForm no implementado');
    };
}
