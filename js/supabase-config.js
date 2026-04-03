const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper para actualizar caja (usado por reservations.js y finances.js)
window.updateCashBalance = async function(amount, operation) {
    try {
        const { data: current } = await window.db
            .from('cash_register')
            .select('current_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        const currentBalance = current?.current_balance || 0;
        const newBalance = operation === 'add' 
            ? currentBalance + amount 
            : currentBalance - amount;
            
        await window.db.from('cash_register').insert({
            previous_balance: currentBalance,
            new_balance: newBalance,
            difference: operation === 'add' ? amount : -amount,
            reason: 'Movimiento automático',
            adjusted_by: (await window.db.auth.getUser()).data.user.id,
            created_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error updating cash balance:', error);
    }
};
