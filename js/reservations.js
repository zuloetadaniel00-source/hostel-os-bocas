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

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function resetReservationForm() {
    reservationData = { roomId: null, bedId: null, checkIn: null, checkOut: null, guestId: null };
    
    // Resetear formularios
    const step1 = document.getElementById('step1-form');
    const step2 = document.getElementById('step2-form');
    const step3 = document.getElementById('step3-form');
    
    if (step1) step1.reset();
    if (step2) step2.reset();
    if (step3) step3.reset();
    
    // Resetear campos específicos
    const totalAmount = document.getElementById('total-amount');
    const initialPayment = document.getElementById('initial-payment');
    const balanceDue = document.getElementById('balance-due');
    const dormitoryOptions = document.getElementById('dormitory-options');
    const privateOptions = document.getElementById('private-options');
    const step1Continue = document.getElementById('step1-continue');
    const receiptPreview = document.getElementById('receipt-preview');
    
    if (totalAmount) totalAmount.value = '0';
    if (initialPayment) initialPayment.value = '0';
    if (balanceDue) balanceDue.textContent = '$0.00';
    if (dormitoryOptions) dormitoryOptions.classList.add('hidden');
    if (privateOptions) privateOptions.classList.add('hidden');
    if (step1Continue) step1Continue.disabled = true;
    if (receiptPreview) {
        receiptPreview.innerHTML = '';
        receiptPreview.classList.add('hidden');
    }
    
    // Limpiar listas
    const dormitoryList = document.getElementById('dormitory-list');
    const privateList = document.getElementById('private-list');
    if (dormitoryList) dormitoryList.innerHTML = '';
    if (privateList) privateList.innerHTML = '';
}

function showNewReservation() {
    resetReservationForm();
    showPage('new-reservation-page');
}

function goBack() {
    showReservations();
}

function updateAvailability() {
    const type = document.querySelector('input[name="accommodation-type"]:checked')?.value;
    if (type === 'dormitory') {
        loadDormitoryOptions();
    } else if (type === 'private') {
        loadPrivateOptions();
    }
}

// =====================================================
// PASO 1: SELECCIÓN DE ALOJAMIENTO
// =====================================================

function showDormitoryOptions() {
    const dormitoryOptions = document.getElementById('dormitory-options');
    const privateOptions = document.getElementById('private-options');
    
    if (dormitoryOptions) dormitoryOptions.classList.remove('hidden');
    if (privateOptions) privateOptions.classList.add('hidden');
    
    loadDormitoryOptions();
}

function showPrivateOptions() {
    const dormitoryOptions = document.getElementById('dormitory-options');
    const privateOptions = document.getElementById('private-options');
    
    if (dormitoryOptions) dormitoryOptions.classList.add('hidden');
    if (privateOptions) privateOptions.classList.remove('hidden');
    
    loadPrivateOptions();
}

async function loadDormitoryOptions() {
    const checkInInput = document.getElementById('check-in-date');
    const checkOutInput = document.getElementById('check-out-date');
    const list = document.getElementById('dormitory-list');
    
    const checkIn = checkInInput?.value;
    const checkOut = checkOutInput?.value;

    if (!checkIn || !checkOut) {
        if (list) list.innerHTML = '<p>Selecciona fechas primero</p>';
        return;
    }

    if (list) list.innerHTML = '<p>Cargando disponibilidad...</p>';

    try {
        // 🔹 OBTENER DORMITORIOS CON SUS CAMAS
        const { data: rooms, error: roomError } = await supabase
            .from('rooms')
            .select('*, beds(*)')
            .eq('type', 'dormitory');

        if (roomError) {
            console.error('Error rooms:', roomError);
            if (list) list.innerHTML = '<p>Error cargando habitaciones</p>';
            return;
        }

        // 🔹 OBTENER RESERVAS QUE SE SOLAPAN CON EL RANGO (CORREGIDO)
        const { data: reservations, error: resError } = await supabase
            .from('reservations')
            .select('bed_id, check_in_date, check_out_date, status')
            .lte('check_in_date', checkOut)
            .gte('check_out_date', checkIn)
            .neq('status', 'cancelled')
            .neq('status', 'checked_out')
            .is('deleted_at', null);

        if (resError) {
            console.error('Error reservations:', resError);
        }

        console.log('ROOMS:', rooms);
        console.log('RESERVATIONS:', reservations);

        const occupiedBeds = new Set(reservations?.map(r => r.bed_id).filter(id => id !== null) || []);

        if (list) list.innerHTML = '';

        if (!rooms || rooms.length === 0) {
            if (list) list.innerHTML = '<p>No hay dormitorios configurados</p>';
            return;
        }

        rooms.forEach(room => {
            const roomBeds = room.beds || [];
            const availableBeds = roomBeds.filter(
                b => !occupiedBeds.has(b.id) && b.status === 'available'
            );

            const isFull = availableBeds.length === 0;

            const div = document.createElement('div');
            div.className = `room-option ${isFull ? 'disabled' : ''}`;

            div.innerHTML = `
                <div class="room-info">
                    <h4>${esc(room.name)}</h4>
                    <p>${availableBeds.length} de ${roomBeds.length} camas disponibles</p>
                </div>
                <span class="room-status ${isFull ? 'status-occupied' : 'status-available'}">
                    ${isFull ? 'Lleno' : 'Disponible'}
                </span>
            `;

            if (!isFull) {
                div.onclick = () => selectDormitory(room, availableBeds, div);
            }

            if (list) list.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error en loadDormitoryOptions:', error);
        if (list) list.innerHTML = '<p>Error inesperado</p>';
    }
}

async function loadPrivateOptions() {
    const checkInInput = document.getElementById('check-in-date');
    const checkOutInput = document.getElementById('check-out-date');
    const list = document.getElementById('private-list');
    
    const checkIn = checkInInput?.value;
    const checkOut = checkOutInput?.value;

    if (!checkIn || !checkOut) {
        if (list) list.innerHTML = '<p>Selecciona fechas primero</p>';
        return;
    }

    if (list) list.innerHTML = '<p>Cargando disponibilidad...</p>';

    try {
        // 🔹 OBTENER RESERVAS QUE SE SOLAPAN (CORREGIDO)
        const { data: reservations, error: resError } = await supabase
            .from('reservations')
            .select('room_id, check_in_date, check_out_date, status')
            .lte('check_in_date', checkOut)
            .gte('check_out_date', checkIn)
            .neq('status', 'cancelled')
            .neq('status', 'checked_out')
            .is('deleted_at', null);

        if (resError) {
            console.error('Error reservations:', resError);
        }

        const occupiedRooms = new Set(reservations?.map(r => r.room_id).filter(id => id !== null) || []);

        // 🔹 OBTENER HABITACIONES PRIVADAS
        const { data: rooms, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('type', 'private')
            .order('number');

        if (roomError) {
            console.error('Error rooms:', roomError);
            if (list) list.innerHTML = '<p>Error cargando habitaciones</p>';
            return;
        }

        console.log('PRIVATE ROOMS:', rooms);
        console.log('OCCUPIED:', occupiedRooms);

        if (list) list.innerHTML = '';

        if (!rooms || rooms.length === 0) {
            if (list) list.innerHTML = '<p>No hay habitaciones privadas configuradas</p>';
            return;
        }

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

            if (list) list.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error en loadPrivateOptions:', error);
        if (list) list.innerHTML = '<p>Error inesperado</p>';
    }
}

function selectDormitory(room, availableBeds, element) {
    // Limpiar selección previa
    document.querySelectorAll('#dormitory-list .room-option').forEach(el => {
        el.classList.remove('selected');
        // Remover selección de camas previas
        const prevBedSelection = el.querySelector('.bed-selection');
        if (prevBedSelection) prevBedSelection.remove();
    });
    
    element.classList.add('selected');
    
    // Verificar si ya existe selección de camas
    let bedSelection = element.querySelector('.bed-selection');
    if (!bedSelection) {
        bedSelection = document.createElement('div');
        bedSelection.className = 'bed-selection';
        bedSelection.style.marginTop = '1rem';
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
                
                const step1Continue = document.getElementById('step1-continue');
                if (step1Continue) step1Continue.disabled = false;
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
    
    const step1Continue = document.getElementById('step1-continue');
    if (step1Continue) step1Continue.disabled = false;
}

// =====================================================
// EVENT LISTENERS - PASO 1
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    const step1Form = document.getElementById('step1-form');
    if (step1Form) {
        step1Form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const checkInInput = document.getElementById('check-in-date');
            const checkOutInput = document.getElementById('check-out-date');
            
            reservationData.checkIn = checkInInput?.value;
            reservationData.checkOut = checkOutInput?.value;

            if (!reservationData.roomId && !reservationData.bedId) {
                showToast('Selecciona una habitación o cama', 'error');
                return;
            }

            const newReservationPage = document.getElementById('new-reservation-page');
            const step2Page = document.getElementById('new-reservation-step2');
            
            if (newReservationPage) newReservationPage.classList.add('hidden');
            if (step2Page) step2Page.classList.remove('hidden');
        });
    }
});

function goToStep(step) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    
    if (step === 1) {
        const page = document.getElementById('new-reservation-page');
        if (page) page.classList.remove('hidden');
    } else if (step === 2) {
        const page = document.getElementById('new-reservation-step2');
        if (page) page.classList.remove('hidden');
    }
}

// =====================================================
// PASO 2: DATOS DEL HUÉSPED
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    const step2Form = document.getElementById('step2-form');
    if (step2Form) {
        step2Form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const step2Page = document.getElementById('new-reservation-step2');
            const step3Page = document.getElementById('new-reservation-step3');
            
            if (step2Page) step2Page.classList.add('hidden');
            if (step3Page) step3Page.classList.remove('hidden');
            
            updateReservationSummary();
        });
    }
});

function updateReservationSummary() {
    const checkIn = reservationData.checkIn;
    const checkOut = reservationData.checkOut;
    
    if (!checkIn || !checkOut) return;
    
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const guestName = document.getElementById('guest-name')?.value || 'Sin nombre';
    
    const summary = document.getElementById('reservation-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="summary-row"><span>Huésped:</span><span>${esc(guestName)}</span></div>
            <div class="summary-row"><span>Entrada:</span><span>${formatDate(checkIn)}</span></div>
            <div class="summary-row"><span>Salida:</span><span>${formatDate(checkOut)}</span></div>
            <div class="summary-row"><span>Noches:</span><span>${nights}</span></div>
        `;
    }
}

// =====================================================
// PASO 3: PAGO Y CONFIRMACIÓN
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    const totalAmount = document.getElementById('total-amount');
    const initialPayment = document.getElementById('initial-payment');
    
    if (totalAmount) totalAmount.addEventListener('input', updateBalance);
    if (initialPayment) initialPayment.addEventListener('input', updateBalance);
    
    const paymentReceipt = document.getElementById('payment-receipt');
    if (paymentReceipt) {
        paymentReceipt.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('receipt-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${e.target.result}" alt="Comprobante" style="max-width: 100%; border-radius: 8px;">`;
                        preview.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    const step3Form = document.getElementById('step3-form');
    if (step3Form) {
        step3Form.addEventListener('submit', handleCreateReservation);
    }
});

function updateBalance() {
    const totalInput = document.getElementById('total-amount');
    const paidInput = document.getElementById('initial-payment');
    const balanceDisplay = document.getElementById('balance-due');
    
    const total = parseFloat(totalInput?.value) || 0;
    const paid = parseFloat(paidInput?.value) || 0;
    
    if (balanceDisplay) {
        balanceDisplay.textContent = formatCurrency(total - paid);
    }
}

function toggleReceiptUpload() {
    const methodRadio = document.querySelector('input[name="payment-method"]:checked');
    const uploadGroup = document.getElementById('receipt-upload-group');
    const receiptInput = document.getElementById('payment-receipt');
    
    if (!methodRadio || !uploadGroup) return;
    
    const method = methodRadio.value;
    
    if (method === 'yappy' || method === 'card' || method === 'transfer') {
        uploadGroup.classList.remove('hidden');
        if (receiptInput) receiptInput.required = true;
    } else {
        uploadGroup.classList.add('hidden');
        if (receiptInput) receiptInput.required = false;
    }
}

async function handleCreateReservation(e) {
    e.preventDefault();
    
    const btn = document.getElementById('create-reservation-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
    }
    
    try {
        // 1. CREAR HUÉSPED
        const guestData = {
            full_name: document.getElementById('guest-name')?.value,
            email: document.getElementById('guest-email')?.value,
            phone: document.getElementById('guest-phone')?.value,
            nationality: document.getElementById('guest-nationality')?.value,
            document_type: document.getElementById('guest-doc-type')?.value,
            document_id: document.getElementById('guest-doc-id')?.value,
            notes: document.getElementById('guest-notes')?.value
        };
        
        console.log('Creando huésped:', guestData);
        
        const { data: guest, error: guestError } = await supabase
            .from('guests')
            .insert([guestData])
            .select()
            .single();
        
        if (guestError) {
            console.error('Error creating guest:', guestError);
            throw new Error('Error al crear huésped: ' + guestError.message);
        }
        
        console.log('Huésped creado:', guest);

        // 2. SUBIR COMPROBANTE SI EXISTE
        let receiptUrl = null;
        const receiptFile = document.getElementById('payment-receipt')?.files[0];
        
        if (receiptFile) {
            console.log('Subiendo comprobante...');
            const fileName = `${Date.now()}_${receiptFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            
            const { error: uploadError } = await supabase
                .storage
                .from('receipts')
                .upload(fileName, receiptFile);
            
            if (uploadError) {
                console.error('Error uploading receipt:', uploadError);
                throw new Error('Error al subir comprobante: ' + uploadError.message);
            }
            
            const { data: { publicUrl } } = supabase
                .storage
                .from('receipts')
                .getPublicUrl(fileName);
            
            receiptUrl = publicUrl;
            console.log('Comprobante subido:', receiptUrl);
        }

        // 3. CREAR RESERVA
        const totalAmount = parseFloat(document.getElementById('total-amount')?.value) || 0;
        const initialPayment = parseFloat(document.getElementById('initial-payment')?.value) || 0;
        const paymentMethodEl = document.querySelector('input[name="payment-method"]:checked');
        const paymentMethod = paymentMethodEl?.value || 'cash';
        const status = document.getElementById('reservation-status')?.value || 'confirmed';
        
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
            notes: document.getElementById('reservation-notes')?.value || null,
            created_by: currentUser?.id
        };
        
        console.log('Creando reserva:', reservationInsert);
        
        const { data: reservation, error: resError } = await supabase
            .from('reservations')
            .insert([reservationInsert])
            .select()
            .single();
        
        if (resError) {
            console.error('Error creating reservation:', resError);
            throw new Error('Error al crear reserva: ' + resError.message);
        }
        
        console.log('Reserva creada:', reservation);

        // 4. REGISTRAR PAGO INICIAL SI HAY
        if (initialPayment > 0) {
            const paymentData = {
                reservation_id: reservation.id,
                amount: initialPayment,
                payment_method: paymentMethod,
                payment_type: initialPayment >= totalAmount ? 'full' : 'deposit',
                receipt_url: receiptUrl,
                notes: 'Pago inicial al crear reserva',
                created_by: currentUser?.id
            };
            
            console.log('Registrando pago:', paymentData);
            
            const { error: payError } = await supabase
                .from('payments')
                .insert([paymentData]);
            
            if (payError) {
                console.error('Error creating payment:', payError);
                // No lanzamos error aquí, la reserva ya está creada
                showToast('Reserva creada pero hubo error al registrar el pago', 'warning');
            }
        }

        showToast('✅ Reserva creada exitosamente', 'success');
        resetReservationForm();
        showReservations();
        
    } catch (error) {
        console.error('Error completo:', error);
        showToast('❌ Error: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Crear Reserva';
        }
    }
}

// =====================================================
// LISTA Y GESTIÓN DE RESERVAS
// =====================================================

async function loadReservationsByDate() {
    const dateInput = document.getElementById('reservations-date');
    const list = document.getElementById('reservations-list');
    
    const date = dateInput?.value;
    if (!date) return;
    
    if (list) list.innerHTML = '<p>Cargando...</p>';
    
    try {
        const { data: reservations, error } = await supabase
            .from('reservations')
            .select('*, guest:guest_id(full_name), room:room_id(number, name), bed:bed_id(bed_number, room:room_id(number))')
            .or(`check_in_date.eq.${date},check_out_date.eq.${date}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading reservations:', error);
            if (list) list.innerHTML = '<p>Error cargando reservas</p>';
            return;
        }

        if (!reservations || reservations.length === 0) {
            if (list) list.innerHTML = '<p class="text-muted">No hay reservas para esta fecha</p>';
            return;
        }
        
        if (list) list.innerHTML = '';
        
        reservations.forEach(res => {
            const isCheckin = res.check_in_date === date;
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
            if (list) list.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error:', error);
        if (list) list.innerHTML = '<p>Error inesperado</p>';
    }
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const tabBtn = document.getElementById(`tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');
    loadReservationsByDate();
}

async function showReservationDetail(reservationId) {
    try {
        const { data: res, error } = await supabase
            .from('reservations')
            .select('*, guest:guest_id(*), room:room_id(*), bed:bed_id(*, room:room_id(*)), payments(*)')
            .eq('id', reservationId)
            .single();
        
        if (error || !res) {
            showToast('Error cargando detalle', 'error');
            return;
        }

        const location = res.bed 
            ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}` 
            : res.room?.name || 'N/A';
        
        const content = document.getElementById('reservation-detail-content');
        if (content) {
            content.innerHTML = `
                <div class="detail-section">
                    <h4>Información General</h4>
                    <div class="detail-row"><span class="detail-label">Huésped</span><span class="detail-value">${esc(res.guest?.full_name)}</span></div>
                    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(res.guest?.email || 'N/A')}</span></div>
                    <div class="detail-row"><span class="detail-label">Teléfono</span><span class="detail-value">${esc(res.guest?.phone || 'N/A')}</span></div>
                    <div class="detail-row"><span class="detail-label">Documento</span><span class="detail-value">${esc(res.guest?.document_type || 'N/A')}: ${esc(res.guest?.document_id || 'N/A')}</span></div>
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
        console.error('Error:', error);
        showToast('Error cargando detalle', 'error');
    }
}

async function doCheckIn(reservationId) {
    try {
        const { error } = await supabase
            .from('reservations')
            .update({ status: 'checked_in' })
            .eq('id', reservationId);
        
        if (error) throw error;
        
        showToast('✅ Check-in realizado', 'success');
        showReservations();
    } catch (error) {
        showToast('❌ Error en check-in: ' + error.message, 'error');
    }
}

async function doCheckOut(reservationId) {
    try {
        const { error } = await supabase
            .from('reservations')
            .update({ status: 'checked_out' })
            .eq('id', reservationId);
        
        if (error) throw error;
        
        showToast('✅ Check-out realizado - Tarea de limpieza creada', 'success');
        showReservations();
    } catch (error) {
        showToast('❌ Error en check-out: ' + error.message, 'error');
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    
    try {
        const { error } = await supabase
            .from('reservations')
            .update({ 
                status: 'cancelled',
                deleted_at: new Date().toISOString()
            })
            .eq('id', reservationId);
        
        if (error) throw error;
        
        showToast('✅ Reserva cancelada', 'success');
        showReservations();
    } catch (error) {
        showToast('❌ Error al cancelar: ' + error.message, 'error');
    }
}

// =====================================================
// FUNCIONES AUXILIARES GLOBALES (si no existen en app.js)
// =====================================================

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
}

function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', { 
        day: '2-digit', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toFixed(2);
}
