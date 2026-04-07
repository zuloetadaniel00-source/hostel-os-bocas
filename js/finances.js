// =====================================================
// FINANZAS / CAJA - COMPLETO CON MEJORAS UX
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
                ? formatDateTime(adj.created_at)
                : '--';
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
        const dateTo   = document.getElementById('finance-date-to')?.value;

        // CORRECCIÓN: Usar shift_date con fallback a created_at
        let query = db.from('transactions').select('*');
        
        // Si tenemos fechas, filtrar por shift_date (fecha local de Panamá)
        if (dateFrom) query = query.gte('shift_date', dateFrom);
        if (dateTo)   query = query.lte('shift_date', dateTo);
        
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.warn('Error con shift_date, usando fallback:', error.message);
            // Fallback con created_at si hay problemas
            let q2 = db.from('transactions').select('*');
            if (dateFrom) q2 = q2.gte('created_at', dateFrom + 'T00:00:00+00:00');
            if (dateTo)   q2 = q2.lte('created_at', dateTo   + 'T23:59:59+00:00');
            const { data: d2, error: e2 } = await q2.order('created_at', { ascending: false });
            if (e2) throw e2;
            processTransactions(d2 || []);
            return;
        }

        processTransactions(data || []);

    } catch (error) {
        console.error('Error loading finance summary:', error);
        showToast('Error cargando resumen financiero', 'error');
    }
}

function processTransactions(transactions) {
    let totalIncome  = 0;
    let totalExpense = 0;
    const methodTotals = { cash: 0, yappy: 0, card: 0 };

    transactions.forEach(t => {
        const amount = parseFloat(t.amount || 0);
        if (t.type === 'income') {
            totalIncome += amount;
            const method = (t.payment_method || t.method || 'cash').toLowerCase();
            if (methodTotals[method] !== undefined) {
                methodTotals[method] += amount;
            } else {
                methodTotals['cash'] += amount;
            }
        } else if (t.type === 'expense') {
            totalExpense += amount;
        }
    });

    const balance = totalIncome - totalExpense;

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatCurrency(val);
    };
    setEl('total-income',  totalIncome);
    setEl('total-expense', totalExpense);
    setEl('total-balance', balance);

    const balanceEl = document.getElementById('total-balance');
    if (balanceEl) {
        balanceEl.style.color = balance >= 0 ? 'var(--success)' : '#ef4444';
    }

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

    renderPaymentChart(methodTotals);
}

// =============================
// GRÁFICO
// =============================
function renderPaymentChart(methodTotals) {
    const canvas = document.getElementById('payment-method-chart');
    if (!canvas) return;
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
    if (paymentChart) { paymentChart.destroy(); paymentChart = null; }
    const total = methodTotals.cash + methodTotals.yappy + methodTotals.card;
    if (total === 0) {
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
// TRANSACCIONES - CON CATEGORÍA PRIMERO Y CLICK PARA DETALLES
// =============================

// Variable para almacenar transacciones actuales
let currentTransactions = [];

async function loadTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:1rem;">Cargando...</p>';

    try {
        const dateFrom = document.getElementById('finance-date-from')?.value;
        const dateTo   = document.getElementById('finance-date-to')?.value;

        let query = db.from('transactions').select('*').order('created_at', { ascending: false }).limit(100);
        if (dateFrom) query = query.gte('shift_date', dateFrom);
        if (dateTo)   query = query.lte('shift_date', dateTo);

        const { data, error } = await query;

        if (error) {
            // Fallback
            let q2 = db.from('transactions').select('*').order('created_at', { ascending: false }).limit(100);
            if (dateFrom) q2 = q2.gte('created_at', dateFrom + 'T00:00:00+00:00');
            if (dateTo)   q2 = q2.lte('created_at', dateTo   + 'T23:59:59+00:00');
            const { data: d2, error: e2 } = await q2;
            if (e2) throw e2;
            currentTransactions = d2 || [];
            renderTransactions(currentTransactions, container);
            return;
        }

        currentTransactions = data || [];
        renderTransactions(currentTransactions, container);

    } catch (error) {
        console.error('Error loading transactions:', error);
        container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:1rem;">Error cargando transacciones</p>';
    }
}

// Mapeo de categorías a nombres amigables e iconos
const categoryMap = {
    'reservation': { name: 'Reserva', icon: '🏨', color: '#0d9488' },
    'supplies': { name: 'Suministros', icon: '📦', color: '#6b7280' },
    'food': { name: 'Comida', icon: '🍽️', color: '#f43f5e' },
    'maintenance': { name: 'Mantenimiento', icon: '🔧', color: '#f59e0b' },
    'salary': { name: 'Sueldos', icon: '💼', color: '#3b82f6' },
    'water': { name: 'Agua', icon: '💧', color: '#06b6d4' },
    'electricity': { name: 'Luz', icon: '⚡', color: '#eab308' },
    'trash': { name: 'Basura', icon: '🗑️', color: '#78716c' },
    'fuel': { name: 'Combustible', icon: '⛽', color: '#f97316' },
    'landline': { name: 'Móvil Fijo', icon: '📞', color: '#6366f1' },
    'mobile': { name: 'Móvil', icon: '📱', color: '#8b5cf6' },
    'other': { name: 'Otro', icon: '📋', color: '#9ca3af' },
    'manual_entry': { name: 'Ingreso Manual', icon: '💵', color: '#10b981' },
    'cancellation_refund': { name: 'Reembolso', icon: '↩️', color: '#ef4444' }
};

function renderTransactions(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:2rem;">Sin transacciones en este período</p>';
        return;
    }

    const isAdmin = currentProfile?.role === 'admin';
    
    container.innerHTML = '';
    data.forEach((t, index) => {
        const isIncome   = t.type === 'income';
        const amount     = parseFloat(t.amount || 0);
        
        // CORRECCIÓN: Categoría primero, destacada
        const categoryInfo = categoryMap[t.category] || { name: t.category || 'Otro', icon: '📋', color: '#9ca3af' };
        const method     = (t.payment_method || t.method || '').toLowerCase();
        const methodIcon = method === 'yappy' ? '📱' : method === 'card' ? '💳' : '💵';
        const color      = isIncome ? '#059669' : '#dc2626';
        const sign       = isIncome ? '+' : '-';
        
        // Crear elemento de transacción clickeable
        const div = document.createElement('div');
        div.className = 'transaction-item';
        div.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e5e7eb;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        div.onmouseenter = () => {
            div.style.transform = 'translateY(-2px)';
            div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        };
        div.onmouseleave = () => {
            div.style.transform = 'translateY(0)';
            div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        };
        div.onclick = () => showTransactionDetail(t);
        
        div.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.25rem;">${categoryInfo.icon}</span>
                    <span style="font-weight: 700; color: ${categoryInfo.color}; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.02em;">
                        ${categoryInfo.name}
                    </span>
                </div>
                <span style="font-weight: 700; color: ${color}; font-size: 1.125rem; font-family: 'DM Mono', monospace;">
                    ${sign}$${amount.toFixed(2)}
                </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid #f3f4f6;">
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #6b7280;">
                    <span style="display: flex; align-items: center; gap: 0.25rem;">
                        ${isIncome ? '🟢' : '🔴'} ${isIncome ? 'Ingreso' : 'Egreso'}
                    </span>
                    <span>•</span>
                    <span>${formatDateTime(t.created_at)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    ${t.auto_cash ? '<span style="font-size: 0.625rem; background: #d1fae5; color: #065f46; padding: 0.125rem 0.375rem; border-radius: 9999px; font-weight: 600;">💵 Auto</span>' : ''}
                    <span style="font-size: 0.875rem;">${methodIcon}</span>
                </div>
            </div>
            ${isAdmin ? `
                <button onclick="event.stopPropagation(); deleteTransaction('${t.id}')" 
                    style="position: absolute; top: 0.5rem; right: 0.5rem; background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0.25rem; opacity: 0; transition: opacity 0.2s;"
                    onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"
                    title="Eliminar">🗑️</button>
            ` : ''}
        `;
        
        // Posicionamiento relativo para el botón de eliminar
        div.style.position = 'relative';
        
        container.appendChild(div);
    });
}

// =============================
// NUEVO: MOSTRAR DETALLE DE TRANSACCIÓN EN MODAL
// =============================
function showTransactionDetail(transaction) {
    const modal = document.getElementById('transaction-detail-modal');
    if (!modal) return;
    
    const isIncome = transaction.type === 'income';
    const categoryInfo = categoryMap[transaction.category] || { name: transaction.category || 'Otro', icon: '📋', color: '#9ca3af' };
    const amount = parseFloat(transaction.amount || 0);
    
    // Header
    const header = document.getElementById('trans-detail-header');
    header.className = `transaction-detail-header ${isIncome ? 'income' : 'expense'}`;
    
    // Tipo badge
    const typeBadge = document.getElementById('trans-detail-type-badge');
    typeBadge.textContent = isIncome ? '🟢 INGRESO' : '🔴 EGRESO';
    typeBadge.style.color = isIncome ? '#059669' : '#dc2626';
    
    // Monto
    const amountEl = document.getElementById('trans-detail-amount');
    amountEl.textContent = (isIncome ? '+' : '-') + '$' + amount.toFixed(2);
    amountEl.className = `transaction-amount ${isIncome ? 'income' : 'expense'}`;
    
    // Categoría
    const categoryEl = document.getElementById('trans-detail-category');
    categoryEl.innerHTML = `<span style="font-size: 1.5rem; margin-right: 0.5rem;">${categoryInfo.icon}</span>${categoryInfo.name}`;
    categoryEl.style.color = categoryInfo.color;
    
    // Fecha y hora (convertir de UTC a Panamá)
    const dateObj = dateFromUTC(transaction.created_at);
    document.getElementById('trans-detail-date').textContent = formatDateToPanama(dateObj);
    document.getElementById('trans-detail-time').textContent = new Intl.DateTimeFormat('es-PA', {
        timeZone: 'America/Panama',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(dateObj) + ' (UTC-5)';
    
    // Método de pago
    const method = (transaction.payment_method || transaction.method || 'cash').toLowerCase();
    const methodText = method === 'yappy' ? '📱 Yappy' : method === 'card' ? '💳 Tarjeta de crédito' : '💵 Efectivo';
    document.getElementById('trans-detail-method').textContent = methodText;
    
    // Descripción
    document.getElementById('trans-detail-description').textContent = transaction.description || 'Sin descripción';
    
    // Badge de auto-caja
    const autoCashContainer = document.getElementById('trans-detail-auto-cash-container');
    if (transaction.auto_cash || (isIncome && method === 'cash' && transaction.category === 'reservation_payment')) {
        autoCashContainer.classList.remove('hidden');
    } else {
        autoCashContainer.classList.add('hidden');
    }
    
    // Configurar botón de imprimir
    const printBtn = document.getElementById('trans-detail-print-btn');
    printBtn.onclick = () => {
        window.print();
    };
    
    // Mostrar modal
    document.getElementById('modal-overlay')?.classList.remove('hidden');
    modal.classList.remove('hidden');
}

function closeTransactionDetailModal() {
    const modal = document.getElementById('transaction-detail-modal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('modal-overlay')?.classList.add('hidden');
}

// =============================
// ELIMINAR TRANSACCIÓN (ADMIN)
// =============================
async function deleteTransaction(id) {
    if (!confirm('¿Eliminar este movimiento permanentemente?')) return;
    try {
        const { error } = await db.from('transactions').delete().eq('id', id);
        if (error) throw error;
        showToast('Movimiento eliminado', 'success');
        await loadFinanceSummary();
        await loadTransactions();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error al eliminar: ' + error.message, 'error');
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
        // CORRECCIÓN: Usar fecha de Panamá
        const today = getTodayInPanama();
        const { error } = await db.from('transactions').insert({
            type,
            amount,
            category,
            payment_method: method,
            description,
            created_by: currentUser.id,
            shift_date: today,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        showToast('Movimiento guardado', 'success');
        closeModal();
        document.getElementById('trans-amount').value = '';
        document.getElementById('trans-description').value = '';
        await loadFinanceSummary();
        await loadTransactions();
    } catch (error) {
        console.error('Error saving transaction:', error);
        showToast(error.message || 'Error al guardar', 'error');
    }
}

// =============================
// EXPORTAR A EXCEL (SheetJS)
// =============================
async function exportFinancesToExcel() {
    const dateFrom = document.getElementById('finance-date-from')?.value;
    const dateTo   = document.getElementById('finance-date-to')?.value;

    if (!dateFrom || !dateTo) {
        showToast('Selecciona un rango de fechas para exportar', 'error');
        return;
    }

    const btn = document.getElementById('export-excel-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Exportando...'; }

    try {
        if (typeof XLSX === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        let query = db.from('transactions').select('*').order('created_at', { ascending: true });
        if (dateFrom) query = query.gte('shift_date', dateFrom);
        if (dateTo)   query = query.lte('shift_date', dateTo);

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []).map(t => ({
            'Fecha': t.created_at
                ? formatDateTime(t.created_at)
                : '--',
            'Descripción': t.description || t.category || '',
            'Tipo': t.type === 'income' ? 'Ingreso' : 'Egreso',
            'Categoría': (categoryMap[t.category]?.name || t.category || ''),
            'Método de pago': t.payment_method || t.method || '',
            'Monto': parseFloat(t.amount || 0)
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');

        const fileName = `finanzas_${dateFrom}_a_${dateTo}.xlsx`;
        XLSX.writeFile(wb, fileName);
        showToast('Archivo Excel descargado', 'success');

    } catch (err) {
        console.error('Error exportando Excel:', err);
        showToast('Error al exportar: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '⬇ Exportar Excel'; }
    }
}

// =============================
// EXPORTS
// =============================
window.loadFinances            = loadFinances;
window.loadCashBalance         = loadCashBalance;
window.registerCashIncome      = registerCashIncome;
window.adjustCashBalance       = adjustCashBalance;
window.loadTransactions        = loadTransactions;
window.deleteTransaction       = deleteTransaction;
window.showNewTransactionModal = showNewTransactionModal;
window.exportFinancesToExcel   = exportFinancesToExcel;
window.showTransactionDetail   = showTransactionDetail;
window.closeTransactionDetailModal = closeTransactionDetailModal;
