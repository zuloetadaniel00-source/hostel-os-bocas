async function loadFinances() {
    const date = document.getElementById('finance-date')?.value;
    if (!date) return;
    
    try {
        const { data:transactions, error } = await supabase.from('transactions').select('*').eq('shift_date',date).is('deleted_at',null).order('created_at',{ascending:false});
        if (error) throw error;
        
        const income = transactions?.filter(t => t.type==='income').reduce((s,t) => s+parseFloat(t.amount||0),0) || 0;
        const expense = transactions?.filter(t => t.type==='expense').reduce((s,t) => s+parseFloat(t.amount||0),0) || 0;
        
        document.getElementById('total-income')?.textContent = formatCurrency(income);
        document.getElementById('total-expense')?.textContent = formatCurrency(expense);
        document.getElementById('total-balance')?.textContent = formatCurrency(income-expense);
        
        const list = document.getElementById('transactions-list');
        if (!list) return;
        
        if (!transactions?.length) { list.innerHTML = '<p class="text-muted">Sin movimientos</p>'; return; }
        
        list.innerHTML = transactions.map(t => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-desc">${esc(t.description)}</div>
                    <div class="transaction-meta">${t.category} • ${t.payment_method}</div>
                </div>
                <span class="transaction-amount ${t.type}">${t.type==='income'?'+':'-'} ${formatCurrency(t.amount)}</span>
            </div>
        `).join('');
    } catch(err) { console.error('Error finanzas:',err); }
}

function showNewTransactionModal() {
    showModal('new-transaction-modal');
}

document.getElementById('new-transaction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const type = document.querySelector('input[name="trans-type"]:checked')?.value;
        const { error } = await supabase.from('transactions').insert([{
            type: type,
            category: document.getElementById('trans-category')?.value,
            amount: document.getElementById('trans-amount')?.value,
            payment_method: document.getElementById('trans-method')?.value,
            description: document.getElementById('trans-description')?.value,
            shift_date: document.getElementById('finance-date')?.value,
            created_by: currentUser.id
        }]);
        if (error) throw error;
        showToast('Movimiento registrado','success');
        closeModal();
        loadFinances();
    } catch(err) { showToast('Error: '+err.message,'error'); }
});

function closeShift() {
    if (!confirm('¿Cerrar caja del día?')) return;
    showToast('Caja cerrada (función completa en desarrollo)','success');
}
