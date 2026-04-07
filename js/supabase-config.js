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
    return new Intl.DateTimeFormat('es-PA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');
}

window.dateToUTC = dateToUTC;
window.dateFromUTC = dateFromUTC;
window.formatDateToPanama = formatDateToPanama;
window.getTodayInPanama = getTodayInPanama;
window.PANAMA_OFFSET = PANAMA_OFFSET;

// =====================================================
// SISTEMA DE CAJA - FUNCIÓN CENTRALIZADA Y ROBUSTA
// =====================================================

/**
 * Agrega ingreso en efectivo a la caja física
 * Usado cuando: pagos en efectivo de reservas, ingresos manuales
 * 
 * @param {number} amount - Monto a agregar
 * @param {string} reason - Razón del ingreso
 * @param {string} source - Origen: 'reservation', 'manual', 'adjustment'
 * @param {string} relatedId - ID relacionado (reserva, etc.)
 * @returns {Promise<Object>} - Resultado de la operación
 */
window.addCashIncome = async function(amount, reason = 'Ingreso en efectivo', source = 'manual', relatedId = null) {
    try {
        if (!amount || amount <= 0) {
            throw new Error('Monto inválido');
        }

        const { data: { user } } = await window.db.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const today = getTodayInPanama();
        const now = new Date().toISOString();

        // 1. OBTENER BALANCE ACTUAL
        const { data: currentCash, error: cashError } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cashError && cashError.code !== 'PGRST116') throw cashError;

        const previousBalance = currentCash?.new_balance || 0;
        const newBalance = previousBalance + amount;

        // 2. INSERTAR EN CASH_REGISTER (registro físico de caja)
        const { data: cashRecord, error: insertCashError } = await window.db
            .from('cash_register')
            .insert({
                previous_balance: previousBalance,
                new_balance: newBalance,
                difference: amount,
                reason: reason,
                source: source,
                related_id: relatedId,
                created_by: user.id,
                created_at: now
            })
            .select()
            .single();

        if (insertCashError) throw insertCashError;

        // 3. CREAR TRANSACCIÓN PARA AUDITORÍA (finanzas)
        const { error: transError } = await window.db
            .from('transactions')
            .insert({
                type: 'income',
                category: source === 'reservation' ? 'reservation_payment' : 'manual_entry',
                amount: amount,
                payment_method: 'cash',
                description: reason,
                shift_date: today,
                related_cash_register_id: cashRecord.id,
                created_by: user.id,
                created_at: now
            });

        if (transError) {
            console.warn('Error creando transacción de auditoría:', transError);
            // No fallamos la operación principal, solo logueamos
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

/**
 * Resta egreso de la caja física
 * Usado cuando: reembolsos, pagos en efectivo salientes
 * 
 * @param {number} amount - Monto a restar
 * @param {string} reason - Razón del egreso
 * @param {string} source - Origen: 'refund', 'expense', 'adjustment'
 * @returns {Promise<Object>} - Resultado de la operación
 */
window.subtractCashExpense = async function(amount, reason = 'Egreso en efectivo', source = 'expense') {
    try {
        if (!amount || amount <= 0) {
            throw new Error('Monto inválido');
        }

        const { data: { user } } = await window.db.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const today = getTodayInPanama();
        const now = new Date().toISOString();

        // 1. OBTENER BALANCE ACTUAL
        const { data: currentCash, error: cashError } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cashError && cashError.code !== 'PGRST116') throw cashError;

        const previousBalance = currentCash?.new_balance || 0;
        
        // Verificar fondos suficientes
        if (previousBalance < amount) {
            throw new Error(`Fondos insuficientes en caja. Disponible: $${previousBalance.toFixed(2)}, Requerido: $${amount.toFixed(2)}`);
        }

        const newBalance = previousBalance - amount;

        // 2. INSERTAR EN CASH_REGISTER (registro físico de caja - negativo)
        const { data: cashRecord, error: insertCashError } = await window.db
            .from('cash_register')
            .insert({
                previous_balance: previousBalance,
                new_balance: newBalance,
                difference: -amount, // Negativo para egreso
                reason: reason,
                source: source,
                created_by: user.id,
                created_at: now
            })
            .select()
            .single();

        if (insertCashError) throw insertCashError;

        // 3. CREAR TRANSACCIÓN PARA AUDITORÍA
        const { error: transError } = await window.db
            .from('transactions')
            .insert({
                type: 'expense',
                category: source === 'refund' ? 'cancellation_refund' : 'cash_expense',
                amount: amount,
                payment_method: 'cash',
                description: reason,
                shift_date: today,
                related_cash_register_id: cashRecord.id,
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

/**
 * Ajusta el balance de caja manualmente (por admin/dueña)
 * Crea automáticamente una transacción explicativa
 * 
 * @param {number} newAmount - Nuevo monto que debe tener la caja
 * @param {string} adjustmentReason - Razón del ajuste
 * @returns {Promise<Object>} - Resultado de la operación
 */
window.adjustCashBalance = async function(newAmount, adjustmentReason = 'Ajuste manual') {
    try {
        if (isNaN(newAmount) || newAmount < 0) {
            throw new Error('Monto inválido');
        }

        const { data: { user } } = await window.db.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const today = getTodayInPanama();
        const now = new Date().toISOString();

        // 1. OBTENER BALANCE ACTUAL
        const { data: currentCash, error: cashError } = await window.db
            .from('cash_register')
            .select('new_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cashError && cashError.code !== 'PGRST116') throw cashError;

        const previousBalance = currentCash?.new_balance || 0;
        const difference = newAmount - previousBalance;

        // Si no hay diferencia, no hacer nada
        if (difference === 0) {
            return {
                success: true,
                message: 'No hay diferencia para ajustar',
                previousBalance,
                newBalance: newAmount
            };
        }

        // 2. INSERTAR AJUSTE EN CASH_REGISTER
        const { data: cashRecord, error: insertCashError } = await window.db
            .from('cash_register')
            .insert({
                previous_balance: previousBalance,
                new_balance: newAmount,
                difference: difference,
                reason: adjustmentReason,
                source: 'admin_adjustment',
                created_by: user.id,
                created_at: now
            })
            .select()
            .single();

        if (insertCashError) throw insertCashError;

        // 3. CREAR TRANSACCIÓN EXPLICATIVA DEL AJUSTE
        const isPositiveAdjustment = difference > 0;
        const transactionType = isPositiveAdjustment ? 'income' : 'expense';
        const category = isPositiveAdjustment ? 'cash_adjustment_positive' : 'cash_adjustment_negative';
        const description = `Ajuste de caja: ${adjustmentReason}. ${isPositiveAdjustment ? 'Sobrante' : 'Faltante'} detectado en conteo físico.`;

        const { error: transError } = await window.db
            .from('transactions')
            .insert({
                type: transactionType,
                category: category,
                amount: Math.abs(difference),
                payment_method: 'cash',
                description: description,
                shift_date: today,
                related_cash_register_id: cashRecord.id,
                is_cash_adjustment: true, // Flag especial para identificar ajustes
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

/**
 * Obtiene el balance actual de caja
 * @returns {Promise<number>} - Balance actual
 */
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

// =====================================================
// FUNCIÓN LEGACY (para compatibilidad)
// =====================================================
window.updateCashBalance = async function(amount, operation) {
    console.warn('updateCashBalance está deprecado, usa addCashIncome o subtractCashExpense');
    
    if (operation === 'add') {
        return await window.addCashIncome(amount, 'Actualización manual', 'manual');
    } else {
        return await window.subtractCashExpense(amount, 'Actualización manual', 'expense');
    }
};
