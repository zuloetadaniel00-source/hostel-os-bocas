// =====================================================
// FINANZAS / CAJA - Actualizado con todas las mejoras
// =====================================================

let paymentChart = null;

// MEJORA 6: Cargar saldo de caja (para Volunteer y Admin)
async function loadCashBalance() {
    try {
        const { data, error } = await db
            .from('cash_register')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        
        const balance = data?.current_balance || 0;
        document.getElementById('current-cash-balance').textContent = formatCurrency(balance);
        
        // Si es admin, cargar historial
        if (currentProfile?.role === 'admin') {
            loadCashHistory();
        }
        
    } catch (error) {
        console.error('Error loading cash:', error);
        document.getElementById('current-cash-balance').textContent = '$0.00';
    }
}

// MEJORA 6: Registrar ingreso en efectivo (Volunteer)
async function registerCashIncome() {
    const amount = parseFloat(document.getElementById('cash-income-amount').value);
    const concept = document.getElementById('cash-income-concept').value;
    
    if (!amount || amount <= 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }
    
    try {
        // Registrar transacción
        const { error: transError } = await db.from('transactions').insert([{
            type: 'income',
            category: 'manual_entry',
            amount: amount,
            payment_method: 'cash',
            description: concept || 'Ingreso manual',
            shift_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id
        }]);
        
        if (transError) throw transError;
        
        // Actualizar caja
        await window.updateCashBalance(amount, 'add');
        
        showToast('Ingreso registrado', 'success');
        document.getElementById('cash-income-amount').value = '';
        document.getElementById('cash-income-concept').value = '';
        loadCash
