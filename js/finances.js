// =====================================================
// FINANZAS / CAJA - CORREGIDO PRO
// =====================================================

let paymentChart = null;
let chartLoaded = false;

// =============================
// LOAD CHART
// =============================
async function loadChartJS() {
    if (chartLoaded) return;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
            chartLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// =============================
// CASH BALANCE (FIX CLAVE)
// =============================
async function loadCashBalance() {
    try {
        const { data, error } = await db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const balance = data?.new_balance || 0;

        const el = document.getElementById('current-cash-balance');
        if (el) el.textContent = formatCurrency(balance);

        if (currentProfile?.role === 'admin') {
            loadCashHistory();
        }

    } catch (error) {
        console.error('Error loading cash:', error);
    }
}

// =============================
// UPDATE CASH (GLOBAL)
// =============================
window.updateCashBalance = async function(amount, operation) {
    try {
        const { data: current } = await db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const currentBalance = current?.new_balance || 0;

        const newBalance = operation === 'add'
            ? currentBalance + amount
            : currentBalance - amount;

        await db.from('cash_register').insert({
            previous_balance: currentBalance,
            new_balance: newBalance,
            difference: operation === 'add' ? amount : -amount,
            reason: 'Movimiento automático',
            adjusted_by: currentUser.id,
            created_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error updating cash:', error);
    }
};

// =============================
// VOLUNTARIO → INGRESO
// =============================
async function registerCashIncome() {
    const amount = parseFloat(document.getElementById('cash-income-amount')?.value);
    const concept = document.getElementById('cash-income-concept')?.value;

    if (!amount || amount <= 0) {
        showToast('Monto inválido', 'error');
        return;
    }

    try {
        const { error } = await db.rpc('process_cash_transaction', {
            p_type: 'income',
            p_category: 'manual_entry',
            p_amount: amount,
            p_description: concept || 'Ingreso manual',
            p_user_id: currentUser.id
        });

        if (error) throw error;

        showToast('Ingreso registrado', 'success');

        loadCashBalance();

    } catch (error) {
        showToast(error.message, 'error');
    }
}
// =============================
// ADMIN → AJUSTE
// =============================
async function adjustCashBalance() {
    const amountInput = document.getElementById('cash-adjust-amount');
    const reasonInput = document.getElementById('cash-adjust-reason');

    const newAmount = parseFloat(amountInput?.value);
    const reason = reasonInput?.value?.trim();

    // =============================
    // VALIDACIONES
    // =============================
    if (isNaN(newAmount) || newAmount < 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }

    if (!currentUser?.id) {
        showToast('Usuario no autenticado', 'error');
        return;
    }

    // Evitar doble ejecución (doble click)
    if (adjustCashBalance.loading) return;
    adjustCashBalance.loading = true;

    try {
        // =============================
        // LLAMADA SEGURA AL BACKEND (RPC)
        // =============================
        const { error } = await db.rpc('adjust_cash', {
            p_new_balance: newAmount,
            p_reason: reason || 'Ajuste manual',
            p_user_id: currentUser.id
        });

        if (error) throw error;

        // =============================
        // UI
        // =============================
        showToast('Caja ajustada correctamente', 'success');

        if (amountInput) amountInput.value = '';
        if (reasonInput) reasonInput.value = '';

        await loadCashBalance();

    } catch (error) {
        console.error('Adjust cash error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        adjustCashBalance.loading = false;
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

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="padding: 0.5rem; font-size: 0.75rem;">Sin movimientos</div>';
            return;
        }

        container.innerHTML = data.map(adj => `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--gray-100); font-size: 0.75rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${new Date(adj.created_at).toLocaleString('es-PA')}</span>
                    <span style="color: ${adj.difference >= 0 ? 'green' : 'red'}">
                        ${adj.difference >= 0 ? '+' : ''}$${Number(adj.difference || 0).toFixed(2)}
                    </span>
                </div>
                <div>
                    $${Number(adj.previous_balance || 0).toFixed(2)} → $${Number(adj.new_balance || 0).toFixed(2)} | ${adj.reason || ''}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading history:', error);
    }
// =============================
// INIT FINANCES (VA PRIMERO)
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
// EXPORTS (SIEMPRE AL FINAL)
// =============================
window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;
