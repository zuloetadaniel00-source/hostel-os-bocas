// =====================================================
// FINANZAS / CAJA - CORREGIDO PRO
// =====================================================

let paymentChart = null;
let chartLoaded = false;

// =============================
// CASH BALANCE
// =============================
async function loadCashBalance() {
    try {
        const { data, error } = await db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        const balance = data?.new_balance || 0;

        const el = document.getElementById('current-cash-balance');
        if (el) el.textContent = formatCurrency(balance);

    } catch (error) {
        console.error('Error loading cash:', error);
    }
}

// =============================
// INGRESO
// =============================
async function registerCashIncome() {
    const amount = parseFloat(document.getElementById('cash-income-amount')?.value);

    if (!amount || amount <= 0) {
        showToast('Monto inválido', 'error');
        return;
    }

    try {
        const { error } = await db.rpc('process_cash_transaction', {
            p_type: 'income',
            p_category: 'manual_entry',
            p_amount: amount,
            p_description: 'Ingreso manual',
            p_user_id: currentUser.id
        });

        if (error) throw error;

        showToast('Ingreso registrado', 'success');
        await loadCashBalance();

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// =============================
// AJUSTE
// =============================
async function adjustCashBalance() {
    const newAmount = parseFloat(document.getElementById('cash-adjust-amount')?.value);

    if (isNaN(newAmount) || newAmount < 0) {
        showToast('Monto inválido', 'error');
        return;
    }

    try {
        const { error } = await db.rpc('adjust_cash', {
            p_new_balance: newAmount,
            p_reason: 'Ajuste manual',
            p_user_id: currentUser.id
        });

        if (error) throw error;

        showToast('Caja ajustada', 'success');
        await loadCashBalance();

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// =============================
// HISTORIAL
// =============================
async function loadCashHistory() {
    try {
        const { data, error } = await db
            .from('cash_register')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const container = document.getElementById('adjust-history-list');
        if (!container) return;

        container.innerHTML = (data || []).map(adj => `
            <div>
                ${Number(adj.new_balance || 0).toFixed(2)}
            </div>
        `).join('');

    } catch (error) {
        console.error(error);
    }
}

// =============================
// INIT
// =============================
async function loadFinances() {
    await loadCashBalance();
    await loadCashHistory();
}

// =============================
// EXPORTS
// =============================
window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;
