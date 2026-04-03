// =====================================================
// FINANZAS / CAJA - OPTIMIZADO
// =====================================================

let paymentChart = null;
let chartLoaded = false;

// Cargar Chart.js dinámicamente solo cuando se necesita
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
        const el = document.getElementById('current-cash-balance');
        if (el) el.textContent = formatCurrency(balance);
        
        if (currentProfile?.role === 'admin') {
            loadCashHistory();
        }
        
    } catch (error) {
        console.error('Error loading cash:', error);
        const el = document.getElementById('current-cash-balance');
        if (el) el.textContent = '$0.00';
    }
}

async function registerCashIncome() {
    const amount = parseFloat(document.getElementById('cash-income-amount')?.value);
    const concept = document.getElementById('cash-income-concept')?.value;
    
    if (!amount || amount <= 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }
    
    try {
        const { error: transError } = await db.from('transactions').insert([{
            type: 'income',
            category: 'other',
            amount: amount,
            payment_method: 'cash',
            description: concept || 'Ingreso manual',
            shift_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id
        }]);
        
        if (transError) throw transError;
        
        await window.updateCashBalance(amount, 'add');
        
        showToast('Ingreso registrado', 'success');
        document.getElementById('cash-income-amount').value = '';
        document.getElementById('cash-income-concept').value = '';
        loadCashBalance();
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

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
            .select('current_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        const currentBalance = current?.current_balance || 0;
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
                category: 'cash_adjustment',
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
        
        if (!data?.length) {
            container.innerHTML = '<p class="text-muted">Sin ajustes recientes</p>';
            return;
        }
        
        container.innerHTML = data.map(adj => `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--gray-100); font-size: 0.75rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${new Date(adj.created_at).toLocaleString('es-PA')}</span>
                    <span style="color: ${adj.difference >= 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${adj.difference >= 0 ? '+' : ''}$${adj.difference.toFixed(2)}
                    </span>
                </div>
                <div style="color: var(--gray-500);">
                    $${adj.previous_balance.toFixed(2)} → $${adj.new_balance.toFixed(2)} | ${adj.reason}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

async function loadFinances() {
    const fromDate = document.getElementById('finance-date-from')?.value;
    const toDate = document.getElementById('finance-date-to')?.value;
    
    if (!fromDate || !toDate) {
        showToast('Selecciona un rango de fechas', 'error');
        return;
    }
    
    try {
        const { data: transactions, error } = await db
            .from('transactions')
            .select('*')
            .gte('shift_date', fromDate)
            .lte('shift_date', toDate)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        calculateStats(transactions || []);
        displayTransactions(transactions || []);
        
        // Cargar Chart.js solo cuando se necesita
        await loadChartJS();
        createPaymentChart(transactions || []);
        
    } catch (error) {
        console.error('Error loading finances:', error);
        showToast('Error al cargar finanzas', 'error');
    }
}

function calculateStats(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
        if (t.type === 'income') totalIncome += parseFloat(t.amount);
        else totalExpense += parseFloat(t.amount);
    });
    
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');
    const balanceEl = document.getElementById('total-balance');
    
    if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);
    if (expenseEl) expenseEl.textContent = formatCurrency(totalExpense);
    if (balanceEl) balanceEl.textContent = formatCurrency(totalIncome - totalExpense);
}

function createPaymentChart(transactions) {
    const byMethod = { cash: 0, yappy: 0, card: 0 };
    
    transactions.filter(t => t.type === 'income').forEach(t => {
        if (byMethod[t.payment_method] !== undefined) {
            byMethod[t.payment_method] += parseFloat(t.amount);
        }
    });
    
    const ctx = document.getElementById('payment-method-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (paymentChart) {
        paymentChart.destroy();
    }
    
    paymentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Efectivo', 'Yappy', 'Tarjeta'],
            datasets: [{
                label: 'Ingresos',
                data: [byMethod.cash, byMethod.yappy, byMethod.card],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(59, 130, 246, 0.6)'
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(59, 130, 246)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => '$' + value }
                }
            }
        }
    });
    
    const totalsDiv = document.getElementById('payment-method-totals');
    if (totalsDiv) {
        totalsDiv.innerHTML = `
            <div style="background: rgba(16,185,129,0.1); padding: 0.5rem; border-radius: var(--radius);">
                <div style="font-size: 0.75rem; color: var(--gray-500);">Efectivo</div>
                <div style="font-weight: 600; color: var(--success);">${formatCurrency(byMethod.cash)}</div>
            </div>
            <div style="background: rgba(245,158,11,0.1); padding: 0.5rem; border-radius: var(--radius);">
                <div style="font-size: 0.75rem; color: var(--gray-500);">Yappy</div>
                <div style="font-weight: 600; color: var(--warning);">${formatCurrency(byMethod.yappy)}</div>
            </div>
            <div style="background: rgba(59,130,246,0.1); padding: 0.5rem; border-radius: var(--radius);">
                <div style="font-size: 0.75rem; color: var(--gray-500);">Tarjeta</div>
                <div style="font-weight: 600; color: var(--info);">${formatCurrency(byMethod.card)}</div>
            </div>
        `;
    }
}

function displayTransactions(transactions) {
    const list = document.getElementById('transactions-list');
    if (!list) return;
    
    if (!transactions.length) {
        list.innerHTML = '<p class="text-muted">No hay movimientos</p>';
        return;
    }
    
    list.innerHTML = transactions.map(t => {
        const date = new Date(t.created_at);
        const dateStr = date.toLocaleDateString('es-PA');
        const timeStr = date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
        
        const methods = { cash: '💵 Efectivo', yappy: '📱 Yappy', card: '💳 Tarjeta' };
        
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-desc">${esc(t.description)}</div>
                    <div class="transaction-meta">
                        ${dateStr} ${timeStr} • ${t.category} • ${methods[t.payment_method] || t.payment_method}
                    </div>
                </div>
                <span class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
                </span>
            </div>
        `;
    }).join('');
}

function showNewTransactionModal() {
    showModal('new-transaction-modal');
}

document.getElementById('new-transaction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const type = document.querySelector('input[name="trans-type"]:checked')?.value;
    const amount = parseFloat(document.getElementById('trans-amount')?.value);
    const method = document.getElementById('trans-method')?.value;
    
    try {
        const { error } = await db.from('transactions').insert([{
            type: type,
            category: document.getElementById('trans-category')?.value,
            amount: amount,
            payment_method: method,
            description: document.getElementById('trans-description')?.value,
            shift_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id
        }]);
        
        if (error) throw error;
        
        if (method === 'cash' && window.updateCashBalance) {
            await window.updateCashBalance(amount, type === 'income' ? 'add' : 'subtract');
        }
        
        showToast('Movimiento registrado', 'success');
        closeModal();
        loadFinances();
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
});

window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;
window.showNewTransactionModal = showNewTransactionModal;
