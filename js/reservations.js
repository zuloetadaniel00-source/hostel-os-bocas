// =====================================================
// RESERVAS - Crear y gestionar
// Compatible con app.js (usa supabase global)
// =====================================================

// Variables de estado del wizard de reserva
let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
};

// =====================================================
// FUNCIONES DE NAVEGACIÓN DEL WIZARD
// =====================================================

/**
 * Resetea el formulario de reserva completo
 * Llamado desde app.js cuando se inicia nueva reserva
 */
function resetReservationForm() {
    console.log('🔄 Resetear formulario de reserva');
    
    // Resetear datos
    reservationData = {
        roomId: null,
        bedId: null,
        checkIn: null,
        checkOut: null,
        guestId: null
    };
    
    // Resetear formularios
    const forms = ['step1-form', 'step2-form', 'step3-form'];
    forms.forEach(id => {
        const form = document.getElementById(id);
        if (form) form.reset();
    });
    
    // Resetear campos específicos
    const fields = {
        'total-amount': '0',
        'initial-payment': '0',
        'balance-due': '$0.00'
    };
    
    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'balance-due') {
                el.textContent = value;
            } else {
                el.value = value;
            }
        }
    });
    
    // Ocultar opciones de alojamiento
    const dormitoryOpts = document.getElementById('dormitory-options');
    const privateOpts = document.getElementById('private-options');
    
    if (dormitoryOpts) dormitoryOpts.classList.add('hidden');
    if (privateOpts) privateOpts.classList.add('hidden');
    
    // Deshabilitar botón continuar
    const continueBtn = document.getElementById('step1-continue');
    if (continueBtn) continueBtn.disabled = true;
    
    // Limpiar listas
    const dormitoryList = document.getElementById('dormitory-list');
    const privateList = document.getElementById('private-list');
    
    if (dormitoryList) dormitoryList.innerHTML = '';
    if (privateList) privateList.innerHTML = '';
    
    // Ocultar preview de recibo
    const receiptPreview = document.getElementById('receipt-preview');
    if (receiptPreview) {
        receiptPreview.innerHTML = '';
        receiptPreview.classList.add('hidden');
    }
    
    // Mostrar paso 1, ocultar otros
    const pages = ['new-reservation-page', 'new-reservation-step2', 'new-reservation-step3'];
    pages.forEach((id, index) => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.toggle('hidden', index !== 0);
        }
    });
}

/**
 * Navegar a un paso específico del wizard
 */
function goToStep(step) {
    // Ocultar todas las páginas de reserva
    const pages = ['new-reservation-page', 'new-reservation-step2', 'new-reservation-step3'];
    pages.forEach(id => {
        const page = document.getElementById(id);
        if (page) page.classList.add('hidden');
    });
    
    // Mostrar el paso solicitado
    const targetId = step === 1 ? 'new-reservation-page' : 
                     step === 2 ? 'new-reservation-step2' : 'new-reservation-step3';
    
    const targetPage = document.getElementById(targetId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Actualizar indicadores de paso si existen
    updateStepIndicators(step);
}

/**
 * Actualizar indicadores visuales de pasos
 */
function updateStepIndicators(currentStep) {
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        const stepNum = index + 1;
        
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
        }
    });
}

// =====================================================
// PASO 1: SELECCIÓN DE FECHAS Y ALOJAMIENTO
// =====================================================

/**
 * Mostrar opciones de dormitorio
 */
function showDormitoryOptions() {
    const dormitoryOpts = document.getElementById('dormitory-options');
    const privateOpts = document.getElementById('private-options');
    
    if (dormitoryOpts) dormitoryOpts.classList.remove('hidden');
    if (privateOpts) privateOpts.classList.add('hidden');
    
    loadDormitoryOptions();
}

/**
 * Mostrar opciones de habitación privada
 */
function showPrivateOptions() {
    const dormitoryOpts = document.getElementById('dormitory-options');
    const privateOpts = document.getElementById('private-options');
    
    if (dormitoryOpts) dormitoryOpts.classList.add('hidden');
    if (privateOpts) privateOpts.classList.remove('hidden');
    
    loadPrivateOptions();
}

/**
 * Actualizar disponibilidad cuando cambian las fechas
 */
function updateAvailability() {
    const type = document.querySelector('input[name="accommodation-type"]:checked')?.value;
    
    if (type === 'dormitory') {
        loadDormitoryOptions();
    } else if (type === 'private') {
        loadPrivateOptions();
    }
}

/**
 * Cargar opciones de dormitorios disponibles
 */
async function loadDormitoryOptions() {
    const checkInEl = document.getElementById('check-in-date');
    const checkOutEl = document.getElementById('check-out-date');
    const list = document.getElementById('dormitory-list');
    
    const checkIn = checkInEl?.value;
    const checkOut = checkOutEl?.value;

    if (!checkIn || !checkOut) {
        if (list) list.innerHTML = '<p class="text-muted">Selecciona fechas primero</p>';
        return;
    }

    // Validar que check-out sea posterior
    if (new Date(checkOut) <= new Date(checkIn)) {
        showToast('La fecha de salida debe ser posterior a la entrada', 'error');
        return;
    }

    if (list) list.innerHTML = '<p>Cargando disponibilidad...</p>';

    try {
        // Obtener dormitorios con sus camas
        const { data: rooms, error: roomError } = await supabase
            .from('rooms')
            .select('*, beds(*)')
            .eq('type', 'dormitory');

        if (roomError) throw roomError;

        // Obtener reservas que se solapan con el rango de fechas
        const { data: reservations, error: resError } = await supabase
            .from('reservations')
            .select('bed_id, check_in_date, check_out_date, status')
            .lte('check_in_date', checkOut)
            .gte('check_out_date', checkIn)
            .neq('status', 'cancelled')
            .neq('status', 'checked_out')
            .is('deleted_at', null);

        if (resError) throw resError;

        console.log('Dormitorios:', rooms);
        console.log('Reservas ocupadas:', reservations);

        const occupiedBeds = new Set(
            reservations?.map(r => r.bed_id).filter(id => id !== null) || []
        );

        if (list) list.innerHTML = '';

        if (!rooms || rooms.length === 0) {
            if (list) list.innerHTML = '<p class="text-muted">No hay dormitorios configurados</p>';
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
        console.error('Error cargando dormitorios:', error);
        if (list) list.innerHTML = '<p class="error">Error al cargar disponibilidad</p>';
    }
}

/**
 * Cargar opciones de habitaciones privadas
 */
async function loadPrivateOptions() {
    const checkInEl = document.getElementById('check-in-date');
    const checkOutEl = document.getElementById('check-out-date');
    const list = document.getElementById('private-list');
    
    const checkIn = checkInEl?.value;
    const checkOut = checkOutEl?.value;

    if (!checkIn || !checkOut) {
        if (list) list.innerHTML = '<p class="text-muted">Selecciona fechas primero</p>';
        return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
        showToast('La fecha de salida debe ser posterior a la entrada', 'error');
        return;
    }

    if (list) list.innerHTML = '<p>Cargando disponibilidad...</p>';

    try {
        // Obtener reservas que se solapan
        const { data: reservations, error: resError } = await supabase
            .from('reservations')
            .select('room_id, check_in_date, check_out_date, status')
            .lte('check_in_date', checkOut)
            .gte('check_out_date', checkIn)
            .neq('status', 'cancelled')
            .neq('status', 'checked_out')
            .is('deleted_at', null);

        if (resError) throw resError;

        const occupiedRooms = new Set(
            reservations?.map(r => r.room_id).filter(id => id !== null) || []
        );

        // Obtener habitaciones privadas
        const { data: rooms, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('type', 'private')
            .order('number');

        if (roomError) throw roomError;

        console.log('Habitaciones privadas:', rooms);

        if (list) list.innerHTML = '';

        if (!rooms || rooms.length === 0) {
            if (list) list.innerHTML = '<p class="text-muted">No hay habitaciones privadas configuradas</p>';
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
        console.error('Error cargando habitaciones privadas:', error);
        if (list) list.innerHTML = '<p class="error">Error al cargar disponibilidad</p>';
    }
}

/**
 * Seleccionar un dormitorio y mostrar camas disponibles
 */
function selectDormitory(room, availableBeds, element) {
    // Limpiar selecciones previas
    document.querySelectorAll('#dormitory-list .room-option').forEach(el => {
        el.classList.remove('selected');
        const prevSelection = el.querySelector('.bed-selection');
        if (prevSelection) prevSelection.remove();
    });
    
    element.classList.add('selected');
    
    // Crear selector de camas
    const bedSelection = document.createElement('div');
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
            
            // Marcar como seleccionada
            bedGrid.querySelectorAll('.bed-option').forEach(b => b.classList.remove('selected'));
            bedDiv.classList.add('selected');
            
            // Guardar datos
            reservationData.bedId = bed.id;
            reservationData.roomId = null;
            
            // Habilitar botón continuar
            const continueBtn = document.getElementById('step1-continue');
            if (continueBtn) continueBtn.disabled = false;
        };
        bedGrid.appendChild(bedDiv);
    });
    
    bedSelection.appendChild(bedGrid);
    element.appendChild(bedSelection);
}

/**
 * Seleccionar una habitación privada
 */
function selectPrivateRoom(room, element) {
    document.querySelectorAll('#private-list .room-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    
    reservationData.roomId = room.id;
    reservationData.bedId = null;
    
    const continueBtn = document.getElementById('step1-continue');
    if (continueBtn) continueBtn.disabled = false;
}

// =====================================================
// EVENT LISTENERS - CONFIGURADOS DESPUÉS DE CARGAR DOM
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 Inicializando reservations.js...');
    
    // PASO 1: Formulario de fechas y alojamiento
    const step1Form = document.getElementById('step1-form');
    if (step1Form) {
        step1Form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const checkInEl = document.getElementById('check-in-date');
            const checkOutEl = document.getElementById('check-out-date');
            
            reservationData.checkIn = checkInEl?.value;
            reservationData.checkOut = checkOutEl?.value;

            if (!reservationData.roomId && !reservationData.bedId) {
                showToast('⚠️ Selecciona una habitación o cama', 'error');
                return;
            }

            goToStep(2);
        });
    }
    
    // PASO 2: Datos del huésped
    const step2Form = document.getElementById('step2-form');
    if (step2Form) {
        step2Form.addEventListener('submit', (e) => {
            e.preventDefault();
            updateReservationSummary();
            goToStep(3);
        });
    }
    
    // PASO 3: Pago y confirmación
    const step3Form = document.getElementById('step3-form');
    if (step3Form) {
        step3Form.addEventListener('submit', handleCreateReservation);
    }
    
    // Inputs de monto para calcular balance
    const totalAmount = document.getElementById('total-amount');
    const initialPayment = document.getElementById('initial-payment');
    
    if (totalAmount) totalAmount.addEventListener('input', updateBalance);
    if (initialPayment) initialPayment.addEventListener('input', updateBalance);
    
    // Preview de comprobante
    const paymentReceipt = document.getElementById('payment-receipt');
    if (paymentReceipt) {
        paymentReceipt.addEventListener('change', handleReceiptPreview);
    }
});

/**
 * Manejar preview de comprobante de pago
 */
function handleReceiptPreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    
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

/**
 * Actualizar el balance pendiente
 */
function updateBalance() {
    const totalEl = document.getElementById('total-amount');
    const paidEl = document.getElementById('initial-payment');
    const balanceEl = document.getElementById('balance-due');
    
    const total = parseFloat(totalEl?.value) || 0;
    const paid = parseFloat(paidEl?.value) || 0;
    
    if (balanceEl) {
        balanceEl.textContent = formatCurrency(total - paid);
    }
}

/**
 * Mostrar/ocultar upload de recibo según método de pago
 */
function toggleReceiptUpload() {
    const methodEl = document.querySelector('input[name="payment-method"]:checked');
    const uploadGroup = document.getElementById('receipt-upload-group');
    const receiptInput = document.getElementById('payment-receipt');
    
    if (!methodEl || !uploadGroup) return;
    
    const method = methodEl.value;
    const requiresReceipt = ['yappy', 'card', 'transfer'].includes(method);
    
    if (requiresReceipt) {
        uploadGroup.classList.remove('hidden');
        if (receiptInput) receiptInput.required = true;
    } else {
        uploadGroup.classList.add('hidden');
        if (receiptInput) receiptInput.required = false;
    }
}

/**
 * Actualizar resumen antes del pago
 */
function updateReservationSummary() {
    const checkIn = reservationData.checkIn;
    const checkOut = reservationData.checkOut;
    
    if (!checkIn || !checkOut) return;
    
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const guestName = document.getElementById('guest-name')?.value || 'Sin nombre';
    
    const summary = document.getElementById('reservation-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="summary-row">
                <span>Huésped:</span>
                <span>${esc(guestName)}</span>
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
}

// =====================================================
// CREAR RESERVA EN BASE DE DATOS
// =====================================================

async function handleCreateReservation(e) {
    e.preventDefault();
    
    const btn = document.getElementById('create-reservation-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';
    }
    
    try {
        // 1. CREAR HUÉSPED
        const guestData = {
            full_name: document.getElementById('guest-name')?.value?.trim(),
            email: document.getElementById('guest-email')?.value?.trim(),
            phone: document.getElementById('guest-phone')?.value?.trim(),
            nationality: document.getElementById('guest-nationality')?.value,
            document_type: document.getElementById('guest-doc-type')?.value,
            document_id: document.getElementById('guest-doc-id')?.value?.trim(),
            notes: document.getElementById('guest-notes')?.value?.trim() || null
        };
        
        // Validar campos requeridos del huésped
        if (!guestData.full_name || !guestData.nationality || !guestData.document_id) {
            throw new Error('Faltan datos requeridos del huésped');
        }
        
        console.log('👤 Creando huésped:', guestData);
        
        const { data: guest, error: guestError } = await supabase
            .from('guests')
            .insert([guestData])
            .select()
            .single();
        
        if (guestError) {
            console.error('Error creando huésped:', guestError);
            throw new Error('Error al crear huésped: ' + guestError.message);
        }
        
        console.log('✅ Huésped creado:', guest.id);

        // 2. SUBIR COMPROBANTE SI EXISTE
        let receiptUrl = null;
        const receiptFile = document.getElementById('payment-receipt')?.files[0];
        
        if (receiptFile) {
            console.log('📤 Subiendo comprobante...');
            const fileName = `${Date.now()}_${receiptFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            
            const { error: uploadError } = await supabase
                .storage
                .from('receipts')
                .upload(fileName, receiptFile);
            
            if (uploadError) {
                console.error('Error subiendo comprobante:', uploadError);
                throw new Error('Error al subir comprobante: ' + uploadError.message);
            }
            
            const { data: { publicUrl } } = supabase
                .storage
                .from('receipts')
                .getPublicUrl(fileName);
            
            receiptUrl = publicUrl;
            console.log('✅ Comprobante subido:', receiptUrl);
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
            notes: document.getElementById('reservation-notes')?.value?.trim() || null,
            created_by: currentUser?.id
        };
        
        console.log('📝 Creando reserva:', reservationInsert);
        
        const { data: reservation, error: resError } = await supabase
            .from('reservations')
            .insert([reservationInsert])
            .select()
            .single();
        
        if (resError) {
            console.error('Error creando reserva:', resError);
            throw new Error('Error al crear reserva: ' + resError.message);
        }
        
        console.log('✅ Reserva creada:', reservation.id);

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
            
            console.log('💰 Registrando pago:', paymentData);
            
            const { error: payError } = await supabase
                .from('payments')
                .insert([paymentData]);
            
            if (payError) {
                console.error('Error registrando pago:', payError);
                // No lanzamos error, la reserva ya está creada
                showToast('⚠️ Reserva creada pero hubo error al registrar el pago', 'warning');
            } else {
                console.log('✅ Pago registrado');
            }
        }

        showToast('🎉 Reserva creada exitosamente', 'success');
        
        // Limpiar y volver a lista
        resetReservationForm();
        showReservations();
        
    } catch (error) {
        console.error('❌ Error completo:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Crear Reserva';
        }
    }
}

// =====================================================
// LISTA Y GESTIÓN DE RESERVAS EXISTENTES
// =====================================================

async function loadReservationsByDate() {
    const dateInput = document.getElementById('reservations-date');
    const list = document.getElementById('reservations-list');
    
    const date = dateInput?.value;
    if (!date) {
        console.log('No hay fecha seleccionada');
        return;
    }
    
    if (list) list.innerHTML = '<p>⏳ Cargando...</p>';
    
    try {
        const { data: reservations, error } = await supabase
            .from('reservations')
            .select(`
                *,
                guest:guest_id(full_name),
                room:room_id(number, name),
                bed:bed_id(bed_number, room:room_id(number))
            `)
            .or(`check_in_date.eq.${date},check_out_date.eq.${date}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        
        if (error) throw error;

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
            card.style.cursor = 'pointer';
            card.onclick = () => showReservationDetail(res.id);
            
            card.innerHTML = `
                <div class="reservation-header">
                    <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                    <span class="badge" style="background: ${isCheckin ? '#d1fae5' : '#fee2e2'}; color: ${isCheckin ? '#065f46' : '#991b1b'};">
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
        console.error('Error cargando reservas:', error);
        if (list) list.innerHTML = '<p class="error">Error al cargar reservas</p>';
    }
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const tabBtn = document.getElementById(`tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');
    
    // Recargar con el filtro correspondiente
    loadReservationsByDate();
}

async function showReservationDetail(reservationId) {
    try {
        const { data: res, error } = await supabase
            .from('reservations')
            .select(`
                *,
                guest:guest_id(*),
                room:room_id(*),
                bed:bed_id(*, room:room_id(*)),
                payments(*)
            `)
            .eq('id', reservationId)
            .single();
        
        if (error || !res) {
            showToast('Error cargando detalle de reserva', 'error');
            return;
        }

        const location = res.bed 
            ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}` 
            : res.room?.name || 'N/A';
        
        const content = document.getElementById('reservation-detail-content');
        if (content) {
            content.innerHTML = `
                <div class="detail-section">
                    <h4>👤 Información del Huésped</h4>
                    <div class="detail-row">
                        <span class="detail-label">Nombre</span>
                        <span class="detail-value">${esc(res.guest?.full_name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${esc(res.guest?.email || 'N/A')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Teléfono</span>
                        <span class="detail-value">${esc(res.guest?.phone || 'N/A')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Nacionalidad</span>
                        <span class="detail-value">${esc(res.guest?.nationality)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Documento</span>
                        <span class="detail-value">${esc(res.guest?.document_type)}: ${esc(res.guest?.document_id)}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>🏨 Alojamiento</h4>
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
                    <div class="detail-row">
                        <span class="detail-label">Noches</span>
                        <span class="detail-value">${calculateNights(res.check_in_date, res.check_out_date)}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>💰 Pagos</h4>
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
                    ${res.payments?.length ? '<hr style="margin: 0.5rem 0; border: none; border-top: 1px solid var(--gray-200);">' : ''}
                    ${res.payments?.map(p => `
                        <div class="detail-row" style="font-size: 0.875rem;">
                            <span class="detail-label">${formatDateTime(p.created_at)} - ${p.payment_method}</span>
                            <span class="detail-value">${formatCurrency(p.amount)}</span>
                        </div>
                    `).join('') || ''}
                </div>
                
                ${res.notes ? `
                <div class="detail-section">
                    <h4>📝 Notas</h4>
                    <p style="font-size: 0.875rem; color: var(--gray-600); white-space: pre-wrap;">${esc(res.notes)}</p>
                </div>
                ` : ''}
            `;
        }
        
        // Configurar botones de acción según estado
        const actions = document.getElementById('detail-actions');
        if (actions) {
            actions.innerHTML = '';
            
            if (res.status === 'confirmed') {
                actions.innerHTML += `
                    <button onclick="doCheckIn('${res.id}')" class="btn btn-primary">
                        ✅ Check-in
                    </button>
                `;
            }
            
            if (res.status === 'checked_in') {
                actions.innerHTML += `
                    <button onclick="doCheckOut('${res.id}')" class="btn btn-warning">
                        🚪 Check-out
                    </button>
                `;
                
                if (res.balance_due > 0) {
                    actions.innerHTML += `
                        <button onclick="showAddPaymentModal('${res.id}')" class="btn btn-success">
                            💵 Registrar pago
                        </button>
                    `;
                }
            }
            
            if (res.status !== 'cancelled' && res.status !== 'checked_out') {
                actions.innerHTML += `
                    <button onclick="cancelReservation('${res.id}')" class="btn btn-danger">
                        ❌ Cancelar
                    </button>
                `;
            }
        }
        
        showPage('reservation-detail-page');
        
    } catch (error) {
        console.error('Error mostrando detalle:', error);
        showToast('Error cargando detalle de reserva', 'error');
    }
}

/**
 * Calcular número de noches entre dos fechas
 */
function calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function doCheckIn(reservationId) {
    try {
        const { error } = await supabase
            .from('reservations')
            .update({ status: 'checked_in' })
            .eq('id', reservationId);
        
        if (error) throw error;
        
        showToast('✅ Check-in realizado correctamente', 'success');
        showReservations();
    } catch (error) {
        console.error('Error en check-in:', error);
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
        console.error('Error en check-out:', error);
        showToast('❌ Error en check-out: ' + error.message, 'error');
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?\n\nEsta acción no se puede deshacer.')) {
        return;
    }
    
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
        console.error('Error cancelando:', error);
        showToast('❌ Error al cancelar: ' + error.message, 'error');
    }
}

/**
 * Mostrar modal para agregar pago (placeholder - implementar si se necesita)
 */
function showAddPaymentModal(reservationId) {
    // Implementar modal de pago si es necesario
    const amount = prompt('Monto del pago:');
    if (!amount || isNaN(amount)) return;
    
    // Aquí iría la lógica para registrar el pago
    showToast('Función de pago en desarrollo', 'info');
}

console.log('✅ reservations.js cargado correctamente');
