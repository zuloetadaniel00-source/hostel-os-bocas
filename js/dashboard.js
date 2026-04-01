// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('current-date').textContent = `Hoy: ${formatDate(today)}`;
    
    // Cargar datos en paralelo
    await Promise.all([
        loadOccupancy(),
        loadTodayStats(),
        loadAlerts(),
        loadUpcomingReservations()
    ]);
}

async function loadOccupancy() {
    // Contar camas ocupadas vs totales
    const { data: rooms } = await supabase.from('rooms').select('*');
    const { data: beds } = await supabase.from('beds').select('*');
    
    // Contar dormitorios (camas individuales) + privadas (habitación completa)
    let totalBeds = 0;
    let occupiedBeds = 0;
    
    // Habitaciones privadas
    rooms.forEach(room => {
        if (room.type === 'private') {
            totalBeds += room.capacity_total;
            if (room.status === 'occupied') {
                occupiedBeds += room.capacity_total;
            }
        }
    });
    
    // Camas de dormitorios
    beds.forEach(bed => {
        totalBeds++;
        if (bed.status === 'occupied') occupiedBeds++;
    });
    
    const percentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    
    document.getElementById('occupancy-percent').textContent = percentage + '%';
    document.getElementById('occupancy-fill').style.width = percentage + '%';
    document.getElementById('occupied-beds').textContent = occupiedBeds;
    document.getElementById('total-beds').textContent = totalBeds;
}

async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    
    // Check-ins hoy
    const { data: checkins } = await supabase
        .from('reservations')
        .select('*')
        .eq('check_in_date', today)
        .is('deleted_at', null);
    
    // Check-outs hoy
    const { data: checkouts } = await supabase
        .from('reservations')
        .select('*')
        .eq('check_out_date', today)
        .is('deleted_at', null);
    
    document.getElementById('today-checkins').textContent = checkins?.length || 0;
    document.getElementById('today-checkouts').textContent = checkouts?.length || 0;
    
    // Ingresos hoy (solo admin)
    if (currentProfile?.role === 'admin') {
        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount, type')
            .eq('shift_date', today)
            .is('deleted_at', null);
        
        const income = transactions
            ?.filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
        
        document.getElementById('today-income').textContent = formatCurrency(income);
    }
}

async function loadAlerts() {
    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';
    
    const alerts = [];
    
    // 1. Camas sin limpiar después de check-out
    const { data: dirtyBeds } = await supabase
        .from('beds')
        .select('*, room:room_id(number)')
        .eq('status', 'dirty');
    
    const { data: dirtyRooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'dirty');
    
    dirtyBeds?.forEach(bed => {
        alerts.push({
            type: 'cleaning',
            title: `Limpieza pendiente: Cama ${bed.bed_number} Hab ${bed.room?.number}`,
            meta: 'Desde check-out',
            urgent: true
        });
    });
    
    dirtyRooms?.forEach(room => {
        alerts.push({
            type: 'cleaning',
            title: `Limpieza pendiente: ${room.name}`,
            meta: 'Desde check-out',
            urgent: true
        });
    });
    
    // 2. Pagos pendientes
    const today = new Date().toISOString().split('T')[0];
    const { data: pendingPayments } = await supabase
        .from('reservations')
        .select('*, guest:guest_id(full_name)')
        .eq('check_in_date', today)
        .eq('payment_status', 'pending')
        .is('deleted_at', null);
    
    pendingPayments?.forEach(res => {
        alerts.push({
            type: 'payment',
            title: `Pago pendiente: ${res.guest?.full_name}`,
            meta: `Check-in hoy - $${res.balance_due}`,
            urgent: false
        });
    });
    
    // Renderizar alertas
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
                <div class="alert-meta">${esc(alert.meta)}</div>
            </div>
        `;
        alertsList.appendChild(div);
    });
}

async function loadUpcomingReservations() {
    const today = new Date().toISOString().split('T')[0];
    const list = document.getElementById('upcoming-list');
    list.innerHTML = '';
    
    const { data: reservations } = await supabase
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
    document.getElementById('reservations-date').value = new Date().toISOString().split('T')[0];
    showTab('checkins');
    showReservations();
}

function showTodayCheckouts() {
    document.getElementById('reservations-date').value = new Date().toISOString().split('T')[0];
    showTab('checkouts');
    showReservations();
}
