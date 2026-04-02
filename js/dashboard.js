// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('current-date').textContent = `Hoy: ${formatDate(today)}`;
    
    // Cargar datos en paralelo
    await Promise.all([
        loadOccupancy(),
        loadTodayStats(),
        loadAlerts(),
        loadUpcomingReservations()
    ]);
}

async function loadOccupancy() {
    // Contar camas ocupadas vs totales
    const { data: rooms } = await db.from('rooms').select('*');
    const { data: beds } = await db.from('beds').select('*');
    
    // Contar dormitorios (camas individuales) + privadas (habitación completa)
    let totalBeds = 0;
    let occupiedBeds = 0;
    
    // Habitaciones privadas
    rooms.forEach(room => {
        if (room.type === 'private') {
            totalBeds += room.capacity_total;
            if (room.status === 'occupied') {
                occupiedBeds += room.capacity_total;
            }
        }
    });
    
    // Camas de dormitorios
    beds.forEach(bed => {
        totalBeds++;
        if (bed.status === 'occupied') occupiedBeds++;
    });
    
    const percentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    
    document.getElementById('occupancy-percent').textContent = percentage + '%';
    document.getElementById('occupancy-fill').style.width = percentage + '%';
    document.getElementById('occupied-beds').textContent = occupiedBeds;
    document.getElementById('total-beds').textContent = totalBeds;
}

async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    
    // Check-ins hoy
    const { data: checkins } = await db
        .from('reservation
