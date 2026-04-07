const SUPABASE_URL = 'https://zgqzwiicunsckopmsrti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncXp3aWljdW5zY2tvcG1zcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODA0MDksImV4cCI6MjA5MDU1NjQwOX0.64EymmGBVG5glWZyaNDxM_bLVTz-x4d1zycHsaoC9pc';

window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// HELPERS DE ZONA HORARIA PANAMÁ (UTC-5)
// =====================================================

const PANAMA_OFFSET = -5;

function dateToUTC(localDateString) {
    if (!localDateString) return null;
    const localDate = new Date(localDateString + 'T00:00:00');
    const utcDate = new Date(localDate.getTime() - (PANAMA_OFFSET * 60 * 60 * 1000));
    return utcDate.toISOString();
}

function dateFromUTC(utcDateString) {
    if (!utcDateString) return null;
    const utcDate = new Date(utcDateString);
    const panamaDate = new Date(utcDate.getTime() + (PANAMA_OFFSET * 60 * 60 * 1000));
    return panamaDate;
}

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

function getTodayInPanama() {
    // Use 'en-CA' locale which reliably outputs YYYY-MM-DD format
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

window.dateToUTC = dateToUTC;
window.dateFromUTC = dateFromUTC;
window.formatDateToPanama = formatDateToPanama;
window.getTodayInPanama = getTodayInPanama;
window.PANAMA_OFFSET = PANAMA_OFFSET;

// =====================================================
// SISTEMA DE CAJA - FUNCIÓN CENTRALIZADA Y ROBUSTA
// =====================================================

window.addCashIncome = async function(amount, reason = 'Ingreso en efectivo', source = 'manual', relatedId = null) {
    try {
        if (!amount || amount <= 0) {
            throw new Error('Monto inválido');
        }

        const { data: { user } } = await window.db.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const today = getTodayInPanama();
        const now = new Date().toISOString();

        const { data: currentCash, error: cashError } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cashError && cashError.code !== 'PGRST116') throw cashError;

        const previousBalance = currentCash?.new_balance || 0;
        const newBalance = previousBalance + amount;

        const { data: cashRecord, error: insertCashError } = await window.db
            .from('cash_register')
            .insert({
                previous_balance: previousBalance,
                new_balance: newBalance,
                difference: amount,
                reason: reason,
                adjusted_by: user.id
            })
            .select()
            .single();

        if (insertCashError) throw insertCashError;

        const { error: transError } = await window.db
            .from('transactions')
            .insert({
                type: 'income',
                category: source === 'reservation' ? 'reservation' : 'manual_entry',
                amount: amount,
                payment_method: 'cash',
                description: reason,
                shift_date: today,
                created_by: user.id,
                created_at: now
            });

        if (transError) {
            console.warn('Error creando transacción de auditoría:', transError);
        }

        return {
            success: true,
            previousBalance,
            newBalance,
            amount,
            cashRecordId: cashRecord.id
        };

    } catch (error) {
        console.error('Error en addCashIncome:', error);
        throw error;
    }
};

window.subtractCashExpense = async function(amount, reason = 'Egreso en efectivo', source = 'expense') {
    try {
        if (!amount || amount <= 0) {
            throw new Error('Monto inválido');
        }

        const { data: { user } } = await window.db.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const today = getTodayInPanama();
        const now = new Date().toISOString();

        const { data: currentCash, error: cashError } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cashError && cashError.code !== 'PGRST116') throw cashError;

        const previousBalance = currentCash?.new_balance || 0;
        
        if (previousBalance < amount) {
            throw new Error(`Fondos insuficientes en caja. Disponible: $${previousBalance.toFixed(2)}`);
        }

        const newBalance = previousBalance - amount;

        const { data: cashRecord, error: insertCashError } = await window.db
            .from('cash_register')
            .insert({
                previous_balance: previousBalance,
                new_balance: newBalance,
                difference: -amount,
                reason: reason,
                adjusted_by: user.id
            })
            .select()
            .single();

        if (insertCashError) throw insertCashError;

        const { error: transError } = await window.db
            .from('transactions')
            .insert({
                type: 'expense',
                category: 'other',
                amount: amount,
                payment_method: 'cash',
                description: reason,
                shift_date: today,
                created_by: user.id,
                created_at: now
            });

        if (transError) {
            console.warn('Error creando transacción de auditoría:', transError);
        }

        return {
            success: true,
            previousBalance,
            newBalance,
            amount: -amount,
            cashRecordId: cashRecord.id
        };

    } catch (error) {
        console.error('Error en subtractCashExpense:', error);
        throw error;
    }
};

window.adjustCashBalance = async function(newAmount, adjustmentReason = 'Ajuste manual') {
    try {
        if (isNaN(newAmount) || newAmount < 0) {
            throw new Error('Monto inválido');
        }

        const { data: { user } } = await window.db.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const today = getTodayInPanama();
        const now = new Date().toISOString();

        const { data: currentCash, error: cashError } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cashError && cashError.code !== 'PGRST116') throw cashError;

        const previousBalance = currentCash?.new_balance || 0;
        const difference = newAmount - previousBalance;

        if (difference === 0) {
            return {
                success: true,
                message: 'No hay diferencia para ajustar',
                previousBalance,
                newBalance: newAmount
            };
        }

        const { data: cashRecord, error: insertCashError } = await window.db
            .from('cash_register')
            .insert({
                previous_balance: previousBalance,
                new_balance: newAmount,
                difference: difference,
                reason: adjustmentReason,
                adjusted_by: user.id
            })
            .select()
            .single();

        if (insertCashError) throw insertCashError;

        // Always register as income type 'cash_adjustment' — it represents the new cash state
        const description = `Actualización de caja: ${adjustmentReason} (anterior: $${previousBalance.toFixed(2)} → nuevo: $${newAmount.toFixed(2)})`;

        const { error: transError } = await window.db
            .from('transactions')
            .insert({
                type: 'income',
                category: 'cash_adjustment',
                amount: newAmount,
                payment_method: 'cash',
                description: description,
                shift_date: today,
                created_by: user.id,
                created_at: now
            });

        if (transError) {
            console.warn('Error creando transacción de ajuste:', transError);
        }

        return {
            success: true,
            previousBalance,
            newBalance: newAmount,
            difference,
            isPositiveAdjustment,
            cashRecordId: cashRecord.id
        };

    } catch (error) {
        console.error('Error en adjustCashBalance:', error);
        throw error;
    }
};

window.getCurrentCashBalance = async function() {
    try {
        const { data, error } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        
        return data?.new_balance || 0;
    } catch (error) {
        console.error('Error obteniendo balance de caja:', error);
        return 0;
    }
};

window.updateCashBalance = async function(amount, operation) {
    console.warn('updateCashBalance está deprecado, usa addCashIncome o subtractCashExpense');
    
    if (operation === 'add') {
        return await window.addCashIncome(amount, 'Actualización manual', 'manual');
    } else {
        return await window.subtractCashExpense(amount, 'Actualización manual', 'expense');
    }
};
