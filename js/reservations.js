// =====================================================
// RESERVAS - OPTIMIZADO (FIX TIMEZONE)
// =====================================================

// ✅ FUNCIÓN GLOBAL SEGURA
function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60000));
    return local.toISOString().split('T')[0];
}

// ✅ OPCIONAL (para datetime correcto)
function getLocalDateTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - (offset * 60000)).toISOString();
}
