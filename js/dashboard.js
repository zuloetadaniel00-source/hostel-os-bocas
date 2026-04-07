// =====================================================
// DASHBOARD - OPTIMIZADO CON ZONA HORARIA PANAMÁ
// Premium UX Edition
// =====================================================

async function loadDashboard() {
    const today = getTodayInPanama();
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const formattedDate = new Intl.DateTimeFormat('es-PA', {
            timeZone: 'America/Panama',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date());
        dateEl.textContent = formattedDate;
    }
    
    // Show loading states
    showDashboardSkeletons();
    
    // Load data in parallel
    try {
        await Promise.all([
            loadOccupancy(),
            loadTodayStats(),
            loadAlerts(),
            loadUpcomingReservations()
        ]);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error al cargar el dashboard', 'error');
    }
}

function showDashboardSkeletons() {
    const alertsList = document.getElementById('alerts-list');
    const upcomingList = document.getElementById('upcoming-list');
    
    if (alertsList) {
        alertsList.innerHTML = `
            <div class="skeleton" style="height: 70px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
            <div class="skeleton" style="height: 70px; border-radius: var(--radius-lg);"></div>
        `;
    }
    
    if (upcomingList) {
        upcomingList.innerHTML = `
            <div class="skeleton" style="height: 90px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
            <div class="skeleton" style="height: 90px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
            <div class="skeleton" style="height: 90px; border-radius: var(--radius-lg);"></div>
        `;
    }
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
        
        // Animate the percentage
        if (percentEl) {
            animateNumber(percentEl, 0, percentage, 1000, '%');
        }
        
        if (fillEl) {
            setTimeout(() => {
                fillEl.style.width = percentage + '%';
            }, 200);
        }
        
        if (occupiedEl) occupiedEl.textContent = occupiedBeds;
        if (totalEl) totalEl.textContent = totalBeds;
        
    } catch (error) {
        console.error('Error loading occupancy:', error);
    }
}

function animateNumber(element, start, end, duration, suffix = '') {
    const range = end - start;
    const minTimer = 50;
    let stepTime = Math.abs(Math.floor(duration / range));
    stepTime = Math.max(stepTime, minTimer);
    
    let startTime = new Date().getTime();
    let endTime = startTime + duration;
    let timer;
    
    function run() {
        let now = new Date().getTime();
        let remaining = Math.max((endTime - now) / duration, 0);
        let value = Math.round(end - (remaining * range));
        element.textContent = value + suffix;
        if (value == end) {
            clearInterval(timer);
        }
    }
    
    timer = setInterval(run, stepTime);
    run();
}

async function loadTodayStats() {
    const today = getTodayInPanama();
    
    try {
        const [{ data: checkins }, { data: checkouts }] = await Promise.all([
            db.from('reservations').select('*').eq('check_in_date', today).is('deleted_at', null),
            db.from('reservations').select('*').eq('check_out_date', today).is('deleted_at', null)
        ]);
        
        const checkinsEl = document.getElementById('today-checkins');
        const checkoutsEl = document.getElementById('today-checkouts');
        
        if (checkinsEl) {
            animateNumber(checkinsEl, 0, checkins?.length || 0, 800);
        }
        if (checkoutsEl) {
            animateNumber(checkoutsEl, 0, checkouts?.length || 0, 800);
        }
        
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
            if (incomeEl) {
                incomeEl.textContent = formatCurrency(income);
                incomeEl.style.animation = 'pulse 0.5s ease';
            }
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
                urgent: true,
                icon: '🛏️'
            });
        });
        
        dirtyRooms?.forEach(room => {
            alerts.push({
                type: 'cleaning',
                title: `Limpieza pendiente: ${room.name}`,
                urgent: true,
                icon: '🧹'
            });
        });
        
        const today = getTodayInPanama();
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
                urgent: false,
                icon: '💰'
            });
        });
        
        if (alerts.length === 0) {
            alertsList.innerHTML = `
                <div style="text-align: center; padding: var(--space-8) var(--space-4); color: var(--gray-400);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-3);">✨</div>
                    <div style="font-weight: 600;">No hay alertas pendientes</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">Todo está bajo control</div>
                </div>
            `;
            return;
        }
        
        alerts.forEach((alert, index) => {
            const div = document.createElement('div');
            div.className = `alert-item ${alert.urgent ? 'urgent' : ''}`;
            div.style.animationDelay = `${index * 0.1}s`;
            div.innerHTML = `
                <span class="alert-icon">${alert.icon}</span>
                <div class="alert-content">
                    <div class="alert-title">${esc(alert.title)}</div>
                    <div class="alert-meta">${alert.urgent ? 'Requiere atención inmediata' : 'Pendiente'}</div>
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
    
    const today = getTodayInPanama();
    
    try {
        const { data: reservations } = await db
            .from('reservations')
            .select('*, guest:guest_id(full_name), room:room_id(number, name), bed:bed_id(bed_number, room:room_id(number))')
            .gte('check_in_date', today)
            .is('deleted_at', null)
            .order('check_in_date', { ascending: true })
            .limit(5);
        
        if (!reservations || reservations.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: var(--space-8) var(--space-4); color: var(--gray-400);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-3);">📅</div>
                    <div style="font-weight: 600;">No hay reservas próximas</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">El calendario está libre</div>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        reservations.forEach((res, index) => {
            const location = res.bed 
                ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}`
                : res.room?.name || 'N/A';
            
            const card = document.createElement('div');
            card.className = 'reservation-card';
            card.style.animationDelay = `${index * 0.1}s`;
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
    if (dateInput) dateInput.value = getTodayInPanama();
    showTab('checkins');
    showReservations();
}

function showTodayCheckouts() {
    const dateInput = document.getElementById('reservations-date');
    if (dateInput) dateInput.value = getTodayInPanama();
    showTab('checkouts');
    showReservations();
}

window.loadDashboard = loadDashboard;
window.showTodayCheckins = showTodayCheckins;
window.showTodayCheckouts = showTodayCheckouts;
