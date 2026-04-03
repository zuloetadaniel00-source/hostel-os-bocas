// =====================================================
// FINANZAS / CAJA
// =====================================================

let paymentChart = null;

// Setea rango de fechas rápido
function setDateRange(range) {
    const today = new Date();
    const from = new Date();
    if (range === 'today') {
        // nada, from = today
    } else if (range === 'week') {
        from.setDate(today.getDate() - 6);
    } else if (range === 'month') {
        from.setDate(1);
    }
    document.getElementById('finance-date-from').value = from.toISOString().split('T')[0];
    document.getElementById('finance-date-to').value = today.toISOString().split('T')[0];
    loadFinances();
}

// Inicializa fechas al entrar a finanzas
function initFinanceDates() {
    const today = new Date().toISOString().split('T')[0];
    const fromEl = document.getElementById('finance-date-from');
    const toEl = document.getElementById('finance-date-to');
    if (!fromEl.value) fromEl.value = today;
    if (!toEl.value) toEl.value = today;
}

async function loadFinances() {
    initFinanceDates();
    const dateFrom = document.getElementById('finance-date-from').value;
    const dateTo = document.getElementById('finance-date-to').value;
    if (!dateFrom || !dateTo) return;

    const { data: transactions } = await db
        .from('transactions')
        .select('*')
        .gte('shift_date', dateFrom)
        .lte('shift_date', dateTo)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    const income = transactions?.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0) || 0;
    const expense = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0) || 0;

    document.getElementById('total-income').textContent = formatCurrency(income);
    document.getElementById('total-expense').textContent = formatCurrency(expense);
    document.getElementById('total-balance').textContent = formatCurrency(income - expense);

    // Gráfico por método de pago
    renderPaymentChart(transactions || []);

    // Saldo en caja
    loadCashBalance();

    // Lista de movimientos
    const list = document.getElementById('transactions-list');
    if (!transactions || transactions.length === 0) {
        list.innerHTML = '<p class="text-muted">No hay movimientos en este período</p>';
        return;
    }

    list.innerHTML = '';
    transactions.forEach(t => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-desc">${esc(t.description)}</div>
                <div class="transaction-meta">
                    ${t.category} • ${t.payment_method === 'cash' ? '💵 Efectivo' : t.payment_method === 'yappy' ? '📱 Yappy' : '💳 Tarjeta'}
                    <span class="transaction-datetime">🕐 ${formatDateTime(t.created_at)}</span>
                </div>
            </div>
            <span class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
            </span>
        `;
        list.appendChild(item);
    });
}

function renderPaymentChart(transactions) {
    const incomes = transactions.filter(t => t.type === 'income');
    const cash = incomes.filter(t => t.payment_method === 'cash').reduce((s, t) => s + parseFloat(t.amount), 0);
    const yappy = incomes.filter(t => t.payment_method === 'yappy').reduce((s, t) => s + parseFloat(t.amount), 0);
    const card = incomes.filter(t => t.payment_method === 'card').reduce((s, t) => s + parseFloat(t.amount), 0);
    const total = cash + yappy + card;

    // Resumen en texto
    const summaryEl = document.getElementById('payment-methods-summary');
    summaryEl.innerHTML = `
        <div class="pm-row"><span class="pm-dot pm-cash"></span><span>💵 Efectivo</span><strong>${formatCurrency(cash)}</strong><span class="pm-pct">${total > 0 ? Math.round(cash/total*100) : 0}%</span></div>
        <div class="pm-row"><span class="pm-dot pm-yappy"></span><span>📱 Yappy</span><strong>${formatCurrency(yappy)}</strong><span class="pm-pct">${total > 0 ? Math.round(yappy/total*100) : 0}%</span></div>
        <div class="pm-row"><span class="pm-dot pm-card"></span><span>💳 Tarjeta</span><strong>${formatCurrency(card)}</strong><span class="pm-pct">${total > 0 ? Math.round(card/total*100) : 0}%</span></div>
    `;

    // Gráfico
    const ctx = document.getElementById('payment-methods-chart').getContext('2d');
    if (paymentChart) paymentChart.destroy();

    if (total === 0) {
        document.getElementById('payment-methods-chart').style.display = 'none';
        return;
    }
    document.getElementById('payment-methods-chart').style.display = 'block';

    paymentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Yappy', 'Tarjeta'],
            datasets: [{
                data: [cash, yappy, card],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` $${ctx.parsed.toFixed(2)}`
                    }
                }
            }
        }
    });
}

async function loadCashBalance() {
    const { data } = await db
        .from('cash_balance')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

    const balance = data?.amount || 0;
    document.getElementById('cash-balance-display').textContent = formatCurrency(balance);
}

function showEditCashModal() {
    // Prellenar con valor actual
    const current = document.getElementById('cash-balance-display').textContent.replace('$', '');
    document.getElementById('cash-adjustment-amount').value = current;
    showModal('edit-cash-modal');
}

document.getElementById('edit-cash-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('cash-adjustment-amount').value);
    const reason = document.getElementById('cash-adjustment-reason').value || 'Ajuste manual';

    const { error } = await db.from('cash_balance').insert([{
        amount,
        notes: reason,
        updated_by: currentUser.id
    }]);

    if (error) {
        showToast('Error al guardar: ' + error.message, 'error');
    } else {
        showToast('Saldo actualizado', 'success');
        closeModal();
        loadCashBalance();
    }
});

function showNewTransactionModal() {
    showModal('new-transaction-modal');
}

document.getElementById('new-transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="trans-type"]:checked').value;
    const today = new Date().toISOString().split('T')[0];

    const { error } = await db.from('transactions').insert([{
        type,
        category: document.getElementById('trans-category').value,
        amount: document.getElementById('trans-amount').value,
        payment_method: document.getElementById('trans-method').value,
        description: document.getElementById('trans-description').value,
        shift_date: today,
        created_by: currentUser.id
    }]);

    if (error) {
        showToast('Error al registrar: ' + error.message, 'error');
    } else {
        showToast('Movimiento registrado', 'success');
        document.getElementById('new-transaction-form').reset();
        closeModal();
        loadFinances();
    }
});
