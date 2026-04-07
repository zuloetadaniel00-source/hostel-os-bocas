// =====================================================
// RESERVAS - CON INTEGRACIÓN COMPLETA A CAJA
// Premium UX Edition
// =====================================================

let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
};

async function uploadFileToStorage(file, folder) {
    if (!file) return null;
    
    try {
        const { data: { session } } = await db.auth.getSession();
        if (!session) throw new Error('No hay sesión activa');

        const fileName = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        
        const { data, error } = await db
            .storage
            .from('receipts')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });
            
        if (error) throw error;

        const { data: { publicUrl } } = db.storage.from('receipts').getPublicUrl(fileName);
        return publicUrl;
        
    } catch (error) {
        console.error('Error en upload:', error);
        if (folder === 'guests') return null;
        throw error;
    }
}

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
    if (photoPreview) {
        photoPreview.innerHTML = '';
        photoPreview.classList.add('hidden');
    }
    if (receiptPreview) {
        receiptPreview.innerHTML = '';
        receiptPreview.classList.add('hidden');
    }

    const uploadGroup = document.getElementById('receipt-upload-group');
    const receiptInput = document.getElementById('payment-receipt');
    if (uploadGroup) uploadGroup.classList.add('hidden');
    if (receiptInput) {
        receiptInput.required = false;
        receiptInput.value = '';
    }
    
    // Reset selections
    document.querySelectorAll('.room-option').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.bed-option').forEach(el => el.classList.remove('selected'));
    
    const continueBtn = document.getElementById('step1-continue');
    if (continueBtn) continueBtn.disabled = true;
    
    // Reset dates
    const today = getTodayInPanama();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const checkInEl = document.getElementById('check-in-date');
    const checkOutEl = document.getElementById('check-out-date');
    if (checkInEl) checkInEl.value = today;
    if (checkOutEl) checkOutEl.value = tomorrowStr;
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
    const checkInLocal = document.getElementById('check-in-date')?.value;
    const checkOutLocal = document.getElementById('check-out-date')?.value;
    if (!checkInLocal || !checkOutLocal) return;
    
    const checkInUTC = dateToUTC(checkInLocal);
    const checkOutUTC = dateToUTC(checkOutLocal);
    
    const list = document.getElementById('dormitory-list');
    if (!list) return;
    
    // Show loading state
    list.innerHTML = `
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg);"></div>
    `;

    try {
        const [{ data: rooms }, { data: reservations }] = await Promise.all([
            db.from('rooms').select('*, beds(*)').eq('type', 'dormitory'),
            db.from('reservations').select('bed_id, status')
                .gte('check_in_date', checkInUTC.split('T')[0])
                .lte('check_in_date', checkOutUTC.split('T')[0])
                .neq('status', 'cancelled')
                .neq('status', 'checked_out')
                .is('deleted_at', null)
        ]);

        const occupiedBeds = new Set(reservations?.map(r => r.bed_id) || []);
        list.innerHTML = '';
        
        rooms?.forEach((room, index) => {
            const availableBeds = room.beds?.filter(b => !occupiedBeds.has(b.id) && b.status === 'available') || [];
            const isFull = availableBeds.length === 0;
            const div = document.createElement('div');
            div.className = `room-option ${isFull ? 'disabled' : ''}`;
            div.style.animationDelay = `${index * 0.05}s`;
            div.innerHTML = `
                <div class="room-info">
                    <h4>${esc(room.name)}</h4>
                    <p>${availableBeds.length} de ${room.beds?.length || 0} camas disponibles</p>
                </div>
                <span class="room-status ${isFull ? 'status-occupied' : 'status-available'}">
                    ${isFull ? 'Lleno' : 'Disponible'}
                </span>
            `;
            if (!isFull) div.onclick = () => selectDormitory(room, availableBeds, div);
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar disponibilidad</p>';
    }
}

async function loadPrivateOptions() {
    const checkInLocal = document.getElementById('check-in-date')?.value;
    const checkOutLocal = document.getElementById('check-out-date')?.value;
    if (!checkInLocal || !checkOutLocal) return;
    
    const checkInUTC = dateToUTC(checkInLocal);
    const checkOutUTC = dateToUTC(checkOutLocal);
    
    const list = document.getElementById('private-list');
    if (!list) return;
    
    // Show loading state
    list.innerHTML = `
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
    `;

    try {
        const [{ data: reservations }, { data: rooms }] = await Promise.all([
            db.from('reservations').select('room_id, status')
                .gte('check_in_date', checkInUTC.split('T')[0])
                .lte('check_in_date', checkOutUTC.split('T')[0])
                .neq('status', 'cancelled')
                .neq('status', 'checked_out')
                .is('deleted_at', null),
            db.from('rooms').select('*').eq('type', 'private').order('number')
        ]);

        const occupiedRooms = new Set(reservations?.map(r => r.room_id) || []);
        list.innerHTML = '';
        
        rooms?.forEach((room, index) => {
            const isOccupied = occupiedRooms.has(room.id);
            const div = document.createElement('div');
            div.className = `room-option ${isOccupied ? 'disabled' : ''}`;
            div.style.animationDelay = `${index * 0.05}s`;
            div.innerHTML = `
                <div class="room-info">
                    <h4>${esc(room.name)}</h4>
                    <p>Capacidad: ${room.capacity_total} personas</p>
                </div>
                <span class="room-status ${isOccupied ? 'status-occupied' : 'status-available'}">
                    ${isOccupied ? 'Ocupada' : 'Disponible'}
                </span>
            `;
            if (!isOccupied) div.onclick = () => selectPrivateRoom(room, div);
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar disponibilidad</p>';
    }
}

function selectDormitory(room, availableBeds, element) {
    // Remove previous selections
    document.querySelectorAll('#dormitory-list .room-option').forEach(el => {
        el.classList.remove('selected');
        const existingSelection = el.querySelector('.bed-selection');
        if (existingSelection) existingSelection.remove();
    });
    
    element.classList.add('selected');
    
    const bedSelection = document.createElement('div');
    bedSelection.className = 'bed-selection';
    bedSelection.innerHTML = '<p style="margin: var(--space-3) 0; font-size: 0.875rem; color: var(--gray-600); font-weight: 600;">Selecciona una cama:</p>';
    const bedGrid = document.createElement('div');
    bedGrid.className = 'bed-list';
    
    availableBeds.forEach((bed, index) => {
        const bedDiv = document.createElement('div');
        bedDiv.className = 'bed-option';
        bedDiv.textContent = bed.bed_number;
        bedDiv.style.animationDelay = `${index * 0.03}s`;
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
    
    // Scroll to show bed selection
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectPrivateRoom(room, element) {
    document.querySelectorAll('#private-list .room-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    reservationData.roomId = room.id;
    reservationData.bedId = null;
    const btn = document.getElementById('step1-continue');
    if (btn) btn.disabled = false;
    
    // Visual feedback
    element.style.transform = 'scale(1.02)';
    setTimeout(() => {
        element.style.transform = '';
    }, 200);
}

document.getElementById('step1-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const checkInLocal = document.getElementById('check-in-date')?.value;
    const checkOutLocal = document.getElementById('check-out-date')?.value;
    
    reservationData.checkIn = dateToUTC(checkInLocal);
    reservationData.checkOut = dateToUTC(checkOutLocal);
    
    if (!reservationData.roomId && !reservationData.bedId) {
        showToast('Selecciona una habitación o cama', 'error');
        return;
    }
    
    // Smooth transition
    document.getElementById('new-reservation-page')?.classList.add('hidden');
    document.getElementById('new-reservation-step2')?.classList.remove('hidden');
    document.getElementById('new-reservation-step2').scrollTop = 0;
});

function goToStep(step) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    if (step === 1) {
        document.getElementById('new-reservation-page')?.classList.remove('hidden');
    } else if (step === 2) {
        document.getElementById('new-reservation-step2')?.classList.remove('hidden');
    }
}

document.getElementById('guest-photo')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('guest-photo-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Foto del huésped" style="width: 100%; height: auto; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">`;
                preview.classList.remove('hidden');
                preview.style.animation = 'fadeIn 0.3s ease';
            }
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('step2-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('new-reservation-step2')?.classList.add('hidden');
    document.getElementById('new-reservation-step3')?.classList.remove('hidden');
    document.getElementById('new-reservation-step3').scrollTop = 0;
    updateReservationSummary();
});

function updateReservationSummary() {
    const checkInLocal = document.getElementById('check-in-date')?.value;
    const checkOutLocal = document.getElementById('check-out-date')?.value;
    if (!checkInLocal || !checkOutLocal) return;
    
    const nights = Math.ceil((new Date(checkOutLocal) - new Date(checkInLocal)) / (1000 * 60 * 60 * 24));
    const summary = document.getElementById('reservation-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="summary-row">
                <span>Huésped</span>
                <span style="font-weight: 700;">${esc(document.getElementById('guest-name')?.value)}</span>
            </div>
            <div class="summary-row">
                <span>Entrada</span>
                <span>${formatDateToPanama(new Date(checkInLocal))}</span>
            </div>
            <div class="summary-row">
                <span>Salida</span>
                <span>${formatDateToPanama(new Date(checkOutLocal))}</span>
            </div>
            <div class="summary-row">
                <span>Noches</span>
                <span style="font-weight: 700; color: var(--primary);">${nights} noche${nights !== 1 ? 's' : ''}</span>
            </div>
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
    const balance = total - paid;
    
    if (balanceEl) {
        balanceEl.textContent = formatCurrency(balance);
        balanceEl.style.color = balance > 0 ? 'var(--warning)' : 'var(--success)';
        
        // Add animation
        balanceEl.style.transform = 'scale(1.1)';
        setTimeout(() => {
            balanceEl.style.transform = 'scale(1)';
        }, 200);
    }
}

function toggleReceiptUpload() {
    const method = document.querySelector('input[name="payment-method"]:checked')?.value;
    const uploadGroup = document.getElementById('receipt-upload-group');
    const receiptInput = document.getElementById('payment-receipt');
    
    if (method === 'yappy' || method === 'card') {
        uploadGroup?.classList.remove('hidden');
        uploadGroup.style.animation = 'slideDown 0.3s ease';
        if (receiptInput) receiptInput.required = true;
    } else {
        uploadGroup?.classList.add('hidden');
        if (receiptInput) {
            receiptInput.required = false;
            receiptInput.value = '';
        }
        const receiptPreview = document.getElementById('receipt-preview');
        if (receiptPreview) {
            receiptPreview.innerHTML = '';
            receiptPreview.classList.add('hidden');
        }
    }
}

document.getElementById('payment-receipt')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('receipt-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Comprobante" style="width: 100%; height: auto; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">`;
                preview.classList.remove('hidden');
                preview.style.animation = 'fadeIn 0.3s ease';
            }
        };
        reader.readAsDataURL(file);
    }
});

// =====================================================
// CREAR RESERVA - CON INTEGRACIÓN A CAJA
// =====================================================
document.getElementById('step3-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('create-reservation-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
            </svg>
            Creando reserva...
        `;
    }

    try {
        const { data: { session } } = await db.auth.getSession();
        if (!session?.user) throw new Error('No hay sesión activa');
        
        const userId = session.user.id;
        const guestName = document.getElementById('guest-name')?.value;

        const notesEl = document.getElementById('guest-notes');
        const totalAmount = parseFloat(document.getElementById('total-amount')?.value) || 0;
        const initialPayment = parseFloat(document.getElementById('initial-payment')?.value) || 0;
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'cash';
        const statusEl = document.getElementById('reservation-status');
        const status = statusEl?.value || 'confirmed';
        const receiptFile = document.getElementById('payment-receipt')?.files[0];
        const guestPhotoFile = document.getElementById('guest-photo')?.files[0];

        // Validate receipt if needed
        if ((paymentMethod === 'yappy' || paymentMethod === 'card') && !receiptFile) {
            showToast('El comprobante es obligatorio para Yappy o Tarjeta', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Crear Reserva
                `;
            }
            return;
        }

        // Upload files with progress indication
        let guestPhotoUrl = null;
        let receiptUrl = null;
        
        try {
            [guestPhotoUrl, receiptUrl] = await Promise.all([
                uploadFileToStorage(guestPhotoFile, 'guests'),
                receiptFile ? uploadFileToStorage(receiptFile, 'receipts') : Promise.resolve(null)
            ]);
        } catch (uploadError) {
            console.warn('Error en upload:', uploadError);
        }

        // Create guest
        const { data: guest, error: guestError } = await db
            .from('guests')
            .insert([{
                full_name: guestName,
                email: document.getElementById('guest-email')?.value || null,
                nationality: document.getElementById('guest-nationality')?.value || null,
                photo_url: guestPhotoUrl,
                notes: notesEl?.value || null
            }])
            .select()
            .single();

        if (guestError) throw new Error(`Error al crear huésped: ${guestError.message}`);

        // Create reservation
        const { data: reservation, error: resError } = await db
            .from('reservations')
            .insert([{
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
                created_by: userId
            }])
            .select()
            .single();
        
        if (resError) throw new Error(`Error al crear reserva: ${resError.message}`);

        // Process payment and update cash
        if (initialPayment > 0) {
            const { error: payError } = await db
                .from('payments')
                .insert([{
                    reservation_id: reservation.id,
                    amount: initialPayment,
                    payment_method: paymentMethod,
                    payment_type: initialPayment >= totalAmount ? 'full' : 'deposit',
                    receipt_url: receiptUrl,
                    notes: 'Pago inicial al crear reserva',
                    created_by: userId
                }]);
                
            if (payError) console.warn('Error creando pago:', payError);

            // If cash, add to register
            if (paymentMethod === 'cash') {
                try {
                    const cashResult = await window.addCashIncome(
                        initialPayment,
                        `Pago reserva - ${guestName}`,
                        'reservation',
                        reservation.id
                    );

                    if (cashResult.success) {
                        showToast(`✅ Reserva creada. $${initialPayment.toFixed(2)} agregados a caja`, 'success');
                    } else {
                        showToast('Reserva creada pero hubo un problema con la caja', 'warning');
                    }
                } catch (cashError) {
                    console.error('Error actualizando caja:', cashError);
                    showToast('Reserva creada pero error al actualizar caja', 'warning');
                }
            } else {
                showToast('✅ Reserva creada exitosamente', 'success');
            }
        } else {
            showToast('✅ Reserva creada (sin pago inicial)', 'success');
        }

        // Reset and navigate
        resetReservationForm();
        showReservations();

    } catch (error) {
        console.error('Error:', error);
        showToast('Error al crear reserva: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                Crear Reserva
            `;
        }
    }
});

async function loadReservationsByDate() {
    const dateLocal = document.getElementById('reservations-date')?.value;
    const list = document.getElementById('reservations-list');
    if (!list) return;
    
    if (!dateLocal) {
        list.innerHTML = '<p class="text-muted">Selecciona una fecha</p>';
        return;
    }
    
    const dateUTC = dateToUTC(dateLocal);
    const dateQuery = dateUTC.split('T')[0];
    
    // Show loading
    list.innerHTML = `
        <div class="skeleton" style="height: 100px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 100px; border-radius: var(--radius-lg);"></div>
    `;
    
    try {
        const { data: reservations, error } = await db.from('reservations')
            .select('*, guest:guest_id(full_name), room:room_id(number, name), bed:bed_id(bed_number, room:room_id(number))')
            .or(`check_in_date.eq.${dateQuery},check_out_date.eq.${dateQuery}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reservations || reservations.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: var(--space-10) var(--space-4); color: var(--gray-400);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-3);">📭</div>
                    <div style="font-weight: 600;">No hay reservas para esta fecha</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">Selecciona otra fecha o crea una nueva reserva</div>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        reservations.forEach((res, index) => {
            const resCheckInLocal = dateFromUTC(res.check_in_date);
            const resCheckInStr = resCheckInLocal.toISOString().split('T')[0];
            const isCheckin = resCheckInStr === dateLocal;
            
            const location = res.bed ? `Cama ${res.bed.bed_number} - Hab ${res.bed.room?.number}` : res.room?.name || 'N/A';
            const card = document.createElement('div');
            card.className = `reservation-card status-${res.status}`;
            card.style.animationDelay = `${index * 0.05}s`;
            card.onclick = () => showReservationDetail(res.id);
            card.innerHTML = `
                <div class="reservation-header">
                    <span class="reservation-guest">${esc(res.guest?.full_name)}</span>
                    <span class="badge" style="background: ${isCheckin ? 'var(--success-light)' : 'var(--danger-light)'}; color: ${isCheckin ? '#065f46' : '#991b1b'}; font-size: 0.625rem;">
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
                    <span style="font-weight: 700; font-family: var(--font-sans);">${formatCurrency(res.total_amount)}</span>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error:', error);
        list.innerHTML = '<p class="text-muted">Error al cargar reservas</p>';
    }
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) {
        tabEl.classList.add('active');
        // Add ripple effect
        tabEl.style.transform = 'scale(0.95)';
        setTimeout(() => tabEl.style.transform = '', 150);
    }
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
            `<div style="margin: var(--space-4) 0; border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-md);">
                <img src="${res.guest.photo_url}" style="width: 100%; max-height: 250px; object-fit: cover; display: block;">
            </div>` : '';
        
        const content = document.getElementById('reservation-detail-content');
        if (content) {
            content.innerHTML = `
                <div class="detail-section">
                    <h4>👤 Información del Huésped</h4>
                    ${guestPhotoHtml}
                    <div class="detail-row">
                        <span class="detail-label">Nombre</span>
                        <span class="detail-value">${esc(res.guest?.full_name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${esc(res.guest?.email) || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Nacionalidad</span>
                        <span class="detail-value">${esc(res.guest?.nationality) || 'N/A'}</span>
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
                </div>
                <div class="detail-section">
                    <h4>💳 Pagos</h4>
                    <div class="detail-row">
                        <span class="detail-label">Total</span>
                        <span class="detail-value">${formatCurrency(res.total_amount)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Pagado</span>
                        <span class="detail-value" style="color: var(--success);">${formatCurrency(res.amount_paid)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Pendiente</span>
                        <span class="detail-value" style="color: ${res.balance_due > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 800;">
                            ${formatCurrency(res.balance_due)}
                        </span>
                    </div>
                    ${res.payments?.map(p => `
                        <div class="detail-row" style="font-size: 0.875rem; background: var(--gray-50); padding: var(--space-3); border-radius: var(--radius-md); margin-top: var(--space-2);">
                            <span class="detail-label">${formatDateTime(p.created_at)} - ${p.payment_method}</span>
                            <span class="detail-value">${formatCurrency(p.amount)}</span>
                        </div>
                    `).join('') || ''}
                </div>
                ${res.notes ? `
                    <div class="detail-section">
                        <h4>📝 Notas</h4>
                        <p style="font-size: 0.9375rem; color: var(--gray-600); line-height: 1.6; background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-lg);">
                            ${esc(res.notes)}
                        </p>
                    </div>
                ` : ''}
            `;
        }
        
        const actions = document.getElementById('detail-actions');
        if (actions) {
            actions.innerHTML = '';
            const isAdmin = currentProfile?.role === 'admin';
            
            if (res.status !== 'cancelled' && res.status !== 'checked_out') {
                actions.innerHTML += `
                    <button onclick="openEditReservation('${res.id}')" class="btn btn-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                `;
            }
            if (res.status === 'confirmed') {
                actions.innerHTML += `
                    <button onclick="doCheckIn('${res.id}')" class="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        Check-in
                    </button>
                `;
            }
            if (res.status === 'checked_in') {
                actions.innerHTML += `
                    <button onclick="doCheckOut('${res.id}')" class="btn btn-warning">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                        </svg>
                        Check-out
                    </button>
                `;
                if (res.balance_due > 0) {
                    actions.innerHTML += `
                        <button onclick="addPayment('${res.id}')" class="btn btn-success">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                            Registrar pago
                        </button>
                    `;
                }
            }
            if (res.status !== 'cancelled' && res.status !== 'checked_out') {
                actions.innerHTML += `
                    <button onclick="cancelReservation('${res.id}')" class="btn btn-danger">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Cancelar
                    </button>
                `;
            }
            if (isAdmin) {
                actions.innerHTML += `
                    <button onclick="deleteReservation('${res.id}')" class="btn btn-danger" style="background: #7f1d1d;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Eliminar
                    </button>
                `;
            }
        }
        
        showPage('reservation-detail-page');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteReservation(id) {
    if (!confirm('⚠️ ¿Eliminar esta reserva permanentemente? Esta acción no se puede deshacer.')) return;
    
    try {
        await db.from('payments').delete().eq('reservation_id', id);
        await db.from('transactions').delete().eq('reservation_id', id);
        const { error } = await db.from('reservations').delete().eq('id', id);
        if (error) throw error;
        showToast('Reserva eliminada permanentemente', 'success');
        showReservations();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al eliminar: ' + error.message, 'error');
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
        
        const checkInLocal = dateFromUTC(res.check_in_date);
        const checkOutLocal = dateFromUTC(res.check_out_date);
        
        document.getElementById('edit-checkin').value = checkInLocal.toISOString().split('T')[0];
        document.getElementById('edit-checkout').value = checkOutLocal.toISOString().split('T')[0];
        document.getElementById('edit-total').value = res.total_amount;
        document.getElementById('edit-notes').value = res.notes || '';
        
        const select = document.getElementById('edit-room-bed');
        select.innerHTML = '<option value="">Cargando opciones...</option>';
        
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

        // Show payment section if there is a pending balance
        const balanceDue = parseFloat(res.balance_due || 0);
        const paymentSection = document.getElementById('edit-payment-section');
        if (paymentSection) {
            if (balanceDue > 0) {
                paymentSection.classList.remove('hidden');
                const totalEl = document.getElementById('edit-total-display');
                const paidEl = document.getElementById('edit-paid-display');
                const balanceEl = document.getElementById('edit-balance-display');
                const amountInput = document.getElementById('edit-payment-amount');
                if (totalEl) totalEl.textContent = formatCurrency(res.total_amount);
                if (paidEl) paidEl.textContent = formatCurrency(res.amount_paid || 0);
                if (balanceEl) balanceEl.textContent = formatCurrency(balanceDue);
                if (amountInput) amountInput.value = balanceDue.toFixed(2);
            } else {
                paymentSection.classList.add('hidden');
            }
        }
        
        showModal('edit-reservation-modal');
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al cargar datos', 'error');
    }
}

// Register a partial or full payment on an existing reservation
async function registerPendingPayment() {
    const reservationId = document.getElementById('edit-res-id')?.value;
    const paymentAmount = parseFloat(document.getElementById('edit-payment-amount')?.value);
    const paymentMethod = document.querySelector('input[name="edit-payment-method"]:checked')?.value || 'cash';

    if (!reservationId) {
        showToast('Error: ID de reserva no encontrado', 'error');
        return;
    }
    if (!paymentAmount || paymentAmount <= 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }

    try {
        // Fetch current reservation
        const { data: res, error: fetchError } = await db.from('reservations')
            .select('*, guest:guest_id(full_name)')
            .eq('id', reservationId)
            .single();
        if (fetchError || !res) throw new Error('No se pudo cargar la reserva');

        const currentBalance = parseFloat(res.balance_due || 0);
        if (paymentAmount > currentBalance + 0.001) {
            showToast(`El monto no puede superar el saldo pendiente (${formatCurrency(currentBalance)})`, 'error');
            return;
        }

        const newAmountPaid = parseFloat(res.amount_paid || 0) + paymentAmount;
        const newBalance = parseFloat(res.total_amount) - newAmountPaid;
        const newPaymentStatus = newBalance <= 0.001 ? 'paid' : 'partial';

        const { data: { user } } = await db.auth.getUser();

        // Insert payment record
        const { error: payError } = await db.from('payments').insert({
            reservation_id: reservationId,
            amount: paymentAmount,
            payment_method: paymentMethod,
            payment_type: newBalance <= 0.001 ? 'full' : 'partial',
            notes: 'Abono desde edición de reserva',
            created_by: user.id
        });
        if (payError) throw payError;

        // Update reservation balances
        const { error: updateError } = await db.from('reservations').update({
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, newBalance),
            payment_status: newPaymentStatus,
            updated_at: new Date().toISOString()
        }).eq('id', reservationId);
        if (updateError) throw updateError;

        // If cash, update cash register automatically
        if (paymentMethod === 'cash') {
            await window.addCashIncome(
                paymentAmount,
                `Abono reserva - ${res.guest?.full_name || 'Huésped'}`,
                'reservation',
                reservationId
            );
            showToast(`✅ $${paymentAmount.toFixed(2)} cobrados y sumados a caja`, 'success');
        } else {
            showToast(`✅ Pago de $${paymentAmount.toFixed(2)} registrado correctamente`, 'success');
        }

        closeEditModal();
        showReservations();

    } catch (error) {
        console.error('Error registering payment:', error);
        showToast('Error al registrar pago: ' + error.message, 'error');
    }
}

// addPayment — called from reservation detail when balance_due > 0
async function addPayment(reservationId) {
    await openEditReservation(reservationId);
}

document.getElementById('edit-reservation-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-res-id')?.value;
    const roomBedValue = document.getElementById('edit-room-bed')?.value;
    
    const checkInLocal = document.getElementById('edit-checkin')?.value;
    const checkOutLocal = document.getElementById('edit-checkout')?.value;
    
    const checkInUTC = dateToUTC(checkInLocal);
    const checkOutUTC = dateToUTC(checkOutLocal);
    
    let updateData = {
        check_in_date: checkInUTC,
        check_out_date: checkOutUTC,
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
        showToast('✅ Reserva actualizada correctamente', 'success');
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
        showToast('✅ Check-in realizado exitosamente', 'success');
        showReservations();
    } catch (error) {
        showToast('Error en check-in: ' + error.message, 'error');
    }
}

async function doCheckOut(reservationId) {
    try {
        const { error } = await db.from('reservations').update({ status: 'checked_out' }).eq('id', reservationId);
        if (error) throw error;
        showToast('✅ Check-out realizado exitosamente', 'success');
        showReservations();
    } catch (error) {
        showToast('Error en check-out: ' + error.message, 'error');
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    
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
        
        // If cash refund needed, subtract from register
        if (totalCashRefund > 0) {
            try {
                await window.subtractCashExpense(
                    totalCashRefund,
                    `Reembolso cancelación - ${res.guest?.full_name}`,
                    'refund'
                );
                showToast(`Reserva cancelada. $${totalCashRefund.toFixed(2)} descontados de caja`, 'success');
            } catch (cashError) {
                console.error('Error reembolsando caja:', cashError);
                showToast('Reserva cancelada pero error al actualizar caja', 'warning');
            }
        } else {
            showToast('✅ Reserva cancelada', 'success');
        }
        
        showReservations();
        
    } catch (error) {
        console.error('Error:', error);
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
window.addPayment = addPayment;
window.registerPendingPayment = registerPendingPayment;
window.doCheckIn = doCheckIn;
window.doCheckOut = doCheckOut;
window.cancelReservation = cancelReservation;
window.deleteReservation = deleteReservation;
