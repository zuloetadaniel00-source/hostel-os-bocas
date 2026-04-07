// =====================================================
// RESERVAS - OPTIMIZADO (CORREGIDO + FIX TIMEZONE)
// =====================================================

// ✅ FIX TIMEZONE (PANAMÁ)
function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60000));
    return local.toISOString().split('T')[0];
}

function getLocalDateTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - (offset * 60000)).toISOString();
}

let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
};

// =====================================================
// EDIT RESERVATION
// =====================================================
document.getElementById('edit-reservation-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-res-id')?.value;
    const roomBedValue = document.getElementById('edit-room-bed')?.value;

    let updateData = {
        check_in_date: document.getElementById('edit-checkin')?.value,
        check_out_date: document.getElementById('edit-checkout')?.value,
        total_amount: parseFloat(document.getElementById('edit-total')?.value) || 0,
        notes: document.getElementById('edit-notes')?.value,
        updated_at: getLocalDateTime() // ✅ FIX
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

// =====================================================
// CANCEL RESERVATION
// =====================================================
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

        // 🔥 CANCELAR RESERVA
        const { error } = await db.from('reservations')
            .update({
                status: 'cancelled',
                deleted_at: getLocalDateTime()
            })
            .eq('id', reservationId);

        if (error) throw error;

        // 🔥 REGISTRAR EGRESO SI HUBO EFECTIVO
        if (totalCashRefund > 0) {

            await db.from('transactions').insert([{
                type: 'expense',
                category: 'cancellation_refund',
                amount: totalCashRefund,
                payment_method: 'cash',
                description: `Reembolso cancelación: ${res.guest?.full_name}`,
                reservation_id: reservationId,
                shift_date: getLocalDate(), // ✅ LOCAL DATE
                created_at: getLocalDateTime(), // 🔥 FIX IMPORTANTE
                created_by: currentUser?.id
            }]);

            // 🔥 ACTUALIZAR CAJA SI EXISTE FUNCIÓN GLOBAL
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

// =====================================================
// EXPORTS
// =====================================================
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
window.deleteReservation = deleteReservation;
