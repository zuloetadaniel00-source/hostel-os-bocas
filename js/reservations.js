// =====================================================
// RESERVAS - Crear y gestionar
// =====================================================

let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
};
let editingReservationId = null;

function resetReservationForm() {
    reservationData = { roomId: null, bedId: null, checkIn: null, checkOut: null, guestId: null };
    document.getElementById('step1-form').reset();
    document.getElementById('step2-form').reset();
    document.getElementById('step3-form').reset();
    document.getElementById('total-amount').value = '0';
    document.getElementById('initial-payment').value = '0';
    document.getElementById('balance-due').textContent = '$0.00';
    document.getElementById('guest-photo-preview').classList.add('hidden');
    document.getElementById('receipt-preview').classList.add('hidden');
}

function previewGuestPhoto(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('guest-photo-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Foto huésped">`;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function previewReceipt(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('receipt-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Comprobante">`;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function showDormitoryOptions() {
    document.getElementById('dormitory-options').classList.remove('hidden');
    document.getElementById('private-options').classList.add('hidden');
    loadDormitoryOptions();
}

function showPrivateOptions() {
    document.getElementById('dormitory-options').classList.add('hidden');
    document.getElementById('private-options').classList.remove('hidden');
    loadPrivateOptions();
}

function updateAvailability() {
    const type = document.querySelector('input[name="accommodation-type"]:checked')?.value;
    if (type === 'dormitory') loadDormitoryOptions();
    else if (type === 'private') loadPrivateOptions();
}

async function loadDormitoryOptions() {
    const checkIn = document.getElementById('check-in-date').value;
    const checkOut = document.getElementById('check-out-date').value;
    if (!checkIn || !checkOut) return;
    const list = document.getElementById('dormitory-list');
    list.innerHTML = '<p>Cargando disponibilidad...</p>';

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
    rooms.forEach(room => {
        const availableBeds = room.beds.filter(b => !occupiedBeds.has(b.id) && b.status === 'available');
        const isFull = availableBeds.length === 0;
        const div = document.createElement('div');
        div.className = `room-option ${isFull ? 'disabled' : ''}`;
        div.innerHTML = `
            <div class="room-info">
                <h4>${esc(room.name)}</h4>
                <p>${availableBeds.length} de ${room.beds.length} camas disponibles</p>
            </div>
            <span class="room-status ${isFull ? 'status-occupied' : 'status-available'}">${isFull ? 'Lleno' : 'Disponible'}</span>
        `;
        if (!isFull) div.onclick = () => selectDormitory(room, availableBeds, div);
        list.appendChild(div);
    });
}

async function loadPrivateOptions() {
    const checkIn = document.getElementById('check-in-date').value;
    const checkOut = document.getElementById('check-out-date').value;
    if (!checkIn || !checkOut) return;
    const list = document.getElementById('private-list');
    list.innerHTML = '<p>Cargando disponibilidad...</p>';

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
    rooms.forEach(room => {
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
                document.getElementById('step1-continue').disabled = false;
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
    document.getElementById('step1-continue').disabled = false;
}

document.getElementById('step1-form').addEventListener('submit', (e) => {
    e.preventDefault();
    reservationData.checkIn = document.getElementById('check-in-date').value;
    reservationData.checkOut = document.getElementById('check-out-date').value;
    if (!reservationData.roomId && !reservationData.bedId) {
        showToast('Selecciona una habitación o cama', 'error');
        return;
    }
    document.getElementById('new-reservation-page').classList.add('hidden');
    document.getElementById('new-reservation-step2').classList.remove('hidden');
});

function goToStep(step) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    if (step === 1) document.getElementById('new-reservation-page').classList.remove('hidden');
    else if (step === 2) document.getElementById('new-reservation-step2').classList.remove('hidden');
}

document.getElementById('step2-form').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('new-reservation-step2').classList.add('hidden');
    document.getElementById('new-reservation-step3').classList.remove('hidden');
    updateReservationSummary();
});

function updateReservationSummary() {
    const checkIn = reservationData.checkIn;
    const checkOut = reservationData.checkOut;
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    document.getElementById('reservation-summary').innerHTML = `
        <div class="summary-row"><span>Huésped:</span><span>${esc(document.getElementById('guest-name').value)}</span></div>
        <div class="summary-row"><span>Entrada:</span><span>${formatDate(checkIn)}</span></div>
        <div class="summary-row"><span>Salida:</span><span>${formatDate(checkOut)}</span></div>
        <div class="summary-row"><span>Noches:</span><span>${nights}</span></div>
    `;
}

document.getElementById('total-amount').addEventListener('input', updateBalance);
document.getElementById('initial-payment').addEventListener('input', updateBalance);

function updateBalance() {
    const total = parseFloat(document.getElementById('total-amount').value) || 0;
    const paid = parseFloat(document.getElementById('initial-payment').value) || 0;
    document.getElementById('balance-due').textContent = formatCurrency(total - paid);
}

function toggleReceiptUpload() {
    const method = document.querySelector('input[name="payment-method"]:checked').value;
    const uploadGroup = document.getElementById('receipt-upload-group');
    if (method === 'yappy' || method === 'card') {
        uploadGroup.classList.remove('hidden');
    } else {
        uploadGroup.classList.add('hidden');
    }
}

document.getElementById('step3-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('create-reservation-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const notesEl = document.getElementById('guest-notes');
        const totalAmount = parseFloat(document.getElementById('total-amount').value) || 0;
        const initialPayment = parseFloat(document.getElementById('initial-payment').value) || 0;
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
        const statusEl = document.getElementById('reservation-status');
        const status = statusEl ? statusEl.value : 'confirmed';

        // Obtener archivo de comprobante (file o camera)
        const receiptFile = document.getElementById('payment-receipt-file').files[0]
            || document.getElementById('payment-receipt-camera').files[0];

        // Guardar huésped y subir comprobante en paralelo
        const [{ data: guest, error: guestError }, receiptUrl] = await Promise.all([
            db.from('guests').insert([{
                full_name: document.getElementById('guest-name').value,
                email: document.getElementById('guest-email').value || null,
                nationality: document.getElementById('guest-nationality').value || null,
                notes: notesEl ? notesEl.value : null
            }]).select().single(),

            receiptFile ? (async () => {
                const fileName = `${Date.now()}_${receiptFile.name}`;
                const { error: uploadError } = await db.storage.from('receipts').upload(fileName, receiptFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = db.storage.from('receipts').getPublicUrl(fileName);
                return publicUrl;
            })() : Promise.resolve(null)
        ]);

        if (guestError) throw guestError;

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
            created_by: currentUser.id
        }]).select().single();
        if (resError) throw resError;

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
        }

        showToast('Reserva creada exitosamente', 'success');
        showReservations();

    } catch (error) {
        console.error('Error creating reservation:', error);
        showToast('Error al crear reserva: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✓ Crear Reserva';
    }
});

async function loadReservationsByDate() {
    const date = document.getElementById('reservations-date').value;
    const list = document.getElementById('reservations-list');
    list.innerHTML = '<p>Cargando...</p>';

    const { data: reservations } = await db.from('reservations')
        .select('*, guest:guest_id(full_name), room:room_id(number, name), bed:bed_id(bed_number, room:room_id(number))')
        .or(`check_in_date.eq.${date},check_out_date.eq.${date}`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

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
        card.innerHTML = `
            <div class="reservation-header" onclick="showReservationDetail('${res.id}')">
                <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                <span class="badge" style="background: ${isCheckin ? '#d1fae5' : '#fee2e2'}; color: ${isCheckin ? '#065f46' : '#991b1b'}">${isCheckin ? 'CHECK-IN' : 'CHECK-OUT'}</span>
            </div>
            <div class="reservation-details" onclick="showReservationDetail('${res.id}')">
                <span>🛏️ ${esc(location)}</span>
                <span>📅 ${formatDate(res.check_in_date)} → ${formatDate(res.check_out_date)}</span>
            </div>
            <div class="reservation-payment">
                <span class="payment-badge payment-${res.payment_status}">${res.payment_status === 'paid' ? 'Pagado' : res.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}</span>
                <span>${formatCurrency(res.total_amount)}</span>
            </div>
            <div class="reservation-card-actions">
                <button onclick="showReservationDetail('${res.id}')" class="btn btn-secondary btn-small">Ver detalle</button>
                ${res.status !== 'cancelled' && res.status !== 'checked_out' ? `
                    <button onclick="openEditReservation('${res.id}')" class="btn btn-primary btn-small">✏️ Editar</button>
                    <button onclick="cancelReservation('${res.id}')" class="btn btn-danger btn-small">✕ Cancelar</button>
                ` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    loadReservationsByDate();
}

async function showReservationDetail(reservationId) {
    const { data: res } = await db.from('reservations')
        .select('*, guest:guest_id(*), room:room_id(*), bed:bed_id(*, room:room_id(*)), payments(*)')
        .eq('id', reservationId)
        .single();
    if (!res) return;
    const location = res.bed ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}` : res.room?.name || 'N/A';
    document.getElementById('reservation-detail-content').innerHTML = `
        <div class="detail-section">
            <h4>Información General</h4>
            <div class="detail-row"><span class="detail-label">Huésped</span><span class="detail-value">${esc(res.guest?.full_name)}</span></div>
            <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(res.guest?.email) || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Nacionalidad</span><span class="detail-value">${esc(res.guest?.nationality) || '—'}</span></div>
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
            ${res.payments?.map(p => `
                <div class="detail-row" style="font-size:0.875rem;">
                    <span class="detail-label">${formatDateTime(p.created_at)} — ${p.payment_method}</span>
                    <span class="detail-value">${formatCurrency(p.amount)}</span>
                </div>`).join('') || ''}
        </div>
        ${res.notes ? `<div class="detail-section"><h4>Notas</h4><p style="font-size:0.875rem;color:var(--gray-600);">${esc(res.notes)}</p></div>` : ''}
    `;
    const actions = document.getElementById('detail-actions');
    actions.innerHTML = '';
    if (res.status === 'confirmed') actions.innerHTML += `<button onclick="doCheckIn('${res.id}')" class="btn btn-primary">Check-in</button>`;
    if (res.status === 'checked_in') {
        actions.innerHTML += `<button onclick="doCheckOut('${res.id}')" class="btn btn-warning">Check-out</button>`;
        if (res.balance_due > 0) actions.innerHTML += `<button onclick="addPayment('${res.id}')" class="btn btn-success">Registrar pago</button>`;
    }
    if (res.status !== 'cancelled' && res.status !== 'checked_out') {
        actions.innerHTML += `<button onclick="openEditReservation('${res.id}')" class="btn btn-secondary">✏️ Editar</button>`;
        actions.innerHTML += `<button onclick="cancelReservation('${res.id}')" class="btn btn-danger">Cancelar</button>`;
    }
    showPage('reservation-detail-page');
}

async function openEditReservation(reservationId) {
    editingReservationId = reservationId;
    const { data: res } = await db.from('reservations').select('*').eq('id', reservationId).single();
    if (!res) return;
    document.getElementById('edit-check-in').value = res.check_in_date;
    document.getElementById('edit-check-out').value = res.check_out_date;
    document.getElementById('edit-total-amount').value = res.total_amount;
    document.getElementById('edit-notes').value = res.notes || '';
    showPage('edit-reservation-page');
}

document.getElementById('edit-reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingReservationId) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const { error } = await db.from('reservations').update({
        check_in_date: document.getElementById('edit-check-in').value,
        check_out_date: document.getElementById('edit-check-out').value,
        total_amount: parseFloat(document.getElementById('edit-total-amount').value),
        notes: document.getElementById('edit-notes').value
    }).eq('id', editingReservationId);

    btn.disabled = false;
    btn.textContent = 'Guardar cambios';

    if (error) {
        showToast('Error al editar: ' + error.message, 'error');
    } else {
        showToast('Reserva actualizada', 'success');
        showReservationDetail(editingReservationId);
    }
});

async function doCheckIn(reservationId) {
    const { error } = await db.from('reservations').update({ status: 'checked_in' }).eq('id', reservationId);
    if (error) showToast('Error en check-in: ' + error.message, 'error');
    else { showToast('Check-in realizado', 'success'); showReservations(); }
}

async function doCheckOut(reservationId) {
    const { error } = await db.from('reservations').update({ status: 'checked_out' }).eq('id', reservationId);
    if (error) showToast('Error en check-out: ' + error.message, 'error');
    else { showToast('Check-out realizado', 'success'); showReservations(); }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    const { error } = await db.from('reservations').update({ status: 'cancelled', deleted_at: new Date().toISOString() }).eq('id', reservationId);
    if (error) showToast('Error al cancelar: ' + error.message, 'error');
    else { showToast('Reserva cancelada', 'success'); showReservations(); }
}
