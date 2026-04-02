// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL
// =====================================================

// Estado global
let currentUser = null;
let currentProfile = null;
let currentReservation = null;
let db = null; // Cliente de Supabase

// Inicializar Supabase (asegúrate de que esto se ejecute antes que todo)
function initSupabase() {
    // Verifica que supabase esté disponible globalmente
    if (typeof supabase !== 'undefined') {
        db = supabase.createClient(
            'https://tu-url-de-supabase.supabase.co', // Reemplaza con tu URL
            'tu-anon-key' // Reemplaza con tu anon key
        );
        console.log('Supabase inicializado correctamente');
    } else {
        console.error('Error: Supabase no está cargado. Asegúrate de incluir el script de Supabase antes de app.js');
    }
}

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
    if (!container) {
        console.error('Toast container no encontrado');
        alert(message); // Fallback si no existe el contenedor
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

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('hidden');
    } else {
        console.error(`Página ${pageId} no encontrada`);
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageId.replace('-page', '')) btn.classList.add('active');
    });
    
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;
}

function showDashboard() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Dashboard';
    showPage('dashboard-page');
    loadDashboard();
}

function showReservations() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Reservas';
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
    console.log('Inicializando paso 1...');
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
    
    console.log('Paso 1 inicializado correctamente');
}

// Inicializar paso 2 (información de fechas y habitación)
function initStep2() {
    console.log('Inicializando paso 2...');
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
    
    console.log('Paso 2 inicializado correctamente', reservationData);
    return true;
}

// Inicializar paso 3 (confirmación y pago)
function initStep3() {
    console.log('Inicializando paso 3...');
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
    
    console.log('Paso 3 inicializado correctamente', reservationData);
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
    console.log('Actualizando disponibilidad...');
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    
    console.log('Fechas seleccionadas:', { checkIn, checkOut });
    
    if (!checkIn || !checkOut) return;
    
    // Validar que check-out sea posterior a check-in
    if (new Date(checkOut) <= new Date(checkIn)) {
        showToast('La fecha de salida debe ser posterior a la de entrada', 'error');
        return;
    }
    
    // Recargar habitaciones disponibles para las nuevas fechas
    loadAvailableRooms();
}

// Cargar habitaciones disponibles - VERSIÓN CORREGIDA Y ROBUSTA
async function loadAvailableRooms() {
    console.log('Cargando habitaciones disponibles...');
    
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    const roomSelect = document.getElementById('room-select');
    
    // Verificar que el elemento select existe
    if (!roomSelect) {
        console.error('Error: Elemento room-select no encontrado en el DOM');
        showToast('Error: No se encontró el selector de habitaciones', 'error');
        return;
    }
    
    if (!checkIn || !checkOut) {
        console.log('Fechas no seleccionadas, omitiendo carga de habitaciones');
        return;
    }
    
    // Verificar que Supabase esté inicializado
    if (!db) {
        console.error('Error: Cliente de Supabase no inicializado');
        showToast('Error de conexión con la base de datos', 'error');
        return;
    }
    
    try {
        console.log('Consultando habitaciones a Supabase...');
        
        // Consulta a Supabase - ajusta el nombre de la tabla según tu esquema
        const { data: rooms, error } = await db
            .from('rooms')
            .select('*')
            .eq('status', 'available')
            .order('name', { ascending: true });
        
        if (error) {
            console.error('Error de Supabase:', error);
            throw error;
        }
        
        console.log('Habitaciones recibidas:', rooms);
        
        // Limpiar opciones actuales manteniendo la opción por defecto
        roomSelect.innerHTML = '<option value="">Seleccionar habitación</option>';
        
        // Si no hay habitaciones, mostrar mensaje
        if (!rooms || rooms.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No hay habitaciones disponibles";
            option.disabled = true;
            roomSelect.appendChild(option);
            console.warn('No se encontraron habitaciones disponibles');
            return;
        }
        
        // Agregar habitaciones disponibles al dropdown [^16^][^19^]
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            
            // Formato del texto según los campos disponibles
            const roomName = room.name || room.room_name || `Habitación ${room.number || room.id}`;
            const roomType = room.type || room.room_type || 'Standard';
            const roomPrice = room.price || room.price_per_night || 0;
            
            option.textContent = `${roomName} - ${roomType} ($${roomPrice}/noche)`;
            
            // Agregar atributos de datos útiles
            option.dataset.price = roomPrice;
            option.dataset.type = roomType;
            option.dataset.capacity = room.capacity || room.max_guests || 2;
            
            roomSelect.appendChild(option);
        });
        
        console.log(`Habitaciones cargadas exitosamente: ${rooms.length}`);
        showToast(`${rooms.length} habitaciones disponibles`, 'success');
        
    } catch (error) {
        console.error('Error cargando habitaciones:', error);
        showToast('Error al cargar habitaciones: ' + error.message, 'error');
        
        // Opción de fallback en caso de error
        roomSelect.innerHTML = '<option value="">Error al cargar habitaciones</option>';
    }
}

// Mostrar resumen de la reserva antes de confirmar
function showReservationSummary() {
    const summaryDiv = document.getElementById('reservation-summary');
    if (!summaryDiv) {
        console.error('Elemento reservation-summary no encontrado');
        return;
    }
    
    const checkInDate = new Date(reservationData.checkIn);
    const checkOutDate = new Date(reservationData.checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // Obtener nombre de la habitación seleccionada
    const roomSelect = document.getElementById('room-select');
    const roomName = roomSelect?.options[roomSelect.selectedIndex]?.text || 'No seleccionada';
    
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
            <strong>${esc(roomName)}</strong>
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
        
        // Verificar conexión con Supabase
        if (!db) {
            throw new Error('No hay conexión con la base de datos');
        }
        
        // Insertar en Supabase [^15^]
        const { data, error } = await db
            .from('reservations')
            .insert([newReservation])
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('Reserva creada:', data);
        showToast('Reserva creada exitosamente', 'success');
        
        // Redirigir a la lista de reservas
        setTimeout(() => {
            showReservations();
        }, 1500);
        
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
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Nueva Reserva';
    resetReservationForm();
    showPage('new-reservation-page');
    initStep1();
}

// =====================================================
// RESTO DE FUNCIONES
// =====================================================

function showOperations() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Tareas';
    showPage('operations-page');
    loadTasks();
}

function showFinances() {
    if (currentProfile?.role !== 'admin') {
        showToast('No tienes permiso para ver finanzas', 'error');
        return;
    }
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Caja';
    showPage('finances-page');
    loadFinances();
}

function goBack() {
    showReservations();
}

// Inicialización principal cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM cargado, inicializando aplicación...');
    
    // Inicializar Supabase primero
    initSupabase();
    
    // Verificar sesión
    try {
        if (db && db.auth) {
            const { data: { session } } = await db.auth.getSession();
            if (session) {
                await loadUserProfile(session.user);
                showApp();
            } else {
                showLogin();
            }
        } else {
            console.error('Supabase no disponible, mostrando login de fallback');
            showLogin();
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        showLogin();
    }
    
    // Configurar fechas por defecto
    const today = new Date().toISOString().split('T')[0];
    const checkInDate = document.getElementById('check-in-date');
    const checkOutDate = document.getElementById('check-out-date');
    const reservationsDate = document.getElementById('reservations-date');
    const financeDate = document.getElementById('finance-date');
    
    if (checkInDate) checkInDate.value = today;
    if (checkOutDate) checkOutDate.value = today;
    if (reservationsDate) reservationsDate.value = today;
    if (financeDate) financeDate.value = today;
});

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
    
    if (currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    
    const roleBadge = document.getElementById('user-role');
    if (roleBadge) {
        roleBadge.textContent = currentProfile?.role === 'admin' ? 'Admin' : 'Voluntario';
        roleBadge.className = `badge badge-${currentProfile?.role}`;
    }
    
    showDashboard();
}

async function loadUserProfile(user) {
    currentUser = user;
    
    if (!db) {
        console.error('No se puede cargar perfil: Supabase no inicializado');
        return;
    }
    
    try {
        const { data: profile, error } = await db
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error('Error loading profile:', error);
            // Crear perfil si no existe
            const { data: newProfile, error: insertError } = await db
                .from('profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email,
                    role: 'volunteer'
                }])
                .select()
                .single();
            
            if (insertError) {
                console.error('Error creating profile:', insertError);
                return;
            }
            
            currentProfile = newProfile;
        } else {
            currentProfile = profile;
        }
    } catch (error) {
        console.error('Error en loadUserProfile:', error);
    }
}

async function logout() {
    if (db && db.auth) {
        await db.auth.signOut();
    }
    currentUser = null;
    currentProfile = null;
    showLogin();
}

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

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatCurrency(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2);
}

function formatDateTime(isoString) {
    if (!isoString) return '';
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
