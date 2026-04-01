async function showDormitoryOptions() {
    document.getElementById('dormitory-options')?.classList.remove('hidden');
    document.getElementById('private-options')?.classList.add('hidden');
    const checkIn = reservationData.checkIn || document.getElementById('check-in-date')?.value;
    const checkOut = reservationData.checkOut || document.getElementById('check-out-date')?.value;
    if (!checkIn || !checkOut) return;
    
    const list = document.getElementById('dormitory-list');
    if (!list) return;
    list.innerHTML = '<p>Cargando...</p>';
    
    try {
        const { data:rooms } = await supabase.from('rooms').select('*,beds(*)').eq('type','dormitory');
        const { data:reservations } = await supabase.from('reservations').select('bed_id,status').gte('check_in_date',checkIn).lte('check_in_date',checkOut).neq('status','cancelled').neq('status','checked_out').is('deleted_at',null);
        const occupied = new Set(reservations?.map(r => r.bed_id) || []);
        
        list.innerHTML = '';
        rooms?.forEach(room => {
            const available = room.beds?.filter(b => !occupied.has(b.id) && b.status === 'available') || [];
            const isFull = available.length === 0;
            const div = document.createElement('div');
            div.className = `room-option ${isFull?'disabled':''}`;
            div.innerHTML = `<div class="room-info"><h4>${esc(room.name)}</h4><p>${available.length} de ${room.beds?.length || 0} camas libres</p></div><span class="room-status ${isFull?'status-occupied':'status-available'}">${isFull?'Lleno':'Disponible'}</span>`;
            if (!isFull) div.onclick = () => selectDormitory(room, available, div);
            list.appendChild(div);
        });
    } catch(err) { console.error('Error dormitorios:',err); list.innerHTML = '<p class="text-muted">Error al cargar</p>'; }
}

async function showPrivateOptions() {
    document.getElementById('dormitory-options')?.classList.add('hidden');
    document.getElementById('private-options')?.classList.remove('hidden');
    const checkIn = reservationData.checkIn || document.getElementById('check-in-date')?.value;
    const checkOut = reservationData.checkOut || document.getElementById('check-out-date')?.value;
    if (!checkIn || !checkOut) return;
    
    const list = document.getElementById('private-list');
    if (!list) return;
    list.innerHTML = '<p>Cargando...</p>';
    
    try {
        const { data:reservations } = await supabase.from('reservations').select('room_id,status').gte('check_in_date',checkIn).lte('check_in_date',checkOut).neq('status','cancelled').neq('status','checked_out').is('deleted_at',null);
        const occupied = new Set(reservations?.map(r => r.room_id) || []);
        const { data:rooms } = await supabase.from('rooms').select('*').eq('type','private').order('number');
        
        list.innerHTML = '';
        rooms?.forEach(room => {
            const isOcc = occupied.has(room.id);
            const div = document.createElement('div');
            div.className = `room-option ${isOcc?'disabled':''}`;
            div.innerHTML = `<div class="room-info"><h4>${esc(room.name)}</h4><p>Capacidad: ${room.capacity_total}</p></div><span class="room-status ${isOcc?'status-occupied':'status-available'}">${isOcc?'Ocupada':'Libre'}</span>`;
            if (!isOcc) div.onclick = () => selectPrivateRoom(room, div);
            list.appendChild(div);
        });
    } catch(err) { console.error('Error privadas:',err); list.innerHTML = '<p class="text-muted">Error al cargar</p>'; }
}

function selectDormitory(room, availableBeds, element) {
    document.querySelectorAll('#dormitory-list .room-option').forEach(el => {
        el.classList.remove('selected');
        const existing = el.querySelector('.bed-selection');
        if (existing) existing.remove();
    });
    element.classList.add('selected');
    
    const bedSel = document.createElement('div');
    bedSel.className = 'bed-selection';
    bedSel.innerHTML = '<p style="margin:0.5rem 0;font-size:0.875rem;color:var(--gray-600);">Selecciona cama:</p>';
    const grid = document.createElement('div');
    grid.className = 'bed-list';
    
    availableBeds.forEach(bed => {
        const b = document.createElement('div');
        b.className = 'bed-option';
        b.textContent = bed.bed_number;
        b.onclick = (e) => {
            e.stopPropagation();
            grid.querySelectorAll('.bed-option').forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
            reservationData.bedId = bed.id;
            reservationData.roomId = null;
            document.getElementById('step1-continue').disabled = false;
        };
        grid.appendChild(b);
    });
    bedSel.appendChild(grid);
    element.appendChild(bedSel);
}

function selectPrivateRoom(room, element) {
    document.querySelectorAll('#private-list .room-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    reservationData.roomId = room.id;
    reservationData.bedId = null;
    document.getElementById('step1-continue').disabled = false;
}

document.getElementById('step1-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    reservationData.checkIn = document.getElementById('check-in-date').value;
    reservationData.checkOut = document.getElementById('check-out-date').value;
    if (!reservationData.roomId && !reservationData.bedId) { showToast('Selecciona habitación o cama','error'); return; }
    showPage('new-reservation-step2');
});

document.getElementById('step2-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    updateReservationSummary();
    showPage('new-reservation-step3');
});

function updateReservationSummary() {
    const summary = document.getElementById('reservation-summary');
    if (!summary) return;
    const nights = Math.ceil((new Date(reservationData.checkOut) - new Date(reservationData.checkIn)) / (1000*60*60*24));
    summary.innerHTML = `
        <div class="summary-row"><span>Huésped:</span><span>${esc(document.getElementById('guest-name')?.value)}</span></div>
        <div class="summary-row"><span>Entrada:</span><span>${formatDate(reservationData.checkIn)}</span></div>
        <div class="summary-row"><span>Salida:</span><span>${formatDate(reservationData.checkOut)}</span></div>
        <div class="summary-row"><span>Noches:</span><span>${nights}</span></div>
    `;
}

document.getElementById('total-amount')?.addEventListener('input', updateBalance);
document.getElementById('initial-payment')?.addEventListener('input', updateBalance);

function updateBalance() {
    const total = parseFloat(document.getElementById('total-amount')?.value) || 0;
    const paid = parseFloat(document.getElementById('initial-payment')?.value) || 0;
    const balance = total - paid;
    const el = document.getElementById('balance-due');
    if (el) el.textContent = formatCurrency(balance);
}

function toggleReceiptUpload() {
    const method = document.querySelector('input[name="payment-method"]:checked')?.value;
    const group = document.getElementById('receipt-upload-group');
    const input = document.getElementById('payment-receipt');
    if (method === 'yappy' || method === 'card') {
        group?.classList.remove('hidden');
        if (input) input.required = true;
    } else {
        group?.classList.add('hidden');
        if (input) input.required = false;
    }
}

document.getElementById('payment-receipt')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('receipt-preview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:auto;">`;
            preview.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
});

document.getElementById('step3-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('create-reservation-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    
    try {
        const { data:guest, error:gErr } = await supabase.from('guests').insert([{
            full_name: document.getElementById('guest-name').value,
            email: document.getElementById('guest-email').value,
            phone: document.getElementById('guest-phone').value,
            nationality: document.getElementById('guest-nationality').value,
            document_type: document.getElementById('guest-doc-type').value,
            document_id: document.getElementById('guest-doc-id').value,
            notes: document.getElementById('guest-notes')?.value || ''
        }]).select().single();
        if (gErr) throw gErr;
        
        let receiptUrl = null;
        const file = document.getElementById('payment-receipt')?.files[0];
        if (file) {
            const fname = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g,'_')}`;
            const { error:upErr } = await supabase.storage.from('receipts').upload(fname, file);
            if (upErr) throw upErr;
            const { data:{publicUrl} } = supabase.storage.from('receipts').getPublicUrl(fname);
            receiptUrl = publicUrl;
        }
        
        const total = parseFloat(document.getElementById('total-amount').value) || 0;
        const initial = parseFloat(document.getElementById('initial-payment').value) || 0;
        const method = document.querySelector('input[name="payment-method"]:checked')?.value;
        const status = document.getElementById('reservation-status')?.value;
        
        const { data:reservation, error:rErr } = await supabase.from('reservations').insert([{
            guest_id: guest.id,
            room_id: reservationData.roomId,
            bed_id: reservationData.bedId,
            check_in_date: reservationData.checkIn,
            check_out_date: reservationData.checkOut,
            total_amount: total,
            amount_paid: initial,
            status: status === 'confirmed' ? 'confirmed' : 'pending',
            payment_status: initial >= total ? 'paid' : initial > 0 ? 'partial' : 'pending',
            source: 'walk_in',
            notes: document.getElementById('reservation-notes')?.value || '',
            created_by: currentUser.id
        }]).select().single();
        if (rErr) throw rErr;
        
        if (initial > 0) {
            await supabase.from('payments').insert([{
                reservation_id: reservation.id,
                amount: initial,
                payment_method: method,
                payment_type: initial >= total ? 'full' : 'deposit',
                receipt_url: receiptUrl,
                created_by: currentUser.id
            }]);
        }
        
        showToast('Reserva creada exitosamente', 'success');
        showReservations();
    } catch(err) {
        console.error('Error creando reserva:',err);
        showToast('Error: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✓ Crear Reserva'; }
    }
});

async function loadReservationsByDate() {
    const date = document.getElementById('reservations-date')?.value;
    const list = document.getElementById('reservations-list');
    if (!list || !date) return;
    list.innerHTML = '<p>Cargando...</p>';
    
    try {
        const { data:reservations, error } = await supabase.from('reservations').select('*,guest:guest_id(full_name),room:room_id(number,name),bed:bed_id(bed_number,room:room_id(number))').or(`check_in_date.eq.${date},check_out_date.eq.${date}`).is('deleted_at',null).order('created_at',{ascending:false});
        if (error) throw error;
        
        if (!reservations?.length) { list.innerHTML = '<p class="text-muted">Sin reservas esta fecha</p>'; return; }
        
        list.innerHTML = reservations.map(r => {
            const isCheckin = r.check_in_date === date;
            const loc = r.bed ? `Cama ${r.bed.bed_number}-H${r.bed.room?.number}` : r.room?.name || 'N/A';
            return `
                <div class="reservation-card status-${r.status}" onclick="showReservationDetail('${r.id}')">
                    <div class="reservation-header">
                        <span class="reservation-guest">${esc(r.guest?.full_name)}</span>
                        <span style="font-size:0.75rem;padding:0.25rem 0.5rem;border-radius:9999px;background:${isCheckin?'#d1fae5':'#fee2e2'};color:${isCheckin?'#065f46':'#991b1b'};">${isCheckin?'CHECK-IN':'CHECK-OUT'}</span>
                    </div>
                    <div class="reservation-details"><span>🛏️ ${esc(loc)}</span><span>📅 ${formatDate(r.check_in_date)} - ${formatDate(r.check_out_date)}</span></div>
                    <div class="reservation-payment">
                        <span class="payment-badge payment-${r.payment_status}">${r.payment_status==='paid'?'Pagado':r.payment_status==='partial'?'Parcial':'Pendiente'}</span>
                        <span>${formatCurrency(r.total_amount)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch(err) { console.error('Error cargando reservas:',err); list.innerHTML = '<p class="text-muted">Error al cargar</p>'; }
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    // Aquí filtrarías visualmente si tuvieras muchos datos
}

async function showReservationDetail(id) {
    try {
        const { data:r, error } = await supabase.from('reservations').select('*,guest:guest_id(*),room:room_id(*),bed:bed_id(*,room:room_id(*)),payments(*)').eq('id',id).single();
        if (error || !r) throw error || new Error('No encontrada');
        
        const loc = r.bed ? `Cama ${r.bed.bed_number} - Hab ${r.bed.room?.number}` : r.room?.name || 'N/A';
        const content = document.getElementById('reservation-detail-content');
        if (content) {
            content.innerHTML = `
                <div class="detail-section"><h4>Huésped</h4>
                    <div class="detail-row"><span class="detail-label">Nombre</span><span class="detail-value">${esc(r.guest?.full_name)}</span></div>
                    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(r.guest?.email)}</span></div>
                    <div class="detail-row"><span class="detail-label">Teléfono</span><span class="detail-value">${esc(r.guest?.phone)}</span></div>
                    <div class="detail-row"><span class="detail-label">Documento</span><span class="detail-value">${esc(r.guest?.document_type)}: ${esc(r.guest?.document_id)}</span></div>
                </div>
                <div class="detail-section"><h4>Alojamiento</h4>
                    <div class="detail-row"><span class="detail-label">Ubicación</span><span class="detail-value">${esc(loc)}</span></div>
                    <div class="detail-row"><span class="detail-label">Entrada</span><span class="detail-value">${formatDate(r.check_in_date)}</span></div>
                    <div class="detail-row"><span class="detail-label">Salida</span><span class="detail-value">${formatDate(r.check_out_date)}</span></div>
                </div>
                <div class="detail-section"><h4>Pagos</h4>
                    <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${formatCurrency(r.total_amount)}</span></div>
                    <div class="detail-row"><span class="detail-label">Pagado</span><span class="detail-value">${formatCurrency(r.amount_paid)}</span></div>
                    <div class="detail-row"><span class="detail-label">Pendiente</span><span class="detail-value" style="color:${r.balance_due>0?'var(--danger)':'var(--success)'}">${formatCurrency(r.balance_due)}</span></div>
                    ${r.payments?.map(p => `<div class="detail-row" style="font-size:0.875rem;"><span>${formatDateTime(p.created_at)} - ${p.payment_method}</span><span>${formatCurrency(p.amount)}</span></div>`).join('') || ''}
                </div>
                ${r.notes ? `<div class="detail-section"><h4>Notas</h4><p style="font-size:0.875rem;color:var(--gray-600);">${esc(r.notes)}</p></div>` : ''}
            `;
        }
        
        const actions = document.getElementById('detail-actions');
        if (actions) {
            let html = '';
            if (r.status === 'confirmed') html += `<button onclick="doCheckIn('${r.id}')" class="btn btn-primary">Check-in</button>`;
            if (r.status === 'checked_in') {
                html += `<button onclick="doCheckOut('${r.id}')" class="btn btn-warning">Check-out</button>`;
                if (r.balance_due > 0) html += `<button onclick="addPayment('${r.id}')" class="btn btn-success">Registrar pago</button>`;
            }
            if (r.status !== 'cancelled' && r.status !== 'checked_out') html += `<button onclick="cancelReservation('${r.id}')" class="btn btn-danger">Cancelar</button>`;
            actions.innerHTML = html;
        }
        
        showPage('reservation-detail-page');
    } catch(err) { console.error('Error cargando detalle:',err); showToast('Error al cargar reserva','error'); }
}

async function doCheckIn(id) {
    try {
        const { error } = await supabase.from('reservations').update({ status:'checked_in' }).eq('id',id);
        if (error) throw error;
        showToast('Check-in realizado','success');
        showReservations();
    } catch(err) { showToast('Error en check-in: '+err.message,'error'); }
}

async function doCheckOut(id) {
    try {
        const { error } = await supabase.from('reservations').update({ status:'checked_out' }).eq('id',id);
        if (error) throw error;
        showToast('Check-out realizado - Tarea de limpieza creada','success');
        showReservations();
    } catch(err) { showToast('Error en check-out: '+err.message,'error'); }
}

async function cancelReservation(id) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
        const { error } = await supabase.from('reservations').update({ status:'cancelled',deleted_at:new Date().toISOString() }).eq('id',id);
        if (error) throw error;
        showToast('Reserva cancelada','success');
        showReservations();
    } catch(err) { showToast('Error al cancelar: '+err.message,'error'); }
}

async function addPayment(reservationId) {
    const amount = prompt('Monto a pagar:');
    if (!amount || isNaN(amount)) return;
    // Aquí expandirías para seleccionar método y subir comprobante
    try {
        await supabase.from('payments').insert([{ reservation_id:reservationId, amount:parseFloat(amount), payment_method:'cash', payment_type:'balance', created_by:currentUser.id }]);
        showToast('Pago registrado','success');
        showReservationDetail(reservationId);
    } catch(err) { showToast('Error: '+err.message,'error'); }
}
