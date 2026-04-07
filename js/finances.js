// =====================================================
// FINANZAS / CAJA - COMPLETO
// =====================================================

let paymentChart = null;

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
// INGRESO EN CAJA
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
// AJUSTE DE CAJA
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
// HISTORIAL DE CAJA
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
            container.innerHTML = '<p style="color: var(--gray-500); font-size: 0.875rem;">Sin movimientos</p>';
            return;
        }

        let html = '';

        data.forEach(adj => {
            const fecha = adj.created_at
                ? new Date(adj.created_at).toLocaleString('es-PA', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : '--';

            html += `
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--gray-100);font-size:0.85rem;">
                    <span style="color:var(--gray-500);">${fecha}</span>
                    <span style="font-weight:600;">$${Number(adj.new_balance || 0).toFixed(2)}</span>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// =============================
// CARGAR FINANZAS COMPLETO
// =============================
async function loadFinances() {
    try {
        await loadCashBalance();
        await loadCashHistory();
        await loadFinanceSummary();
        await loadTransactions();
    } catch (error) {
        console.error('Error loading finances:', error);
    }
}

// =============================
// RESUMEN
// =============================
async function loadFinanceSummary() {
    try {
        const dateFrom = document.getElementById('finance-date-from')?.value;
        const dateTo   = document.getElementById('finance-date-to')?.value;

        let query = db.from('transactions').select('*');

        if (dateFrom) query = query.gte('shift_date', dateFrom);
        if (dateTo)   query = query.lte('shift_date', dateTo);

        const { data, error } = await query;

        if (error) throw error;

        processTransactions(data || []);

    } catch (error) {
        console.error('Error loading finance summary:', error);
    }
}

function processTransactions(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
        const amount = parseFloat(t.amount || 0);
        if (t.type === 'income') totalIncome += amount;
        if (t.type === 'expense') totalExpense += amount;
    });

    document.getElementById('total-income').textContent  = formatCurrency(totalIncome);
    document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
    document.getElementById('total-balance').textContent = formatCurrency(totalIncome - totalExpense);
}

// =============================
// TRANSACCIONES
// =============================
async function loadTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        renderTransactions(data, container);

    } catch (error) {
        console.error(error);
    }
}

// 🔥 AQUÍ ESTÁ LO IMPORTANTE
function renderTransactions(data, container) {

    let html = '';

    data.forEach(t => {
        const amount = parseFloat(t.amount || 0);
        const isIncome = t.type === 'income';

        html += `
        <div onclick="showTransactionDetail('${t.id}')" 
             style="cursor:pointer;padding:10px;border-bottom:1px solid #eee;">
            
            <div style="font-weight:600;">
                ${t.category || 'Sin categoría'} - ${t.description || ''}
            </div>

            <div style="font-size:12px;color:#666;">
                ${new Date(t.created_at).toLocaleString('es-PA')}
            </div>

            <div style="color:${isIncome ? 'green' : 'red'};font-weight:700;">
                ${isIncome ? '+' : '-'} $${amount.toFixed(2)}
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

// =============================
// 🔥 DETALLE DE TRANSACCIÓN
// =============================
async function showTransactionDetail(id) {

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        alert(`
        DETALLE DE TRANSACCIÓN

        Tipo: ${data.type}
        Categoría: ${data.category}
        Monto: $${data.amount}
        Método: ${data.payment_method}
        Fecha: ${new Date(data.created_at).toLocaleString('es-PA')}
        Descripción: ${data.description}
        `);

    } catch (error) {
        console.error(error);
    }
}

// =============================
// GUARDAR TRANSACCIÓN
// =============================
async function saveTransaction() {

    const type = document.querySelector('input[name="trans-type"]:checked')?.value;
    const amount = parseFloat(document.getElementById('trans-amount')?.value);
    const category = document.getElementById('trans-category')?.value;
    const description = document.getElementById('trans-description')?.value;

    if (!amount || !description) {
        showToast('Completa todo', 'error');
        return;
    }

    try {
        await db.from('transactions').insert({
            type,
            amount,
            category,
            description,
            created_at: new Date().toISOString(),
            shift_date: new Date().toISOString().split('T')[0]
        });

        showToast('Guardado', 'success');
        await loadTransactions();

    } catch (error) {
        console.error(error);
    }
}

// =============================
// EXPORTS
// =============================
window.loadFinances = loadFinances;
window.loadTransactions = loadTransactions;
window.saveTransaction = saveTransaction;
window.showTransactionDetail = showTransactionDetail;
