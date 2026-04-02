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
    if (receipt
