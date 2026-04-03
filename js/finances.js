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
        showToast('Ingresa un monto válido', 'error');
        return;
    }

    try {
        const { error } = await db.from('transactions').insert([{
            type: 'income',
            category: 'manual_entry', // ✔ CORRECTO
            amount: amount,
            payment_method: 'cash',
            description: concept || 'Ingreso manual',
            shift_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id
        }]);

        if (error) throw error;

        await window.updateCashBalance(amount, 'add');

        showToast('Ingreso registrado', 'success');

        document.getElementById('cash-income-amount').value = '';
        document.getElementById('cash-income-concept').value = '';

        loadCashBalance();

    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// =============================
// ADMIN → AJUSTE
// =============================
async function adjustCashBalance() {
    const newAmount = parseFloat(document.getElementById('cash-adjust-amount')?.value);
    const reason = document.getElementById('cash-adjust-reason')?.value;

    if (isNaN(newAmount) || newAmount < 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }

    try {
        const { data: current } = await db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const currentBalance = current?.new_balance || 0;
        const difference = newAmount - currentBalance;

        await db.from('cash_register').insert({
            previous_balance: currentBalance,
            new_balance: newAmount,
            difference: difference,
            reason: reason || 'Ajuste manual',
            adjusted_by: currentUser.id,
            created_at: new Date().toISOString()
        });

        if (difference !== 0) {
            await db.from('transactions').insert([{
                type: difference > 0 ? 'income' : 'expense',
                category: 'cash_adjustment', // ✔ CORRECTO
                amount: Math.abs(difference),
                payment_method: 'cash',
                description: `Ajuste de caja: ${reason || 'Sin razón'}`,
                shift_date: new Date().toISOString().split('T')[0],
                created_by: currentUser.id
            }]);
        }

        showToast('Saldo ajustado', 'success');

        document.getElementById('cash-adjust-amount').value = '';
        document.getElementById('cash-adjust-reason').value = '';

        loadCashBalance();

    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// =============================
// HISTORIAL
// =============================
async function loadCashHistory() {
    try {
        const { data, error } = await db
            .from('cash_register')
            .select('*, user:adjusted_by(full_name)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const container = document.getElementById('adjust-history-list');
        if (!container) return;

        container.innerHTML = data.map(adj => `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--gray-100); font-size: 0.75rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${new Date(adj.created_at).toLocaleString('es-PA')}</span>
                    <span style="color: ${adj.difference >= 0 ? 'green' : 'red'}">
                        ${adj.difference >= 0 ? '+' : ''}$${adj.difference.toFixed(2)}
                    </span>
                </div>
                <div>
                    $${adj.previous_balance.toFixed(2)} → $${adj.new_balance.toFixed(2)} | ${adj.reason}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// =============================
// EXPORTS
// =============================
window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;
