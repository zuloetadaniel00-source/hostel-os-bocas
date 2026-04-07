// =====================================================
// DASHBOARD - OPTIMIZADO (FIX TIMEZONE PANAMÁ)
// =====================================================

// ✅ FUNCIÓN GLOBAL SEGURA (NUEVA)
function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60000));
    return local.toISOString().split('T')[0];
}

async function loadDashboard() {
    const today = getLocalDate(); // ✅ FIX
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = `Hoy: ${formatDate(today)}`;
    
    Promise.all([
        loadOccupancy(),
        loadTodayStats(),
        loadAlerts(),
        loadUpcomingReservations()
    ]).catch(console.error);
}

async function loadOccupancy() {
    try {
        const [{ data: rooms }, { data: beds }] = await Promise.all([
            db.from('rooms').select('*'),
            db.from('beds').select('*')
        ]);
        
        let totalBeds = 0;
        let occupiedBeds = 0;
        
        rooms?.forEach(room => {
            if (room.type === 'private') {
                totalBeds += room.capacity_total || 0;
                if (room.status === 'occupied') occupiedBeds += room.capacity_total || 0;
            }
        });
        
        beds?.forEach(bed => {
            totalBeds++;
            if (bed.status === 'occupied') occupiedBeds++;
        });
        
        const percentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
        
        const percentEl = document.getElementById('occupancy-percent');
        const fillEl = document.getElementById('occupancy-fill');
        const occupiedEl = document.getElementById('occupied-beds');
        const totalEl = document.getElementById('total-beds');
        
        if (percentEl) percentEl.textContent = percentage + '%';
        if (fillEl) fillEl.style.width = percentage + '%';
        if (occupiedEl) occupiedEl.textContent = occupiedBeds;
        if (totalEl) totalEl.textContent = totalBeds;
        
    } catch (error) {
        console.error('Error loading occupancy:', error);
    }
}

async function loadTodayStats() {
    const today = getLocalDate(); // ✅ FIX
    
    try {
        const [{ data: checkins }, { data: checkouts }] = await Promise.all([
            db.from('reservations').select('*').eq('check_in_date', today).is('deleted_at', null),
            db.from('reservations').select('*').eq('check_out_date', today).is('deleted_at', null)
        ]);
        
        const checkinsEl = document.getElementById('today-checkins');
        const checkoutsEl = document.getElementById('today-checkouts');
        
        if (checkinsEl) checkinsEl.textContent = checkins?.length || 0;
        if (checkoutsEl) checkoutsEl.textContent = checkouts?.length || 0;
        
        if (currentProfile?.role === 'admin') {
            const { data: transactions } = await db
                .from('transactions')
                .select('amount, type')
                .eq('shift_date', today)
                .is('deleted_at', null);
            
            const income = transactions
                ?.filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
            
            const incomeEl = document.getElementById('today-income');
            if (incomeEl) incomeEl.textContent = formatCurrency(income);
        }
    } catch (error) {
        console.error('Error loading today stats:', error);
    }
}

async function loadAlerts() {
    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;
    
    alertsList.innerHTML = '';
    const alerts = [];
    
    try {
        const [{ data: dirtyBeds }, { data: dirtyRooms }] = await Promise.all([
            db.from('beds').select('*, room:room_id(number)').eq('status', 'dirty'),
            db.from('rooms').select('*').eq('status', 'dirty')
        ]);
        
        dirtyBeds?.forEach(bed => {
            alerts.push({
                type: 'cleaning',
                title: `Limpieza pendiente: Cama ${bed.bed_number} Hab ${bed.room?.number}`,
                urgent: true
            });
        });
        
        dirtyRooms?.forEach(room => {
            alerts.push({
                type: 'cleaning',
                title: `Limpieza pendiente: ${room.name}`,
                urgent: true
            });
        });
        
        const today = getLocalDate(); // ✅ FIX
        const { data: pendingPayments } = await db
            .from('reservations')
            .select('*, guest:guest_id(full_name)')
            .eq('check_in_date', today)
            .eq('payment_status', 'pending')
            .is('deleted_at', null);
        
        pendingPayments?.forEach(res => {
            alerts.push({
                type: 'payment',
                title: `Pago pendiente: ${res.guest?.full_name}`,
                urgent: false
            });
        });
        
        if (alerts.length === 0) {
            alertsList.innerHTML = '<p class="text-muted">No hay alertas pendientes</p>';
            return;
        }
        
        alerts.forEach(alert => {
            const div = document.createElement('div');
            div.className = `alert-item ${alert.urgent ? 'urgent' : ''}`;
            div.innerHTML = `
                <span class="alert-icon">${alert.type === 'cleaning' ? '🧹' : '💰'}</span>
                <div class="alert-content">
                    <div class="alert-title">${esc(alert.title)}</div>
                </div>
            `;
            alertsList.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error loading alerts:', error);
        alertsList.innerHTML = '<p class="text-muted">Error al cargar alertas</p>';
    }
}

async function loadUpcomingReservations() {
    const list = document.getElementById('upcoming-list');
    if (!list) return;
    
    const today = getLocalDate(); // ✅ FIX
    
    try {
        const { data: reservations } = await db
            .from('reservations')
            .select('*, guest:guest_id(full_name), room:room_id(number, name), bed:bed_id(bed_number, room:room_id(number))')
            .gte('check_in_date', today)
            .is('deleted_at', null)
            .order('check_in_date', { ascending: true })
            .limit(5);
        
        if (!reservations || reservations.length === 0) {
            list.innerHTML = '<p class="text-muted">No hay reservas próximas</p>';
            return;
        }
        
        list.innerHTML = '';
        reservations.forEach(res => {
            const location = res.bed 
                ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}`
                : res.room?.name || 'N/A';
            
            const card = document.createElement('div');
            card.className = 'reservation-card';
            card.onclick = () => showReservationDetail(res.id);
            card.innerHTML = `
                <div class="reservation-header">
                    <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                    <span class="reservation-status status-${res.status}">${getStatusLabel(res.status)}</span>
                </div>
                <div class="reservation-details">
                    <span>📅 ${formatDate(res.check_in_date)}</span>
                    <span>🛏️ ${esc(location)}</span>
                </div>
            `;
            list.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading upcoming:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar</p>';
    }
}

function getStatusLabel(status) {
    const labels = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        checked_in: 'Check-in',
        checked_out: 'Check-out',
        cancelled: 'Cancelada'
    };
    return labels[status] || status;
}

function showTodayCheckins() {
    const dateInput = document.getElementById('reservations-date');
    if (dateInput) dateInput.value = getLocalDate(); // ✅ FIX
    showTab('checkins');
    showReservations();
}

function showTodayCheckouts() {
    const dateInput = document.getElementById('reservations-date');
    if (dateInput) dateInput.value = getLocalDate(); // ✅ FIX
    showTab('checkouts');
    showReservations();
}

window.loadDashboard = loadDashboard;
window.showTodayCheckins = showTodayCheckins;
window.showTodayCheckouts = showTodayCheckouts;
