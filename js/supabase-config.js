const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// HELPERS DE ZONA HORARIA PANAMÁ (UTC-5) - NUEVO
// =====================================================

const PANAMA_OFFSET = -5; // UTC-5

/**
 * Convierte fecha local de Panamá a UTC para guardar en Supabase
 * @param {string} localDateString - Fecha en formato YYYY-MM-DD (hora local Panamá)
 * @returns {string} - Fecha ISO en UTC
 */
function dateToUTC(localDateString) {
    if (!localDateString) return null;
    
    // Crear fecha asumiendo medianoche hora local de Panamá
    const localDate = new Date(localDateString + 'T00:00:00');
    
    // Convertir a UTC: Panamá está 5 horas detrás de UTC, así que SUMAMOS 5 horas
    const utcDate = new Date(localDate.getTime() - (PANAMA_OFFSET * 60 * 60 * 1000));
    
    return utcDate.toISOString();
}

/**
 * Convierte fecha UTC de Supabase a hora local de Panamá para display
 * @param {string} utcDateString - Fecha ISO en UTC
 * @returns {Date} - Objeto Date en hora local de Panamá
 */
function dateFromUTC(utcDateString) {
    if (!utcDateString) return null;
    
    const utcDate = new Date(utcDateString);
    
    // Convertir a hora de Panamá: RESTAMOS 5 horas al UTC
    const panamaDate = new Date(utcDate.getTime() + (PANAMA_OFFSET * 60 * 60 * 1000));
    
    return panamaDate;
}

/**
 * Formatea fecha para mostrar en UI (formato Panamá)
 * @param {string|Date} dateInput - Fecha a formatear
 * @returns {string} - Fecha formateada en español
 */
function formatDateToPanama(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    return new Intl.DateTimeFormat('es-PA', {
        timeZone: 'America/Panama',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

/**
 * Obtiene fecha actual en Panamá en formato YYYY-MM-DD
 * @returns {string} - Fecha actual en Panamá
 */
function getTodayInPanama() {
    return new Intl.DateTimeFormat('es-PA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');
}

// Exponer funciones globalmente
window.dateToUTC = dateToUTC;
window.dateFromUTC = dateFromUTC;
window.formatDateToPanama = formatDateToPanama;
window.getTodayInPanama = getTodayInPanama;
window.PANAMA_OFFSET = PANAMA_OFFSET;

// =====================================================
// HELPER PARA ACTUALIZAR CAJA (EXISTENTE - SIN CAMBIOS)
// =====================================================
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
