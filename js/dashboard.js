// =====================================================
// HOSTEL-OS BOCAS - DASHBOARD (VERSIÓN COMPLETA)
// =====================================================

/**
 * Carga todos los datos del dashboard
 */
async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    
    // Actualizar fecha mostrada
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = new Date().toLocaleDateString('es-PA', options);
    }
    
    // Cargar datos en paralelo para mejor performance
    try {
        await Promise.all([
            loadOccupancy(),
            loadTodayStats(),
            loadAlerts(),
            loadUpcomingReservations(),
            loadRecentActivity()
        ]);
    } catch (err) {
        console.error('Error cargando dashboard:', err);
        showToast('Error al cargar datos del dashboard', 'error');
    }
}

/**
 * Calcula y muestra la ocupación actual
 */
async function loadOccupancy() {
    try {
        // Obtener todas las habitaciones y camas
        const [{ data: rooms }, { data: beds }] = await Promise.all([
            supabase.from('rooms').select('*'),
            supabase.from('beds').select('*')
        ]);
        
        if (!rooms || !beds) {
            console.error('No se pudieron cargar habitaciones o camas');
            return;
        }
        
        let totalCapacity = 0;
        let occupiedCount = 0;
        
        // Procesar habitaciones privadas (ocupan toda la capacidad)
        rooms.forEach(room => {
            if (room.type === 'private') {
                totalCapacity += room.capacity_total;
                
                if (room.status === 'occupied') {
                    occupiedCount += room.capacity_total;
                }
            }
        });
        
        // Procesar camas de dormitorios (cama por cama)
        beds.forEach(bed => {
            totalCapacity++;
            if (bed.status === 'occupied') {
                occupiedCount++;
            }
        });
        
        // Calcular porcentaje
        const percentage = totalCapacity > 0 
            ? Math.round((occupiedCount / totalCapacity) * 100) 
            : 0;
        
        // Actualizar UI
        const percentElement = document.getElementById('occupancy-percent');
        const fillElement = document.getElementById('occupancy-fill');
        const occupiedElement = document.getElementById('occupied-beds');
        const totalElement = document.getElementById('total-beds');
        
        if (percentElement) percentElement.textContent = percentage + '%';
        if (fillElement) fillElement.style.width = percentage + '%';
        if (occupiedElement) occupiedElement.textContent = occupiedCount;
        if (totalElement) totalElement.textContent = totalCapacity;
        
        // Cambiar color según ocupación
        if (fillElement) {
            fillElement.style.background = percentage >= 90 
                ? 'var(--danger)' 
                : percentage >= 70 
                    ? 'var(--warning)' 
                    : 'var(--success)';
        }
        
    } catch (err) {
        console.error('Error calculando ocupación:', err);
    }
}

/**
 * Carga estadísticas del día (check-ins, check-outs, ingresos)
 */
async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Check-ins de hoy
        const { data: checkins, error: checkinsError } = await supabase
            .from('reservations')
            .select('id, status, payment_status')
            .eq('check_in_date', today)
            .is('deleted_at', null);
        
        if (checkinsError) throw checkinsError;
        
        // Check-outs de hoy
        const { data: checkouts, error: checkoutsError } = await supabase
            .from('reservations')
            .select('id')
            .eq('check_out_date', today)
            .is('deleted_at', null);
        
        if (checkoutsError) throw checkoutsError;
        
        // Actualizar contadores
        const checkinsElement = document.getElementById('today-checkins');
        const checkoutsElement = document.getElementById('today-checkouts');
        
        if (checkinsElement) checkinsElement.textContent = checkins?.length || 0;
        if (checkoutsElement) checkoutsElement.textContent = checkouts?.length || 0;
        
        // Calcular ingresos del día (solo para admin)
        if (currentProfile?.role === 'admin') {
            const { data: transactions, error: transError } = await supabase
                .from('transactions')
                .select('amount, type')
                .eq('shift_date', today)
                .is('deleted_at', null);
            
            if (transError) throw transError;
            
            const income = transactions
                ?.filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
            
            const incomeElement = document.getElementById('today-income');
            if (incomeElement) incomeElement.textContent = formatCurrency(income);
        }
        
    } catch (err) {
        console.error('Error cargando estadísticas:', err);
    }
}

/**
 * Carga y muestra alertas importantes
 */
async function loadAlerts() {
    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;
    
    const alerts = [];
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    try {
        // 1. Habitaciones/camas sucias pendientes de limpieza
        const [{ data: dirtyBeds }, { data: dirtyRooms }] = await Promise.all([
            supabase.from('beds').select('*, room:room_id(number, name)').eq('status', 'dirty'),
            supabase.from('rooms').select('*').eq('status', 'dirty')
        ]);
        
        dirtyBeds?.forEach(bed => {
            alerts.push({
                type: 'cleaning',
                priority: 'urgent',
                title: `Limpieza pendiente: Cama ${bed.bed_number}`,
                description: `Habitación ${bed.room?.number || 'N/A'}`,
                time: 'Pendiente',
                icon: '🧹',
                action: () => showOperations()
            });
        });
        
        dirtyRooms?.forEach(room => {
            if (room.type === 'private') {
                alerts.push({
                    type: 'cleaning',
                    priority: 'urgent',
                    title: `Limpieza pendiente: ${room.name}`,
                    description: 'Habitación privada',
                    time: 'Pendiente',
                    icon: '🧹',
                    action: () => showOperations()
                });
            }
        });
        
        // 2. Pagos pendientes de check-ins de hoy
        const { data: pendingPayments } = await supabase
            .from('reservations')
            .select('*, guest:guest_id(full_name)')
            .eq('check_in_date', today)
            .in('payment_status', ['pending', 'partial'])
            .is('deleted_at', null);
        
        pendingPayments?.forEach(res => {
            const isUrgent = res.payment_status === 'pending';
            alerts.push({
                type: 'payment',
                priority: isUrgent ? 'high' : 'medium',
                title: `Pago ${res.payment_status === 'partial' ? 'parcial' : 'pendiente'}`,
                description: `${res.guest?.full_name || 'Huésped'} - ${formatCurrency(res.balance_due)}`,
                time: 'Check-in hoy',
                icon: '💰',
                action: () => showReservationDetail(res.id)
            });
        });
        
        // 3. Check-ins próximos (en la próxima hora)
        const { data: upcomingCheckins } = await supabase
            .from('reservations')
            .select('*, guest:guest_id(full_name), room:room_id(number), bed:bed_id(bed_number, room:room_id(number))')
            .eq('check_in_date', today)
            .eq('status', 'confirmed')
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .limit(3);
        
        upcomingCheckins?.forEach(res => {
            const location = res.bed 
                ? `Cama ${res.bed.bed_number}-H${res.bed.room?.number}`
                : `Hab ${res.room?.number}`;
            
            alerts.push({
                type: 'arrival',
                priority: 'medium',
                title: `Llegada: ${res.guest?.full_name || 'Huésped'}`,
                description: location,
                time: 'Hoy',
                icon: '📥',
                action: () => showReservationDetail(res.id)
            });
        });
        
        // Renderizar alertas
        renderAlerts(alerts);
        
    } catch (err) {
        console.error('Error cargando alertas:', err);
        alertsList.innerHTML = '<p class="text-muted">Error al cargar alertas</p>';
    }
}

/**
 * Renderiza la lista de alertas en el DOM
 * @param {Array} alerts - Array de objetos de alerta
 */
function renderAlerts(alerts) {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    
    // Ordenar por prioridad
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    // Limitar a 5 alertas más importantes
    const topAlerts = alerts.slice(0, 5);
    
    if (topAlerts.length === 0) {
        container.innerHTML = `
            <div class="alert-item" style="border-left-color: var(--success);">
                <span class="alert-icon">✓</span>
                <div class="alert-content">
                    <div class="alert-title">Todo en orden</div>
                    <div class="alert-meta">No hay alertas pendientes</div>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = topAlerts.map(alert => `
        <div class="alert-item ${alert.priority === 'urgent' ? 'urgent' : ''}" 
             onclick="${alert.action ? `(${alert.action.toString()})()` : ''}"
             style="cursor: ${alert.action ? 'pointer' : 'default'};">
            <span class="alert-icon">${alert.icon}</span>
            <div class="alert-content">
                <div class="alert-title">${esc(alert.title)}</div>
                <div class="alert-description">${esc(alert.description)}</div>
                <div class="alert-meta">${esc(alert.time)}</div>
            </div>
            ${alert.action ? '<span class="alert-arrow">→</span>' : ''}
        </div>
    `).join('');
}

/**
 * Carga próximas reservas (próximos 3 días)
 */
async function loadUpcomingReservations() {
    const container = document.getElementById('upcoming-list');
    if (!container) return;
    
    const today = new Date().toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const maxDate = threeDaysLater.toISOString().split('T')[0];
    
    try {
        const { data: reservations, error } = await supabase
            .from('reservations')
            .select(`
                *,
                guest:guest_id(full_name),
                room:room_id(number, name),
                bed:bed_id(bed_number, room:room_id(number))
            `)
            .gte('check_in_date', today)
            .lte('check_in_date', maxDate)
            .in('status', ['confirmed', 'checked_in'])
            .is('deleted_at', null)
            .order('check_in_date', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(10);
        
        if (error) throw error;
        
        if (!reservations || reservations.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay reservas próximas</p>';
            return;
        }
        
        container.innerHTML = reservations.map(res => {
            const location = res.bed 
                ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}`
                : res.room?.name || 'N/A';
            
            const isToday = res.check_in_date === today;
            const dateLabel = isToday ? 'Hoy' : formatDate(res.check_in_date);
            
            return `
                <div class="reservation-card status-${res.status}" onclick="showReservationDetail('${res.id}')">
                    <div class="reservation-header">
                        <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                        <span class="reservation-date-badge">${dateLabel}</span>
                    </div>
                    <div class="reservation-details">
                        <span>🛏️ ${esc(location)}</span>
                        <span>💰 ${formatCurrency(res.total_amount)} | 
                              ${res.payment_status === 'paid' ? '✓ Pagado' : 
                                res.payment_status === 'partial' ? '⚠ Parcial' : '○ Pendiente'}</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Error cargando próximas reservas:', err);
        container.innerHTML = '<p class="text-muted">Error al cargar reservas</p>';
    }
}

/**
 * Carga actividad reciente (opcional, para admin)
 */
async function loadRecentActivity() {
    // Esta función puede expandirse para mostrar log de actividad
    // Por ahora es un placeholder para futuras versiones
    console.log('Actividad reciente cargada');
}

/**
 * Navega a reservas filtrando por check-ins de hoy
 */
function showTodayCheckins() {
    const dateInput = document.getElementById('reservations-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    showTab('checkins');
    showReservations();
}

/**
 * Navega a reservas filtrando por check-outs de hoy
 */
function showTodayCheckouts() {
    const dateInput = document.getElementById('reservations-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    showTab('checkouts');
    showReservations();
}
