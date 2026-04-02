// =====================================================
// FINANZAS / CAJA
// =====================================================
async function loadFinances() {
    const date = document.getElementById('finance-date').value;
    
    const { data: transactions } = await db
        .from('transactions')
        .select('*')
        .eq('shift_date', date)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    
    const income = transactions
        ?.filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
    const expense = transactions
        ?.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
    document.getElementById('total-income').textContent = formatCurrency(income);
    document.getElementById('total-expense').textContent = formatCurrency(expense);
    document.getElementById('total-balance').textContent = formatCurrency(income - expense);
    
    const list = document.getElementById('transactions-list');
    if (!transactions || transactions.length === 0) {
        list.innerHTML = '<p class="text-muted">No hay movimientos este día</p>';
        return;
    }
    
    list.innerHTML = '';
    transactions.forEach(t => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-desc">${esc(t.description)}</div>
                <div class="transaction-meta">${t.category} • ${t.payment_method}</div>
            </div>
            <span class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
            </span>
        `;
        list.appendChild(item);
    });
}

function showNewTransactionModal() {
    showModal('new-transaction-modal');
}

document.getElementById('new-transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const type = document.querySelector('input[name="trans-type"]:checked').value;
    
    const { error } = await db
        .from('transactions')
        .insert([{
            type: type,
            category: document.getElementById('trans-category').value,
            amount: document.getElementById('trans-amount').value,
            payment_method: document.getElementById('trans-method').value,
            description: document.getElementById('trans-description').value,
            shift_date: document.getElementById('finance-date').value,
            created_by: currentUser.id
        }]);
    
    if (error) {
        showToast('Error al registrar: ' + error.message, 'error');
    } else {
        showToast('Movimiento registrado', 'success');
        closeModal();
        loadFinances();
    }
});

function closeShift() {
    if (!confirm('¿Cerrar la caja del día? Esta acción no se puede deshacer.')) return;
    
    // Aquí iría la lógica de cierre de caja
    showToast('Caja cerrada exitosamente', 'success');
}
