// =====================================================
// FINANZAS / CAJA - ESTABLE
// =====================================================

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
// HISTORIAL (SIN TEMPLATE STRING)
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

        if (!data || data.length === 0) {
            container.innerHTML = 'Sin movimientos';
            return;
        }

        let html = '';

        data.forEach(adj => {
            html += '<div>' + Number(adj.new_balance || 0).toFixed(2) + '</div>';
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// =============================
// INIT
// =============================
async function loadFinances() {
    try {
        await loadCashBalance();
        await loadCashHistory();
    } catch (error) {
        console.error('Error loading finances:', error);
    }
}

// =============================
// EXPORTS
// =============================
window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;

