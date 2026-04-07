// =====================================================
// FINANZAS / CAJA - COMPLETO CON MEJORAS UX PREMIUM
// =====================================================

let paymentChart = null;

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
        if (el) {
            // Animate the balance
            const start = parseFloat(el.textContent.replace(/[^0-9.-]+/g,"")) || 0;
            animateCurrency(el, start, balance, 1000);
        }
    } catch (error) {
        console.error('Error loading cash:', error);
    }
}

function animateCurrency(element, start, end, duration) {
    const range = end - start;
    const minTimer = 50;
    let stepTime = Math.abs(Math.floor(duration / range));
    stepTime = Math.max(stepTime, minTimer);
    
    let startTime = new Date().getTime();
    let endTime = startTime + duration;
    let timer;
    
    function run() {
        let now = new Date().getTime();
        let remaining = Math.max((endTime - now) / duration, 0);
        let value = end - (remaining * range);
        element.textContent = formatCurrency(value);
        if (value == end) {
            clearInterval(timer);
        }
    }
    
    timer = setInterval(run, stepTime);
    run();
}

async function registerCashIncome() {
    const amount = parseFloat(document.getElementById('cash-income-amount')?.value);
    const concept = document.getElementById('cash-income-concept')?.value?.trim();
    
    if (!amount || amount <= 0) {
        showToast('Monto inválido', 'error');
        return;
    }
    
    if (!concept) {
        showToast('Ingresa un concepto', 'error');
        return;
    }
    
    try {
        await window.addCashIncome(amount, concept, 'manual_entry', null);
        showToast('✅ Ingreso registrado correctamente', 'success');
        document.getElementById('cash-income-amount').value = '';
        document.getElementById('cash-income-concept').value = '';
        await loadCashBalance();
        await loadCashHistory();
    } catch (error) {
        showToast(error.message || 'Error al registrar ingreso', 'error');
    }
}

async function adjustCashBalance() {
    const newAmount = parseFloat(document.getElementById('cash-adjust-amount')?.value);
    const reason = document.getElementById('cash-adjust-reason')?.value?.trim();
    
    if (isNaN(newAmount) || newAmount < 0) {
        showToast('Monto inválido', 'error');
        return;
    }
    
    if (!reason) {
        showToast('Ingresa una razón para el ajuste', 'error');
        return;
    }
    
    try {
        const result = await window.adjustCashBalance(newAmount, reason);
        if (result.message) {
            showToast(result.message, 'info');
        } else {
            const diff = result.difference;
            const sign = diff >= 0 ? '+' : '';
            showToast(`✅ Caja ajustada. Diferencia: ${sign}$${diff.toFixed(2)}`, 'success');
        }
        document.getElementById('cash-adjust-amount').value = '';
        document.getElementById('cash-adjust-reason').value = '';
        await loadCashBalance();
        await loadCashHistory();
    } catch (error) {
        showToast(error.message || 'Error al ajustar caja', 'error');
    }
}

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
            container.innerHTML = '<p style="color: var(--gray-500); font-size: 0.875rem; text-align: center; padding: var(--space-4);">Sin movimientos recientes</p>';
            return;
        }
        
        let html = '';
        data.forEach((adj, index) => {
            const fecha = adj.created_at ? formatDateTime(adj.created_at) : '--';
            const isPositive = (adj.difference || 0) >= 0;
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; border-bottom: 1px solid var(--gray-100); font-size: 0.875rem; animation-delay: ${index * 0.05}s;">
                    <div>
                        <div style="color: var(--gray-600); font-size: 0.75rem; margin-bottom: 2px;">${fecha}</div>
                        <div style="color: var(--gray-800); font-weight: 500;">${esc(adj.reason || 'Ajuste')}</div>
                    </div>
                    <div style="font-weight: 700; color: ${isPositive ? 'var(--success)' : 'var(--danger)'}; font-family: var(--font-sans);">
                        ${isPositive ? '+' : ''}$${Number(adj.difference || 0).toFixed(2)}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

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

async function loadFinanceSummary() {
    try {
        const dateFrom = document.getElementById('finance-date-from')?.value;
        const dateTo   = document.getElementById('finance-date-to')?.value;

        let query = db.from('transactions').select('*');
        
        if (dateFrom) query = query.gte('shift_date', dateFrom);
        if (dateTo)   query = query.lte('shift_date', dateTo);
        
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.warn('Error con shift_date, usando fallback:', error.message);
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
        if (el) {
            const current = parseFloat(el.textContent.replace(/[^0-9.-]+/g,"")) || 0;
            animateCurrency(el, current, val, 800);
        }
    };
    
    setEl('total-income',  totalIncome);
    setEl('total-expense', totalExpense);
    setEl('total-balance', balance);

    const balanceEl = document.getElementById('total-balance');
    if (balanceEl) {
        balanceEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    const totalsContainer = document.getElementById('payment-method-totals');
    if (totalsContainer) {
        totalsContainer.innerHTML = `
            <div style="background: var(--success-light); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid rgba(16, 185, 129, 0.2); min-width: 110px; flex-shrink: 0;">
                <div style="font-size: 0.75rem; color: #065f46; font-weight: 600; margin-bottom: var(--space-1);">💵 Efectivo</div>
                <div style="font-weight: 800; color: #065f46; font-family: var(--font-sans); font-size: 1.125rem; white-space: nowrap;">${formatCurrency(methodTotals.cash)}</div>
            </div>
            <div style="background: var(--info-light); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid rgba(59, 130, 246, 0.2); min-width: 110px; flex-shrink: 0;">
                <div style="font-size: 0.75rem; color: #1e40af; font-weight: 600; margin-bottom: var(--space-1);">📱 Yappy</div>
                <div style="font-weight: 800; color: #1e40af; font-family: var(--font-sans); font-size: 1.125rem; white-space: nowrap;">${formatCurrency(methodTotals.yappy)}</div>
            </div>
            <div style="background: var(--warning-light); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid rgba(245, 158, 11, 0.2); min-width: 110px; flex-shrink: 0;">
                <div style="font-size: 0.75rem; color: #92400e; font-weight: 600; margin-bottom: var(--space-1);">💳 Tarjeta</div>
                <div style="font-weight: 800; color: #92400e; font-family: var(--font-sans); font-size: 1.125rem; white-space: nowrap;">${formatCurrency(methodTotals.card)}</div>
            </div>
        `;
        totalsContainer.style.display = 'flex';
        totalsContainer.style.overflowX = 'auto';
        totalsContainer.style.gap = 'var(--space-3)';
        totalsContainer.style.paddingBottom = 'var(--space-2)';
    }

    renderPaymentChart(methodTotals);
}

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
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '70%',
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        family: "'Plus Jakarta Sans', sans-serif",
                        size: 13
                    },
                    bodyFont: {
                        family: "'Plus Jakarta Sans', sans-serif",
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

let currentTransactions = [];

async function loadTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    container.innerHTML = `
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg);"></div>
    `;

    try {
        const dateFrom = document.getElementById('finance-date-from')?.value;
        const dateTo   = document.getElementById('finance-date-to')?.value;

        let query = db.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
        if (dateFrom) query = query.gte('shift_date', dateFrom);
        if (dateTo)   query = query.lte('shift_date', dateTo);

        const { data, error } = await query;

        if (error) {
            let q2 = db.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
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
        container.innerHTML = '<p style="color:var(--danger);text-align:center;padding:var(--space-6);">Error cargando transacciones</p>';
    }
}

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
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-10) var(--space-4); color: var(--gray-400);">
                <div style="font-size: 3rem; margin-bottom: var(--space-3);">📊</div>
                <div style="font-weight: 600;">Sin transacciones en este período</div>
            </div>
        `;
        return;
    }

    const isAdmin = currentProfile?.role === 'admin';
    
    container.innerHTML = '';
    data.forEach((t, index) => {
        const isIncome   = t.type === 'income';
        const amount     = parseFloat(t.amount || 0);
        
        const categoryInfo = categoryMap[t.category] || { name: t.category || 'Otro', icon: '📋', color: '#9ca3af' };
        const method     = (t.payment_method || t.method || '').toLowerCase();
        const methodIcon = method === 'yappy' ? '📱' : method === 'card' ? '💳' : '💵';
        const color      = isIncome ? '#059669' : '#dc2626';
        const sign       = isIncome ? '+' : '-';
        
        const div = document.createElement('div');
        div.className = 'transaction-item';
        div.style.animationDelay = `${index * 0.03}s`;
        div.onclick = () => showTransactionDetail(t);
        
        div.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-3);">
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <span style="font-size: 1.5rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: ${categoryInfo.color}15; border-radius: var(--radius-md);">
                        ${categoryInfo.icon}
                    </span>
                    <div>
                        <div style="font-weight: 700; color: ${categoryInfo.color}; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.02em;">
                            ${categoryInfo.name}
                        </div>
                        <div style="font-size: 0.8125rem; color: var(--gray-500); margin-top: 2px;">
                            ${formatDateTime(t.created_at)}
                        </div>
                    </div>
                </div>
                <span style="font-weight: 800; color: ${color}; font-size: 1.125rem; font-family: var(--font-sans); font-feature-settings: 'tnum';">
                    ${sign}${formatCurrency(amount).replace('$', '')}
                </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--space-3); border-top: 1px solid var(--gray-100);">
                <div style="display: flex; align-items: center; gap: var(--space-2); font-size: 0.75rem; color: var(--gray-500);">
                    <span style="display: flex; align-items: center; gap: var(--space-1); font-weight: 600;">
                        ${isIncome ? '🟢' : '🔴'} ${isIncome ? 'Ingreso' : 'Egreso'}
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                    ${t.auto_cash ? '<span style="font-size: 0.625rem; background: var(--success-light); color: #065f46; padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.2);">💵 Auto</span>' : ''}
                    <span style="font-size: 1rem;">${methodIcon}</span>
                    ${isAdmin ? `<button onclick="event.stopPropagation(); deleteTransaction('${t.id}')" style="background: none; border: none; cursor: pointer; padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); color: var(--danger); font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 4px; transition: background 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Eliminar
                    </button>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

function showTransactionDetail(transaction) {
    const modal = document.getElementById('transaction-detail-modal');
    if (!modal) return;
    
    const isIncome = transaction.type === 'income';
    const categoryInfo = categoryMap[transaction.category] || { name: transaction.category || 'Otro', icon: '📋', color: '#9ca3af' };
    const amount = parseFloat(transaction.amount || 0);
    
    const header = document.getElementById('trans-detail-header');
    header.className = `transaction-detail-header ${isIncome ? 'income' : 'expense'}`;
    
    const typeBadge = document.getElementById('trans-detail-type-badge');
    typeBadge.textContent = isIncome ? 'INGRESO' : 'EGRESO';
    typeBadge.style.color = isIncome ? '#059669' : '#dc2626';
    
    const amountEl = document.getElementById('trans-detail-amount');
    amountEl.textContent = (isIncome ? '+' : '-') + formatCurrency(amount);
    amountEl.className = `transaction-amount ${isIncome ? 'income' : 'expense'}`;
    
    const categoryEl = document.getElementById('trans-detail-category');
    categoryEl.innerHTML = `<span style="font-size: 1.75rem; margin-right: var(--space-2);">${categoryInfo.icon}</span>${categoryInfo.name}`;
    categoryEl.style.color = categoryInfo.color;
    
    const dateObj = dateFromUTC(transaction.created_at);
    document.getElementById('trans-detail-date').textContent = formatDateToPanama(dateObj);
    document.getElementById('trans-detail-time').textContent = new Intl.DateTimeFormat('es-PA', {
        timeZone: 'America/Panama',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(dateObj) + ' (UTC-5)';
    
    const method = (transaction.payment_method || transaction.method || 'cash').toLowerCase();
    const methodText = method === 'yappy' ? '📱 Yappy' : method === 'card' ? '💳 Tarjeta de crédito/débito' : '💵 Efectivo';
    document.getElementById('trans-detail-method').textContent = methodText;
    
    document.getElementById('trans-detail-description').textContent = transaction.description || 'Sin descripción';
    
    const autoCashContainer = document.getElementById('trans-detail-auto-cash-container');
    if (transaction.auto_cash || (isIncome && method === 'cash' && transaction.category === 'reservation_payment')) {
        autoCashContainer.classList.remove('hidden');
    } else {
        autoCashContainer.classList.add('hidden');
    }
    
    const printBtn = document.getElementById('trans-detail-print-btn');
    printBtn.onclick = () => {
        window.print();
    };
    
    document.getElementById('modal-overlay')?.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeTransactionDetailModal() {
    const modal = document.getElementById('transaction-detail-modal');
    if (modal) {
        modal.style.animation = 'slideDownModal 0.3s ease forwards';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.animation = '';
            document.getElementById('modal-overlay')?.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }
}

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
        showToast('✅ Movimiento guardado', 'success');
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

async function exportFinancesToExcel() {
    const dateFrom = document.getElementById('finance-date-from')?.value;
    const dateTo   = document.getElementById('finance-date-to')?.value;

    if (!dateFrom || !dateTo) {
        showToast('Selecciona un rango de fechas', 'error');
        return;
    }

    const btn = document.getElementById('export-excel-btn');
    if (btn) { 
        btn.disabled = true; 
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
            </svg>
            Exportando...
        `;
    }

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
            'Fecha': t.created_at ? formatDateTime(t.created_at) : '--',
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
        showToast('✅ Archivo Excel descargado', 'success');

    } catch (err) {
        console.error('Error exportando Excel:', err);
        showToast('Error al exportar: ' + err.message, 'error');
    } finally {
        if (btn) { 
            btn.disabled = false; 
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Exportar Excel
            `;
        }
    }
}

window.loadFinances = loadFinances;
window.loadCashBalance = loadCashBalance;
window.registerCashIncome = registerCashIncome;
window.adjustCashBalance = adjustCashBalance;
window.loadTransactions = loadTransactions;
window.deleteTransaction = deleteTransaction;
window.showNewTransactionModal = showNewTransactionModal;
window.exportFinancesToExcel = exportFinancesToExcel;
window.showTransactionDetail = showTransactionDetail;
window.closeTransactionDetailModal = closeTransactionDetailModal;
