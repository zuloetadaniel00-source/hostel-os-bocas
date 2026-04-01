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

function resetReservationForm() {
    reservationData = {
        roomId: null,
        bedId: null,
        checkIn: null,
        checkOut: null,
        guestId: null
    };
    document.getElementById('step1-form').reset();
    document.getElementById('step2-form').reset();
    document.getElementById('step3-form').reset();
    document.getElementById('total-amount').value = '0';
    document.getElementById('initial-payment').value = '0';
    document.getElementById('balance-due').textContent = '$0.00';
}

// STEP 1: Selección de alojamiento
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

async function loadDormitoryOptions() {
    const checkIn = document.getElementById('check-in-date').value;
    const checkOut = document.getElementById('check-out-date').value;
    
    if (!checkIn || !checkOut) return;
    
    const list = document.getElementById('dormitory-list');
    list.innerHTML = '<p>Cargando disponibilidad...</p>';
    
    // Obtener dormitorios
    const { data: rooms } = await supabase
        .from('rooms')
        .select('*, beds(*)')
        .eq('type', 'dormitory');
    
    // Obtener reservas en esas fechas
    const { data: reservations } = await supabase
        .from('reservations')
        .select('bed_id, status')
        .gte('check_in_date', checkIn)
        .lte('check_in_date', checkOut)
        .neq('status', 'cancelled')
        .neq('status', 'checked_out')
        .is('deleted_at', null);
    
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
            <span class="room-status ${isFull ? 'status-occupied' : 'status-available'}">
                ${isFull ? 'Lleno' : 'Disponible'}
            </span>
        `;
        
        if (!isFull) {
            div.onclick = () => selectDormitory(room, availableBeds, div);
        }
        
        list.appendChild(div);
    });
}

async function loadPrivateOptions() {
    const checkIn = document.getElementById('check-in-date').value;
    const checkOut = document.getElementById('check-out-date').value;
    
    if (!checkIn || !checkOut) return;
    
    const list = document.getElementById('private-list');
    list.innerHTML = '<p>Cargando disponibilidad...</p>';
    
    // Obtener reservas de habitaciones privadas en esas fechas
    const { data: reservations } = await supabase
        .from('reservations')
        .select('room_id, status')
        .gte('check_in_date', checkIn)
        .lte('check_in_date', checkOut)
        .neq('status', 'cancelled')
        .neq('status', 'checked_out')
        .is('deleted_at', null);
    
    const occupiedRooms = new Set(reservations?.map(r => r.room_id) || []);
    
    const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('type', 'private')
        .order('number');
    
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
            <span class="room-status ${isOccupied ? 'status-occupied' : 'status-available'}">
                ${isOccupied ? 'Ocupada' : 'Disponible'}
            </span>
        `;
        
        if (!isOccupied) {
            div.onclick = () => selectPrivateRoom(room, div);
        }
        
        list.appendChild(div);
    });
}

function selectDormitory(room, availableBeds, element) {
    // Limpiar selección previa
    document.querySelectorAll('#dormitory-list .room-option').forEach(el => {
        el.classList.remove('selected');
    });
    element.classList.add('selected');
    
    // Mostrar selección de cama específica
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
    document.querySelectorAll('#private-list .room-option').forEach(el => {
        el.classList.remove('selected');
    });
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
    if (step === 1) {
        document.getElementById('new-reservation-page').classList.remove('hidden');
    } else if (step === 2) {
        document.getElementById('new-reservation-step2').classList.remove('hidden');
    }
}

// STEP 2: Datos del huésped
document.getElementById('step2-form').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('new-reservation-step2').classList.add('hidden');
    document.getElementById('new-reservation-step3').classList.remove('hidden');
    updateReservationSummary();
});

// STEP 3: Pago
function updateReservationSummary() {
    const checkIn = reservationData.checkIn;
    const checkOut = reservationData.checkOut;
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    
    const summary = document.getElementById('reservation-summary');
    summary.innerHTML = `
        <div class="summary-row">
            <span>Huésped:</span>
            <span>${esc(document.getElementById('guest-name').value)}</span>
        </div>
        <div class="summary-row">
            <span>Entrada:</span>
            <span>${formatDate(checkIn)}</span>
        </div>
        <div class="summary-row">
            <span>Salida:</span>
            <span>${formatDate(checkOut)}</span>
        </div>
        <div class="summary-row">
            <span>Noches:</span>
            <span>${nights}</span>
        </div>
    `;
}

// Calcular balance pendiente
document.getElementById('total-amount').addEventListener('input', updateBalance);
document.getElementById('initial-payment').addEventListener('input', updateBalance);

function updateBalance() {
    const total = parseFloat(document.getElementById('total-amount').value) || 0;
    const paid = parseFloat(document.getElementById('initial-payment').value) || 0;
    const balance = total - paid;
    document.getElementById('balance-due').textContent = formatCurrency(balance);
}

function toggleReceiptUpload() {
    const method = document.querySelector('input[name="payment-method"]:checked').value;
    const uploadGroup = document.getElementById('receipt-upload-group');
    const receiptInput = document.getElementById('payment-receipt');
    
    if (method === 'yappy' || method === 'card') {
        uploadGroup.classList.remove('hidden');
        receiptInput.required = true;
    } else {
        uploadGroup.classList.add('hidden');
        receiptInput.required = false;
    }
}

// Preview de comprobante
document.getElementById('payment-receipt').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('receipt-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Comprobante">`;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Crear reserva final
document.getElementById('step3-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('create-reservation-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    try {
        // 1. Crear huésped
        const { data: guest, error: guestError } = await supabase
            .from('guests')
            .insert([{
                full_name: document.getElementById('guest-name').value,
                email: document.getElementById('guest-email').value,
                phone: document.getElementById('guest-phone').value,
                nationality: document.getElementById('guest-nationality').value,
                document_type: document.getElementById('guest-doc-type').value,
                document_id: document.getElementById('guest-doc-id').value,
                notes: document.getElementById('guest-notes').value
            }])
            .select()
            .single();
        
        if (guestError) throw guestError;
        
        // 2. Subir comprobante si existe
        let receiptUrl = null;
        const receiptFile = document.getElementById('payment-receipt').files[0];
        if (receiptFile) {
            const fileName = `${Date.now()}_${receiptFile.name}`;
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('receipts')
                .upload(fileName, receiptFile);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase
                .storage
                .from('receipts')
                .getPublicUrl(fileName);
            
            receiptUrl = publicUrl;
        }
        
        // 3. Crear reserva
        const totalAmount = parseFloat(document.getElementById('total-amount').value) || 0;
        const initialPayment = parseFloat(document.getElementById('initial-payment').value) || 0;
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
        const status = document.getElementById('reservation-status').value;
        
        const reservationInsert = {
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
            notes: document.getElementById('reservation-notes').value,
            created_by: currentUser.id
        };
        
        const { data: reservation, error: resError } = await supabase
            .from('reservations')
            .insert([reservationInsert])
            .select()
            .single();
        
        if (resError) throw resError;
        
        // 4. Registrar pago inicial si hay
        if (initialPayment > 0) {
            const { error: payError } = await supabase
                .from('payments')
                .insert([{
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

// Lista de reservas por fecha
async function loadReservationsByDate() {
    const date = document.getElementById('reservations-date').value;
    const list = document.getElementById('reservations-list');
    list.innerHTML = '<p>Cargando...</p>';
    
    const { data: reservations } = await supabase
        .from('reservations')
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
        const isCheckout = res.check_out_date === date;
        
        const location = res.bed 
            ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}`
            : res.room?.name || 'N/A';
        
        const card = document.createElement('div');
        card.className = `reservation-card status-${res.status}`;
        card.onclick = () => showReservationDetail(res.id);
        card.innerHTML = `
            <div class="reservation-header">
                <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                <span class="badge" style="background: ${isCheckin ? '#d1fae5' : '#fee2e2'}; color: ${isCheckin ? '#065f46' : '#991b1b'}">
                    ${isCheckin ? 'CHECK-IN' : 'CHECK-OUT'}
                </span>
            </div>
            <div class="reservation-details">
                <span>🛏️ ${esc(location)}</span>
                <span>📅 ${formatDate(res.check_in_date)} - ${formatDate(res.check_out_date)}</span>
            </div>
            <div class="reservation-payment">
                <span class="payment-badge payment-${res.payment_status}">
                    ${res.payment_status === 'paid' ? 'Pagado' : res.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                </span>
                <span>${formatCurrency(res.total_amount)}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    // Aquí filtrarías la lista según el tab
    loadReservationsByDate();
}

// Detalle de reserva
async function showReservationDetail(reservationId) {
    const { data: res } = await supabase
        .from('reservations')
        .select('*, guest:guest_id(*), room:room_id(*), bed:bed_id(*, room:room_id(*)), payments(*)')
        .eq('id', reservationId)
        .single();
    
    if (!res) return;
    
    const location = res.bed 
        ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}`
        : res.room?.name || 'N/A';
    
    const content = document.getElementById('reservation-detail-content');
    content.innerHTML = `
        <div class="detail-section">
            <h4>Información General</h4>
            <div class="detail-row">
                <span class="detail-label">Huésped</span>
                <span class="detail-value">${esc(res.guest?.full_name)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email</span>
                <span class="detail-value">${esc(res.guest?.email)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Teléfono</span>
                <span class="detail-value">${esc(res.guest?.phone)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Documento</span>
                <span class="detail-value">${esc(res.guest?.document_type)}: ${esc(res.guest?.document_id)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Alojamiento</h4>
            <div class="detail-row">
                <span class="detail-label">Ubicación</span>
                <span class="detail-value">${esc(location)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Entrada</span>
                <span class="detail-value">${formatDate(res.check_in_date)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Salida</span>
                <span class="detail-value">${formatDate(res.check_out_date)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Pagos</h4>
            <div class="detail-row">
                <span class="detail-label">Total</span>
                <span class="detail-value">${formatCurrency(res.total_amount)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pagado</span>
                <span class="detail-value">${formatCurrency(res.amount_paid)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pendiente</span>
                <span class="detail-value" style="color: ${res.balance_due > 0 ? 'var(--danger)' : 'var(--success)'}">
                    ${formatCurrency(res.balance_due)}
                </span>
            </div>
            ${res.payments?.map(p => `
                <div class="detail-row" style="font-size: 0.875rem;">
                    <span class="detail-label">${formatDateTime(p.created_at)} - ${p.payment_method}</span>
                    <span class="detail-value">${formatCurrency(p.amount)}</span>
                </div>
            `).join('') || ''}
        </div>
        
        ${res.notes ? `
        <div class="detail-section">
            <h4>Notas</h4>
            <p style="font-size: 0.875rem; color: var(--gray-600);">${esc(res.notes)}</p>
        </div>
        ` : ''}
    `;
    
    // Acciones disponibles
    const actions = document.getElementById('detail-actions');
    actions.innerHTML = '';
    
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
    
    showPage('reservation-detail-page');
}

async function doCheckIn(reservationId) {
    const { error } = await supabase
        .from('reservations')
        .update({ status: 'checked_in' })
        .eq('id', reservationId);
    
    if (error) {
        showToast('Error en check-in: ' + error.message, 'error');
    } else {
        showToast('Check-in realizado', 'success');
        showReservations();
    }
}

async function doCheckOut(reservationId) {
    const { error } = await supabase
        .from('reservations')
        .update({ status: 'checked_out' })
        .eq('id', reservationId);
    
    if (error) {
        showToast('Error en check-out: ' + error.message, 'error');
    } else {
        showToast('Check-out realizado - Tarea de limpieza creada', 'success');
        showReservations();
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    
    const { error } = await supabase
        .from('reservations')
        .update({ 
            status: 'cancelled',
            deleted_at: new Date().toISOString()
        })
        .eq('id', reservationId);
    
    if (error) {
        showToast('Error al cancelar: ' + error.message, 'error');
    } else {
        showToast('Reserva cancelada', 'success');
        showReservations();
    }
}
