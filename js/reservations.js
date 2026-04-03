// =====================================================
// RESERVAS - OPTIMIZADO
// =====================================================

let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
};

function resetReservationForm() {
    reservationData = { roomId: null, bedId: null, checkIn: null, checkOut: null, guestId: null };
    document.getElementById('step1-form')?.reset();
    document.getElementById('step2-form')?.reset();
    document.getElementById('step3-form')?.reset();
    
    const totalEl = document.getElementById('total-amount');
    const initialEl = document.getElementById('initial-payment');
    const balanceEl = document.getElementById('balance-due');
    const photoPreview = document.getElementById('guest-photo-preview');
    const receiptPreview = document.getElementById('receipt-preview');
    
    if (totalEl) totalEl.value = '0';
    if (initialEl) initialEl.value = '0';
    if (balanceEl) balanceEl.textContent = '$0.00';
    if (photoPreview) photoPreview.classList.add('hidden');
    if (receiptPreview) receiptPreview.classList.add('hidden');
}

function showDormitoryOptions() {
    document.getElementById('dormitory-options')?.classList.remove('hidden');
    document.getElementById('private-options')?.classList.add('hidden');
    loadDormitoryOptions();
}

function showPrivateOptions() {
    document.getElementById('dormitory-options')?.classList.add('hidden');
    document.getElementById('private-options')?.classList.remove('hidden');
    loadPrivateOptions();
}

function updateAvailability() {
    const type = document.querySelector('input[name="accommodation-type"]:checked')?.value;
    if (type === 'dormitory') loadDormitoryOptions();
    else if (type === 'private') loadPrivateOptions();
}

async function loadDormitoryOptions() {
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    if (!checkIn || !checkOut) return;
    
    const list = document.getElementById('dormitory-list');
    if (!list) return;
    list.innerHTML = '<p>Cargando...</p>';

    try {
        const [{ data: rooms }, { data: reservations }] = await Promise.all([
            db.from('rooms').select('*, beds(*)').eq('type', 'dormitory'),
            db.from('reservations').select('bed_id, status')
                .gte('check_in_date', checkIn)
                .lte('check_in_date', checkOut)
                .neq('status', 'cancelled')
                .neq('status', 'checked_out')
                .is('deleted_at', null)
        ]);

        const occupiedBeds = new Set(reservations?.map(r => r.bed_id) || []);
        list.innerHTML = '';
        
        rooms?.forEach(room => {
            const availableBeds = room.beds?.filter(b => !occupiedBeds.has(b.id) && b.status === 'available') || [];
            const isFull = availableBeds.length === 0;
            const div = document.createElement('div');
            div.className = `room-option ${isFull ? 'disabled' : ''}`;
            div.innerHTML = `
                <div class="room-info">
                    <h4>${esc(room.name)}</h4>
                    <p>${availableBeds.length} de ${room.beds?.length || 0} camas disponibles</p>
                </div>
                <span class="room-status ${isFull ? 'status-occupied' : 'status-available'}">${isFull ? 'Lleno' : 'Disponible'}</span>
            `;
            if (!isFull) div.onclick = () => selectDormitory(room, availableBeds, div);
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading dormitories:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar</p>';
    }
}

async function loadPrivateOptions() {
    const checkIn = document.getElementById('check-in-date')?.value;
    const checkOut = document.getElementById('check-out-date')?.value;
    if (!checkIn || !checkOut) return;
    
    const list = document.getElementById('private-list');
    if (!list) return;
    list.innerHTML = '<p>Cargando...</p>';

    try {
        const [{ data: reservations }, { data: rooms }] = await Promise.all([
            db.from('reservations').select('room_id, status')
                .gte('check_in_date', checkIn)
                .lte('check_in_date', checkOut)
                .neq('status', 'cancelled')
                .neq('status', 'checked_out')
                .is('deleted_at', null),
            db.from('rooms').select('*').eq('type', 'private').order('number')
        ]);

        const occupiedRooms = new Set(reservations?.map(r => r.room_id) || []);
        list.innerHTML = '';
        
        rooms?.forEach(room => {
            const isOccupied = occupiedRooms.has(room.id);
            const div = document.createElement('div');
            div.className = `room-option ${isOccupied ? 'disabled' : ''}`;
            div.innerHTML = `
                <div class="room-info">
                    <h4>${esc(room.name)}</h4>
                    <p>Capacidad: ${room.capacity_total} personas</p>
                </div>
                <span class="room-status ${isOccupied ? 'status-occupied' : 'status-available'}">${isOccupied ? 'Ocupada' : 'Disponible'}</span>
            `;
            if (!isOccupied) div.onclick = () => selectPrivateRoom(room, div);
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading private rooms:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar</p>';
    }
}

function selectDormitory(room, availableBeds, element) {
    document.querySelectorAll('#dormitory-list .room-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    
    let bedSelection = element.querySelector('.bed-selection');
    if (!bedSelection) {
        bedSelection = document.createElement('div');
        bedSelection.className = 'bed-selection';
        bedSelection.innerHTML = '<p style="margin: 0.5rem 0; font-size: 0.875rem; color: var(--gray-600);">Selecciona una cama:</p>';
        const bedGrid = document.createElement('div');
        bedGrid.className = 'bed-list';
        
        availableBeds.forEach(bed => {
            const bedDiv = document.createElement('div');
            bedDiv.className = 'bed-option';
            bedDiv.textContent = bed.bed_number;
            bedDiv.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.bed-option').forEach(b => b.classList.remove('selected'));
                bedDiv.classList.add('selected');
                reservationData.bedId = bed.id;
                reservationData.roomId = null;
                const btn = document.getElementById('step1-continue');
                if (btn) btn.disabled = false;
            };
            bedGrid.appendChild(bedDiv);
        });
        bedSelection.appendChild(bedGrid);
        element.appendChild(bedSelection);
    }
}

function selectPrivateRoom(room, element) {
    document.querySelectorAll('#private-list .room-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    reservationData.roomId = room.id;
    reservationData.bedId = null;
    const btn = document.getElementById('step1-continue');
    if (btn) btn.disabled = false;
}

document.getElementById('step1-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    reservationData.checkIn = document.getElementById('check-in-date')?.value;
    reservationData.checkOut = document.getElementById('check-out-date')?.value;
    
    if (!reservationData.roomId && !reservationData.bedId) {
        showToast('Selecciona una habitación o cama', 'error');
        return;
    }
    
    document.getElementById('new-reservation-page')?.classList.add('hidden');
    document.getElementById('new-reservation-step2')?.classList.remove('hidden');
});

function goToStep(step) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    if (step === 1) document.getElementById('new-reservation-page')?.classList.remove('hidden');
    else if (step === 2) document.getElementById('new-reservation-step2')?.classList.remove('hidden');
}

document.getElementById('guest-photo')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('guest-photo-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Foto del huésped">`;
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('step2-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('new-reservation-step2')?.classList.add('hidden');
    document.getElementById('new-reservation-step3')?.classList.remove('hidden');
    updateReservationSummary();
});

function updateReservationSummary() {
    const checkIn = reservationData.checkIn;
    const checkOut = reservationData.checkOut;
    if (!checkIn || !checkOut) return;
    
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const summary = document.getElementById('reservation-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="summary-row"><span>Huéspед:</span><span>${esc(document.getElementById('guest-name')?.value)}</span></div>
            <div class="summary-row"><span>Entrada:</span><span>${formatDate(checkIn)}</span></div>
            <div class="summary-row"><span>Salida:</span><span>${formatDate(checkOut)}</span></div>
            <div class="summary-row"><span>Noches:</span><span>${nights}</span></div>
        `;
    }
}

const totalAmountEl = document.getElementById('total-amount');
const initialPaymentEl = document.getElementById('initial-payment');

if (totalAmountEl) totalAmountEl.addEventListener('input', updateBalance);
if (initialPaymentEl) initialPaymentEl.addEventListener('input', updateBalance);

function updateBalance() {
    const total = parseFloat(document.getElementById('total-amount')?.value) || 0;
    const paid = parseFloat(document.getElementById('initial-payment')?.value) || 0;
    const balanceEl = document.getElementById('balance-due');
    if (balanceEl) balanceEl.textContent = formatCurrency(total - paid);
}

function toggleReceiptUpload() {
    const method = document.querySelector('input[name="payment-method"]:checked')?.value;
    const uploadGroup = document.getElementById('receipt-upload-group');
    const receiptInput = document.getElementById('payment-receipt');
    
    if (method === 'yappy' || method === 'card') {
        uploadGroup?.classList.remove('hidden');
        if (receiptInput) receiptInput.required = true;
    } else {
        uploadGroup?.classList.add('hidden');
        if (receiptInput) receiptInput.required = false;
    }
}

document.getElementById('payment-receipt')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('receipt-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Comprobante">`;
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('step3-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('create-reservation-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
    }

    try {
        const notesEl = document.getElementById('guest-notes');
        const totalAmount = parseFloat(document.getElementById('total-amount')?.value) || 0;
        const initialPayment = parseFloat(document.getElementById('initial-payment')?.value) || 0;
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
        const statusEl = document.getElementById('reservation-status');
        const status = statusEl?.value || 'confirmed';
        const receiptFile = document.getElementById('payment-receipt')?.files[0];
        const guestPhotoFile = document.getElementById('guest-photo')?.files[0];

        // Subir foto del huésped si existe
        let guestPhotoUrl = null;
        if (guestPhotoFile) {
            const fileName = `guests/${Date.now()}_${guestPhotoFile.name}`;
            const { error: photoError } = await db.storage.from('receipts').upload(fileName, guestPhotoFile);
            if (!photoError) {
                const { data: { publicUrl } } = db.storage.from('receipts').getPublicUrl(fileName);
                guestPhotoUrl = publicUrl;
            }
        }

        // Guardar huésped (campos simplificados)
        const [{ data: guest, error: guestError }, receiptUrl] = await Promise.all([
            db.from('guests').insert([{
                full_name: document.getElementById('guest-name')?.value,
                email: document.getElementById('guest-email')?.value || null,
                nationality: document.getElementById('guest-nationality')?.value || null,
                photo_url: guestPhotoUrl,
                notes: notesEl?.value || null
            }]).select().single(),

            receiptFile ? (async () => {
                const fileName = `receipts/${Date.now()}_${receiptFile.name}`;
                const { error: uploadError } = await db.storage.from('receipts').upload(fileName, receiptFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = db.storage.from('receipts').getPublicUrl(fileName);
                return publicUrl;
            })() : Promise.resolve(null)
        ]);

        if (guestError) throw guestError;

        // Guardar reserva
        const { data: reservation, error: resError } = await db.from('reservations').insert([{
            guest_id: guest.id,
            room_id: reservationData.roomId,
            bed_id: reservationData.bedId,
            check_in_date: reservationData.checkIn,
            check_out_date: reservationData.checkOut,
            total_amount: totalAmount,
            amount_paid: initialPayment,
            status: status === 'confirmed' ? 'confirmed' : 'pending',
            payment_status: initialPayment >= totalAmount ? 'paid' : (initialPayment > 0 ? 'partial' : 'pending'),
            source: 'walk_in',
            notes: notesEl?.value || null,
            created_by: currentUser.id
        }]).select().single();
        
        if (resError) throw resError;

        // Guardar pago si aplica
        if (initialPayment > 0) {
            const { error: payError } = await db.from('payments').insert([{
                reservation_id: reservation.id,
                amount: initialPayment,
                payment_method: paymentMethod,
                payment_type: initialPayment >= totalAmount ? 'full' : 'deposit',
                receipt_url: receiptUrl,
                notes: 'Pago inicial al crear reserva',
                created_by: currentUser.id
            }]);
            
            if (payError) throw payError;
            
            // Registrar en transacciones
            await db.from('transactions').insert([{
                type: 'income',
                category: 'reservation',
                amount: initialPayment,
                payment_method: paymentMethod,
                description: `Reserva: ${guest.full_name}`,
                reservation_id: reservation.id,
                shift_date: new Date().toISOString().split('T')[0],
                created_by: currentUser.id
            }]);
            
            // Actualizar caja si es efectivo
            if (paymentMethod === 'cash' && window.updateCashBalance) {
                await window.updateCashBalance(initialPayment, 'add');
            }
        }

        showToast('Reserva creada exitosamente', 'success');
        showReservations();

    } catch (error) {
        console.error('Error creating reservation:', error);
        showToast('Error al crear reserva: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Crear Reserva';
        }
    }
});

async function loadReservationsByDate() {
    const date = document.getElementById('reservations-date')?.value;
    const list = document.getElementById('reservations-list');
    if (!list) return;
    
    list.innerHTML = '<p>Cargando...</p>';
    
    try {
        const { data: reservations, error } = await db.from('reservations')
            .select('*, guest:guest_id(full_name), room:room_id(number, name), bed:bed_id(bed_number, room:room_id(number))')
            .or(`check_in_date.eq.${date},check_out_date.eq.${date}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reservations || reservations.length === 0) {
            list.innerHTML = '<p class="text-muted">No hay reservas para esta fecha</p>';
            return;
        }
        
        list.innerHTML = '';
        reservations.forEach(res => {
            const isCheckin = res.check_in_date === date;
            const location = res.bed ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}` : res.room?.name || 'N/A';
            const card = document.createElement('div');
            card.className = `reservation-card status-${res.status}`;
            card.onclick = () => showReservationDetail(res.id);
            card.innerHTML = `
                <div class="reservation-header">
                    <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                    <span class="badge" style="background: ${isCheckin ? '#d1fae5' : '#fee2e2'}; color: ${isCheckin ? '#065f46' : '#991b1b'}">${isCheckin ? 'CHECK-IN' : 'CHECK-OUT'}</span>
                </div>
                <div class="reservation-details">
                    <span>🛏️ ${esc(location)}</span>
                    <span>📅 ${formatDate(res.check_in_date)} - ${formatDate(res.check_out_date)}</span>
                </div>
                <div class="reservation-payment">
                    <span class="payment-badge payment-${res.payment_status}">${res.payment_status === 'paid' ? 'Pagado' : res.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}</span>
                    <span>${formatCurrency(res.total_amount)}</span>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading reservations:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar</p>';
    }
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    loadReservationsByDate();
}

async function showReservationDetail(reservationId) {
    try {
        const { data: res, error } = await db.from('reservations')
            .select('*, guest:guest_id(*), room:room_id(*), bed:bed_id(*, room:room_id(*)), payments(*)')
            .eq('id', reservationId)
            .single();
            
        if (error || !res) return;
        
        const location = res.bed ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}` : res.room?.name || 'N/A';
        const guestPhotoHtml = res.guest?.photo_url ? 
            `<div style="margin: 1rem 0;"><img src="${res.guest.photo_url}" style="max-width: 100%; border-radius: var(--radius); max-height: 200px; object-fit: cover;"></div>` : '';
        
        const content = document.getElementById('reservation-detail-content');
        if (content) {
            content.innerHTML = `
                <div class="detail-section">
                    <h4>Información General</h4>
                    ${guestPhotoHtml}
                    <div class="detail-row"><span class="detail-label">Huéspед</span><span class="detail-value">${esc(res.guest?.full_name)}</span></div>
                    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(res.guest?.email) || 'N/A'}</span></div>
                    <div class="detail-row"><span class="detail-label">Nacionalidad</span><span class="detail-value">${esc(res.guest?.nationality) || 'N/A'}</span></div>
                </div>
                <div class="detail-section">
                    <h4>Alojamiento</h4>
                    <div class="detail-row"><span class="detail-label">Ubicación</span><span class="detail-value">${esc(location)}</span></div>
                    <div class="detail-row"><span class="detail-label">Entrada</span><span class="detail-value">${formatDate(res.check_in_date)}</span></div>
                    <div class="detail-row"><span class="detail-label">Salida</span><span class="detail-value">${formatDate(res.check_out_date)}</span></div>
                </div>
                <div class="detail-section">
                    <h4>Pagos</h4>
                    <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${formatCurrency(res.total_amount)}</span></div>
                    <div class="detail-row"><span class="detail-label">Pagado</span><span class="detail-value">${formatCurrency(res.amount_paid)}</span></div>
                    <div class="detail-row"><span class="detail-label">Pendiente</span><span class="detail-value" style="color: ${res.balance_due > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(res.balance_due)}</span></div>
                    ${res.payments?.map(p => `<div class="detail-row" style="font-size:0.875rem;"><span class="detail-label">${formatDateTime(p.created_at)} - ${p.payment_method}</span><span class="detail-value">${formatCurrency(p.amount)}</span></div>`).join('') || ''}
                </div>
                ${res.notes ? `<div class="detail-section"><h4>Notas</h4><p style="font-size:0.875rem;color:var(--gray-600);">${esc(res.notes)}</p></div>` : ''}
            `;
        }
        
        const actions = document.getElementById('detail-actions');
        if (actions) {
            actions.innerHTML = '';
            
            if (res.status !== 'cancelled' && res.status !== 'checked_out') {
                actions.innerHTML += `<button onclick="openEditReservation('${res.id}')" class="btn btn-secondary">✏️ Editar</button>`;
            }
            
            if (res.status === 'confirmed') {
                actions.innerHTML += `<button onclick="doCheckIn('${res.id}')" class="btn btn-primary">Check-in</button>`;
            }
            
            if (res.status === 'checked_in') {
                actions.innerHTML += `<button onclick="doCheckOut('${res.id}')" class="btn btn-warning">Check-out</button>`;
                if (res.balance_due > 0) {
                    actions.innerHTML += `<button onclick="addPayment('${res.id}')" class="btn btn-success">Registrar pago</button>`;
                }
            }
            
            if (res.status !== 'cancelled' && res.status !== 'checked_out') {
                actions.innerHTML += `<button onclick="cancelReservation('${res.id}')" class="btn btn-danger">Cancelar</button>`;
            }
        }
        
        showPage('reservation-detail-page');
        
    } catch (error) {
        console.error('Error showing reservation detail:', error);
    }
}

async function openEditReservation(reservationId) {
    try {
        const { data: res, error } = await db.from('reservations')
            .select('*, guest:guest_id(*), room:room_id(*), bed:bed_id(*, room:room_id(*))')
            .eq('id', reservationId)
            .single();
            
        if (error || !res) {
            showToast('Error al cargar reserva', 'error');
            return;
        }
        
        document.getElementById('edit-res-id').value = res.id;
        document.getElementById('edit-checkin').value = res.check_in_date;
        document.getElementById('edit-checkout').value = res.check_out_date;
        document.getElementById('edit-total').value = res.total_amount;
        document.getElementById('edit-notes').value = res.notes || '';
        
        const select = document.getElementById('edit-room-bed');
        select.innerHTML = '<option value="">Cargando...</option>';
        
        const [{ data: rooms }, { data: beds }] = await Promise.all([
            db.from('rooms').select('*').order('number'),
            db.from('beds').select('*, room:room_id(number, name)').order('bed_number')
        ]);
        
        select.innerHTML = '';
        
        if (res.room_id) {
            const currentRoom = rooms.find(r => r.id === res.room_id);
            select.innerHTML += `<option value="room-${res.room_id}" selected>${currentRoom?.name || 'Habitación actual'} (actual)</option>`;
        } else if (res.bed_id) {
            const currentBed = beds.find(b => b.id === res.bed_id);
            select.innerHTML += `<option value="bed-${res.bed_id}" selected>Cama ${currentBed?.bed_number} - Hab ${currentBed?.room?.number} (actual)</option>`;
        }
        
        rooms.filter(r => r.type === 'private' && r.id !== res.room_id).forEach(room => {
            select.innerHTML += `<option value="room-${room.id}">${room.name} (Privada)</option>`;
        });
        
        beds.filter(b => b.id !== res.bed_id && b.status === 'available').forEach(bed => {
            select.innerHTML += `<option value="bed-${bed.id}">Cama ${bed.bed_number} - Hab ${bed.room?.number}</option>`;
        });
        
        showModal('edit-reservation-modal');
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Error al cargar', 'error');
    }
}

document.getElementById('edit-reservation-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('edit-res-id')?.value;
    const roomBedValue = document.getElementById('edit-room-bed')?.value;
    
    let updateData = {
        check_in_date: document.getElementById('edit-checkin')?.value,
        check_out_date: document.getElementById('edit-checkout')?.value,
        total_amount: parseFloat(document.getElementById('edit-total')?.value) || 0,
        notes: document.getElementById('edit-notes')?.value,
        updated_at: new Date().toISOString()
    };
    
    if (roomBedValue?.startsWith('room-')) {
        updateData.room_id = roomBedValue.replace('room-', '');
        updateData.bed_id = null;
    } else if (roomBedValue?.startsWith('bed-')) {
        updateData.bed_id = roomBedValue.replace('bed-', '');
        updateData.room_id = null;
    }
    
    try {
        const { error } = await db.from('reservations').update(updateData).eq('id', id);
        if (error) throw error;
        
        showToast('Reserva actualizada', 'success');
        closeEditModal();
        showReservations();
    } catch (err) {
        showToast('Error al actualizar: ' + err.message, 'error');
    }
});

async function doCheckIn(reservationId) {
    try {
        const { error } = await db.from('reservations').update({ status: 'checked_in' }).eq('id', reservationId);
        if (error) throw error;
        showToast('Check-in realizado', 'success');
        showReservations();
    } catch (error) {
        showToast('Error en check-in: ' + error.message, 'error');
    }
}

async function doCheckOut(reservationId) {
    try {
        const { error } = await db.from('reservations').update({ status: 'checked_out' }).eq('id', reservationId);
        if (error) throw error;
        showToast('Check-out realizado', 'success');
        showReservations();
    } catch (error) {
        showToast('Error en check-out: ' + error.message, 'error');
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva? Se revertirán los pagos en efectivo si los hubiera.')) return;
    
    try {
        const { data: res, error: fetchError } = await db.from('reservations')
            .select('*, guest:guest_id(full_name), payments(*)')
            .eq('id', reservationId)
            .single();
            
        if (fetchError) throw fetchError;
        
        const cashPayments = res.payments?.filter(p => p.payment_method === 'cash') || [];
        const totalCashRefund = cashPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        const { error } = await db.from('reservations')
            .update({ status: 'cancelled', deleted_at: new Date().toISOString() })
            .eq('id', reservationId);
            
        if (error) throw error;
        
        if (totalCashRefund > 0) {
            await db.from('transactions').insert([{
                type: 'expense',
                category: 'cancellation_refund',
                amount: totalCashRefund,
                payment_method: 'cash',
                description: `Reembolso cancelación: ${res.guest?.full_name}`,
                reservation_id: reservationId,
                shift_date: new Date().toISOString().split('T')[0],
                created_by: currentUser.id
            }]);
            
            if (window.updateCashBalance) {
                await window.updateCashBalance(totalCashRefund, 'subtract');
            }
        }
        
        showToast('Reserva cancelada', 'success');
        showReservations();
        
    } catch (error) {
        console.error('Error cancelling:', error);
        showToast('Error al cancelar: ' + error.message, 'error');
    }
}

window.resetReservationForm = resetReservationForm;
window.showDormitoryOptions = showDormitoryOptions;
window.showPrivateOptions = showPrivateOptions;
window.updateAvailability = updateAvailability;
window.goToStep = goToStep;
window.toggleReceiptUpload = toggleReceiptUpload;
window.loadReservationsByDate = loadReservationsByDate;
window.showTab = showTab;
window.showReservationDetail = showReservationDetail;
window.openEditReservation = openEditReservation;
window.doCheckIn = doCheckIn;
window.doCheckOut = doCheckOut;
window.cancelReservation = cancelReservation;
