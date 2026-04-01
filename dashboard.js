async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('es-PA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    
    try {
        await Promise.all([loadOccupancy(), loadTodayStats(), loadAlerts(), loadUpcomingReservations()]);
    } catch(err) { console.error('Dashboard error:',err); }
}

async function loadOccupancy() {
    try {
        const [{ data:rooms }, { data:beds }] = await Promise.all([
            supabase.from('rooms').select('*'),
            supabase.from('beds').select('*')
        ]);
        let total = 0, occupied = 0;
        rooms?.forEach(r => { if (r.type === 'private') { total += r.capacity_total; if (r.status === 'occupied') occupied += r.capacity_total; } });
        beds?.forEach(b => { total++; if (b.status === 'occupied') occupied++; });
        const pct = total > 0 ? Math.round((occupied/total)*100) : 0;
        const pctEl = document.getElementById('occupancy-percent');
        if (pctEl) pctEl.textContent = pct + '%';
        const fill = document.getElementById('occupancy-fill');
        if (fill) { fill.style.width = pct + '%'; fill.style.background = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)'; }
        const occEl = document.getElementById('occupied-beds');
        if (occEl) occEl.textContent = occupied;
        const totEl = document.getElementById('total-beds');
        if (totEl) totEl.textContent = total;
    } catch(err) { console.error('Occupancy error:',err); }
}

async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [{ data:checkins }, { data:checkouts }] = await Promise.all([
            supabase.from('reservations').select('id').eq('check_in_date',today).is('deleted_at',null),
            supabase.from('reservations').select('id').eq('check_out_date',today).is('deleted_at',null)
        ]);
        const inEl = document.getElementById('today-checkins');
        if (inEl) inEl.textContent = checkins?.length || 0;
        const outEl = document.getElementById('today-checkouts');
        if (outEl) outEl.textContent = checkouts?.length || 0;
        
        if (currentProfile?.role === 'admin') {
            const { data:trans } = await supabase.from('transactions').select('amount,type').eq('shift_date',today).is('deleted_at',null);
            const income = trans?.filter(t => t.type === 'income').reduce((s,t) => s + parseFloat(t.amount||0), 0) || 0;
            const incEl = document.getElementById('today-income');
            if (incEl) incEl.textContent = formatCurrency(income);
        }
    } catch(err) { console.error('Stats error:',err); }
}

async function loadAlerts() {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    const alerts = [], today = new Date().toISOString().split('T')[0];
    
    try {
        const [{ data:dirtyBeds }, { data:dirtyRooms }] = await Promise.all([
            supabase.from('beds').select('*,room:room_id(number)').eq('status','dirty'),
            supabase.from('rooms').select('*').eq('status','dirty')
        ]);
        
        dirtyBeds?.forEach(b => alerts.push({ type:'cleaning', priority:'urgent', title:`Limpieza: Cama ${b.bed_number}`, desc:`Hab ${b.room?.number}`, icon:'🧹' }));
        dirtyRooms?.forEach(r => { if (r.type === 'private') alerts.push({ type:'cleaning', priority:'urgent', title:`Limpieza: ${r.name}`, desc:'Privada', icon:'🧹' }); });
        
        const { data:pending } = await supabase.from('reservations').select('*,guest:guest_id(full_name)').eq('check_in_date',today).in('payment_status',['pending','partial']).is('deleted_at',null);
        pending?.forEach(r => alerts.push({ type:'payment', priority:r.payment_status==='pending'?'high':'medium', title:`Pago ${r.payment_status}`, desc:`${r.guest?.full_name} - ${formatCurrency(r.balance_due)}`, icon:'💰' }));
        
        const { data:upcoming } = await supabase.from('reservations').select('*,guest:guest_id(full_name),room:room_id(number),bed:bed_id(bed_number,room:room_id(number))').eq('check_in_date',today).eq('status','confirmed').is('deleted_at',null).limit(3);
        upcoming?.forEach(r => {
            const loc = r.bed ? `Cama ${r.bed.bed_number}-H${r.bed.room?.number}` : `Hab ${r.room?.number}`;
            alerts.push({ type:'arrival', priority:'medium', title:`Llega: ${r.guest?.full_name}`, desc:loc, icon:'📥' });
        });
        
        renderAlerts(alerts);
    } catch(err) { console.error('Alerts error:',err); container.innerHTML = '<p class="text-muted">Error al cargar alertas</p>'; }
}

function renderAlerts(alerts) {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    const priority = { urgent:0, high:1, medium:2, low:3 };
    alerts.sort((a,b) => priority[a.priority] - priority[b.priority]);
    const top = alerts.slice(0,5);
    
    if (top.length === 0) {
        container.innerHTML = '<div class="alert-item" style="border-left-color:var(--success);"><span class="alert-icon">✓</span><div class="alert-content"><div class="alert-title">Todo en orden</div><div class="alert-meta">Sin alertas pendientes</div></div></div>';
        return;
    }
    
    container.innerHTML = top.map(a => `
        <div class="alert-item ${a.priority==='urgent'?'urgent':''}">
            <span class="alert-icon">${a.icon}</span>
            <div class="alert-content">
                <div class="alert-title">${esc(a.title)}</div>
                <div class="alert-description">${esc(a.desc)}</div>
            </div>
        </div>
    `).join('');
}

async function loadUpcomingReservations() {
    const container = document.getElementById('upcoming-list');
    if (!container) return;
    const today = new Date().toISOString().split('T')[0];
    const max = new Date(); max.setDate(max.getDate()+3);
    const maxStr = max.toISOString().split('T')[0];
    
    try {
        const { data:reservations, error } = await supabase.from('reservations').select('*,guest:guest_id(full_name),room:room_id(number,name),bed:bed_id(bed_number,room:room_id(number))').gte('check_in_date',today).lte('check_in_date',maxStr).in('status',['confirmed','checked_in']).is('deleted_at',null).order('check_in_date').limit(10);
        if (error) throw error;
        
        if (!reservations?.length) { container.innerHTML = '<p class="text-muted">No hay reservas próximas</p>'; return; }
        
        container.innerHTML = reservations.map(r => {
            const loc = r.bed ? `Cama ${r.bed.bed_number} - Hab ${r.bed.room?.number}` : r.room?.name || 'N/A';
            const isToday = r.check_in_date === today;
            return `
                <div class="reservation-card status-${r.status}" onclick="showReservationDetail('${r.id}')">
                    <div class="reservation-header">
                        <span class="reservation-guest">${esc(r.guest?.full_name)}</span>
                        <span style="font-size:0.75rem;padding:0.25rem 0.5rem;border-radius:9999px;background:${isToday?'#d1fae5':'#e5e7eb'};color:${isToday?'#065f46':'#374151'};">${isToday?'Hoy':formatDate(r.check_in_date)}</span>
                    </div>
                    <div class="reservation-details">
                        <span>🛏️ ${esc(loc)}</span>
                        <span>${r.payment_status==='paid'?'✓ Pagado':r.payment_status==='partial'?'⚠ Parcial':'○ Pendiente'} | ${formatCurrency(r.total_amount)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch(err) { console.error('Upcoming error:',err); container.innerHTML = '<p class="text-muted">Error al cargar</p>'; }
}

function showTodayCheckins() { document.getElementById('reservations-date').value = new Date().toISOString().split('T')[0]; showTab('checkins'); showReservations(); }
function showTodayCheckouts() { document.getElementById('reservations-date').value = new Date().toISOString().split('T')[0]; showTab('checkouts'); showReservations(); }
