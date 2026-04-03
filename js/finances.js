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
        loadCashBalance();
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// MEJORA 7: Ajustar saldo de caja (Admin)
async function adjustCashBalance() {
    const newAmount = parseFloat(document.getElementById('cash-adjust-amount').value);
    const reason = document.getElementById('cash-adjust-reason').value;
    
    if (isNaN(newAmount) || newAmount < 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }
    
    try {
        // Obtener saldo actual
        const { data: current } = await db
            .from('cash_register')
            .select('current_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        const currentBalance = current?.current_balance || 0;
        const difference = newAmount - currentBalance;
        
        // Registrar ajuste en cash_register
        await db.from('cash_register').insert({
            previous_balance: currentBalance,
            new_balance: newAmount,
            difference: difference,
            reason: reason || 'Ajuste manual',
            adjusted_by: currentUser.id,
            created_at: new Date().toISOString()
        });
        
        // Registrar transacción si hay diferencia
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

// Cargar historial de ajustes (Admin)
async function loadCashHistory() {
    try {
        const { data, error } = await db
            .from('cash_register')
            .select('*, user:adjusted_by(full_name)')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        
        const container = document.getElementById('adjust-history-list');
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

// MEJORA 1, 2, 3: Finanzas con gráfico, hora y rango de fechas
async function loadFinances() {
    const fromDate = document.getElementById('finance-date-from').value;
    const toDate = document.getElementById('finance-date-to').value;
    
    if (!fromDate || !toDate) {
        showToast('Selecciona un rango de fechas', 'error');
        return;
    }
    
    // Ajustar toDate para incluir todo el día
    const adjustedToDate = new Date(toDate);
    adjustedToDate.setHours(23, 59, 59);
    
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
        createPaymentChart(transactions || []);
        displayTransactions(transactions || []);
        
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
    
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
    document.getElementById('total-balance').textContent = formatCurrency(totalIncome - totalExpense);
}

// MEJORA 1: Gráfico por método de pago
function createPaymentChart(transactions) {
    const byMethod = { cash: 0, yappy: 0, card: 0 };
    
    transactions.filter(t => t.type === 'income').forEach(t => {
        if (byMethod[t.payment_method] !== undefined) {
            byMethod[t.payment_method] += parseFloat(t.amount);
        }
    });
    
    const ctx = document.getElementById('payment-method-chart');
    if (!ctx) return;
    
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
                    'rgba(16, 185, 129, 0.6)',  // Verde efectivo
                    'rgba(245, 158, 11, 0.6)',   // Amarillo yappy
                    'rgba(59, 130, 246, 0.6)'    // Azul tarjeta
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
    
    // Mostrar totales numéricos
    document.getElementById('payment-method-totals').innerHTML = `
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

// MEJORA 2: Mostrar fecha y hora
function displayTransactions(transactions) {
    const list = document.getElementById('transactions-list');
    
    if (!transactions.length) {
        list.innerHTML = '<p class="text-muted">No hay movimientos</p>';
        return;
    }
    
    list.innerHTML = transactions.map(t => {
        const date = new Date(t.created_at);
        const dateStr = date.toLocaleDateString('es-PA');
        const timeStr = date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-desc">${esc(t.description)}</div>
                    <div class="transaction-meta">
                        ${dateStr} ${timeStr} • ${t.category} • ${formatPaymentMethod(t.payment_method)}
                    </div>
                </div>
                <span class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
                </span>
            </div>
        `;
    }).join('');
}

function formatPaymentMethod(method) {
    const methods = {
        'cash': '💵 Efectivo',
        'yappy': '📱 Yappy',
        'card': '💳 Tarjeta'
    };
    return methods[method] || method;
}

// Modal nuevo movimiento
function showNewTransactionModal() {
    showModal('new-transaction-modal');
}

document.getElementById('new-transaction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const type = document.querySelector('input[name="trans-type"]:checked').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const method = document.getElementById('trans-method').value;
    
    try {
        const { error } = await db.from('transactions').insert([{
            type: type,
            category: document.getElementById('trans-category').value,
            amount: amount,
            payment_method: method,
            description: document.getElementById('trans-description').value,
            shift_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id
        }]);
        
        if (error) throw error;
        
        // Actualizar caja si es efectivo
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

// Exponer funciones
window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;
window.showNewTransactionModal = showNewTransactionModal;
