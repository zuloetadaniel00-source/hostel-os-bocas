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
            const fecha = adj.created_at ? new Date(adj.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';
            html += '<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--gray-100);font-size:0.85rem;">'
                + '<span style="color:var(--gray-500);">' + fecha + '</span>'
                + '<span style="font-weight:600;">$' + Number(adj.new_balance || 0).toFixed(2) + '</span>'
                + '</div>';
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
// RESUMEN: INGRESOS / EGRESOS / BALANCE + GRÁFICO
// =============================
async function loadFinanceSummary() {
    try {
        const dateFrom = document.getElementById('finance-date-from')?.value;
        const dateTo = document.getElementById('finance-date-to')?.value;

        let query = db.from('transactions').select('*');
        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59');

        const { data, error } = await query;
        if (error) throw error;

        const transactions = data || [];

        // Calcular totales
        let totalIncome  = 0;
        let totalExpense = 0;
        const methodTotals = { cash: 0, yappy: 0, card: 0 };

        transactions.forEach(t => {
            const amount = parseFloat(t.amount || 0);
            if (t.type === 'income') {
                totalIncome += amount;
                const method = t.payment_method || t.method || 'cash';
                if (methodTotals[method] !== undefined) methodTotals[method] += amount;
                else methodTotals['cash'] += amount;
            } else if (t.type === 'expense') {
                totalExpense += amount;
            }
        });

        const balance = totalIncome - totalExpense;

        // Actualizar tarjetas
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = formatCurrency(val);
        };
        setEl('total-income',  totalIncome);
        setEl('total-expense', totalExpense);
        setEl('total-balance', balance);

        // Color del balance
        const balanceEl = document.getElementById('total-balance');
        if (balanceEl) {
            balanceEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger, #ef4444)';
        }

        // Renderizar totales por método
        const totalsContainer = document.getElementById('payment-method-totals');
        if (totalsContainer) {
            totalsContainer.innerHTML =
                '<div style="background:var(--gray-50);border-radius:8px;padding:0.5rem;">' +
                    '<div style="font-size:0.75rem;color:var(--gray-500);">💵 Efectivo</div>' +
                    '<div style="font-weight:700;">$' + methodTotals.cash.toFixed(2) + '</div>' +
                '</div>' +
                '<div style="background:var(--gray-50);border-radius:8px;padding:0.5rem;">' +
                    '<div style="font-size:0.75rem;color:var(--gray-500);">📱 Yappy</div>' +
                    '<div style="font-weight:700;">$' + methodTotals.yappy.toFixed(2) + '</div>' +
                '</div>' +
                '<div style="background:var(--gray-50);border-radius:8px;padding:0.5rem;">' +
                    '<div style="font-size:0.75rem;color:var(--gray-500);">💳 Tarjeta</div>' +
                    '<div style="font-weight:700;">$' + methodTotals.card.toFixed(2) + '</div>' +
                '</div>';
        }

        // Gráfico
        renderPaymentChart(methodTotals);

    } catch (error) {
        console.error('Error loading finance summary:', error);
        showToast('Error cargando resumen financiero', 'error');
    }
}

// =============================
// GRÁFICO DE MÉTODOS DE PAGO
// =============================
function renderPaymentChart(methodTotals) {
    const canvas = document.getElementById('payment-method-chart');
    if (!canvas) return;

    // Cargar Chart.js si no está disponible
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
        script.onload = () => buildChart(canvas, methodTotals);
        document.head.appendChild(script);
    } else {
        buildChart(canvas, methodTotals);
    }
}

function buildChart(canvas, methodTotals) {
    // Destruir gráfico anterior si existe
    if (paymentChart) {
        paymentChart.destroy();
        paymentChart = null;
    }

    const total = methodTotals.cash + methodTotals.yappy + methodTotals.card;

    if (total === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.parentElement.querySelector('canvas + *')?.remove();
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:var(--gray-400);font-size:0.875rem;padding:1rem 0;';
        msg.textContent = 'Sin datos para el rango seleccionado';
        canvas.insertAdjacentElement('afterend', msg);
        canvas.style.display = 'none';
        return;
    }

    canvas.style.display = 'block';

    paymentChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Yappy', 'Tarjeta'],
            datasets: [{
                data: [methodTotals.cash, methodTotals.yappy, methodTotals.card],
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return context.label + ': $' + val.toFixed(2) + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

// =============================
// TRANSACCIONES
// =============================
async function loadTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    container.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:1rem;">Cargando...</p>';

    try {
        const dateFrom = document.getElementById('finance-date-from')?.value;
        const dateTo   = document.getElementById('finance-date-to')?.value;

        let query = db.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59');

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:2rem;">Sin transacciones en este período</p>';
            return;
        }

        let html = '';
        data.forEach(t => {
            const isIncome  = t.type === 'income';
            const amount    = parseFloat(t.amount || 0);
            const fecha     = t.created_at ? new Date(t.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';
            const method    = t.payment_method || t.method || '';
            const methodIcon = method === 'yappy' ? '📱' : method === 'card' ? '💳' : '💵';
            const color     = isIncome ? '#22c55e' : '#ef4444';
            const sign      = isIncome ? '+' : '-';
            const category  = t.category || '';

            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--gray-100);">'
                + '<div style="flex:1;">'
                    + '<div style="font-size:0.875rem;font-weight:500;">' + esc(t.description || category) + '</div>'
                    + '<div style="font-size:0.75rem;color:var(--gray-400);">' + fecha + ' ' + methodIcon + '</div>'
                + '</div>'
                + '<div style="font-weight:700;color:' + color + ';">' + sign + '$' + amount.toFixed(2) + '</div>'
                + '</div>';
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading transactions:', error);
        container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:1rem;">Error cargando transacciones</p>';
    }
}

// =============================
// NUEVO MOVIMIENTO (MODAL)
// =============================
function showNewTransactionModal() {
    showModal('new-transaction-modal');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('new-transaction-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveTransaction();
        });
    }
});

async function saveTransaction() {
    const type        = document.querySelector('input[name="trans-type"]:checked')?.value;
    const amount      = parseFloat(document.getElementById('trans-amount')?.value);
    const category    = document.getElementById('trans-category')?.value;
    const method      = document.getElementById('trans-method')?.value;
    const description = document.getElementById('trans-description')?.value?.trim();

    if (!amount || amount <= 0 || !description) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    try {
        const { error } = await db.from('transactions').insert({
            type,
            amount,
            category,
            payment_method: method,
            description,
            user_id: currentUser.id,
            created_at: new Date().toISOString()
        });
        if (error) throw error;

        showToast('Movimiento guardado', 'success');
        closeModal();

        // Limpiar form
        document.getElementById('trans-amount').value = '';
        document.getElementById('trans-description').value = '';

        // Recargar
        await loadFinanceSummary();
        await loadTransactions();

    } catch (error) {
        console.error('Error saving transaction:', error);
        showToast(error.message || 'Error al guardar', 'error');
    }
}

// =============================
// EXPORTS
// =============================
window.loadFinances         = loadFinances;
window.loadCashBalance      = loadCashBalance;
window.registerCashIncome   = registerCashIncome;
window.adjustCashBalance    = adjustCashBalance;
window.loadTransactions     = loadTransactions;
window.showNewTransactionModal = showNewTransactionModal;
