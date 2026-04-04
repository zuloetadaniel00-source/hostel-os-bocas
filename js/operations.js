// =====================================================
// OPERACIONES / TAREAS
// CAMBIO 2: Agregar tarea (solo admin)
// CAMBIO 3: Completar tarea con nombre de quien la realizó
// CAMBIO 4: Historial de limpieza (solo admin)
// CAMBIO 5: Sección de Reportes
// =====================================================

// =============================
// TAREAS PENDIENTES
// =============================
async function loadTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = '<p>Cargando...</p>';
    
    try {
        const { data: tasks, error } = await db
            .from('tasks')
            .select('*, room:room_id(number, name), assigned:assigned_to(full_name)')
            .eq('status', 'pending')
            .order('priority', { ascending: false })
            .order('due_date');
            
        if (error) throw error;
        
        const isAdmin = currentProfile?.role === 'admin';

        // CAMBIO 2: Botón visible solo para admin
        const addBtnContainer = document.getElementById('add-task-btn-container');
        if (addBtnContainer) {
            addBtnContainer.innerHTML = isAdmin
                ? `<button onclick="showAddTaskModal()" class="btn btn-primary">+ Agregar Tarea</button>`
                : '';
        }
        
        if (!tasks?.length) {
            list.innerHTML = '<p class="text-muted">Sin tareas pendientes 🎉</p>';
            loadCleaningHistory();
            loadReports();
            return;
        }
        
        list.innerHTML = tasks.map(t => `
            <div class="task-card priority-${t.priority}">
                <div class="task-header">
                    <span class="task-title">${esc(t.title)}</span>
                    <span class="task-room">${esc(t.room?.name || '')}</span>
                </div>
                ${t.description ? `<p class="task-description">${esc(t.description)}</p>` : ''}
                <div class="task-meta">
                    <span>Asignado: ${esc(t.assigned_to_name || t.assigned?.full_name || 'Sin asignar')}</span>
                    <span>Prioridad: ${esc(t.priority)}</span>
                </div>
                <div class="task-actions">
                    <button onclick="showCompleteTaskModal('${t.id}')" class="btn btn-success btn-small">✓ Completar</button>
                    ${isAdmin ? `<button onclick="deleteTask('${t.id}')" class="btn btn-danger btn-small">🗑️ Eliminar</button>` : ''}
                </div>
            </div>
        `).join('');

        loadCleaningHistory();
        loadReports();
        
    } catch (err) {
        console.error('Error tareas:', err);
        list.innerHTML = '<p class="text-muted">Error al cargar</p>';
    }
}

// =============================
// CAMBIO 2: AGREGAR TAREA (ADMIN)
// =============================
function showAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('add-task-form')?.reset();
}

async function saveNewTask() {
    const title       = document.getElementById('new-task-title')?.value?.trim();
    const description = document.getElementById('new-task-description')?.value?.trim() || null;
    const assignedTo  = document.getElementById('new-task-assigned')?.value?.trim();

    // Prioridad: valores válidos en BD → 'low', 'medium', 'high'
    const priorityRaw = document.getElementById('new-task-priority')?.value || 'medium';
    const priorityMap = {
        'low': 'low', 'medium': 'medium', 'high': 'high',
        'baja': 'low', 'media': 'medium', 'alta': 'high',
        'bajo': 'low', 'medio': 'medium', 'alto': 'high'
    };
    const priority = priorityMap[priorityRaw.toLowerCase()] || 'medium';

    // Tipo: valores válidos en BD → 'cleaning_checkout', 'cleaning_daily',
    //       'maintenance', 'laundry', 'inventory', 'other'
    const taskType = document.getElementById('new-task-type')?.value || 'cleaning_daily';

    if (!title || !assignedTo) {
        showToast('Título y "Asignado a" son obligatorios', 'error');
        return;
    }

    try {
        const { error } = await db.from('tasks').insert([{
            title,
            description,
            room_id: null,
            assigned_to_name: assignedTo,
            priority,
            status: 'pending',
            type: taskType,
            due_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            created_by: currentUser.id
        }]);

        if (error) throw error;
        showToast('Tarea creada', 'success');
        closeAddTaskModal();
        loadTasks();
    } catch (err) {
        console.error('Error creando tarea:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// =============================
// CAMBIO 3: COMPLETAR TAREA (con nombre)
// =============================
let pendingCompleteTaskId = null;

function showCompleteTaskModal(taskId) {
    pendingCompleteTaskId = taskId;
    const modal = document.getElementById('complete-task-modal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('completed-by-name');
    if (input) { input.value = ''; input.focus(); }
}

function closeCompleteTaskModal() {
    const modal = document.getElementById('complete-task-modal');
    if (modal) modal.classList.add('hidden');
    const input = document.getElementById('completed-by-name');
    if (input) input.value = '';
    pendingCompleteTaskId = null;
}

async function confirmCompleteTask() {
    const completedByName = document.getElementById('completed-by-name')?.value?.trim();
    if (!completedByName) {
        showToast('Ingresa el nombre de quien realizó la tarea', 'error');
        return;
    }

    try {
        const { error } = await db.from('tasks').update({
            status: 'completed',
            completed_by_name: completedByName,
            completed_at: new Date().toISOString(),
            completed_by: currentUser.id
        }).eq('id', pendingCompleteTaskId);

        if (error) throw error;
        showToast('Tarea completada ✓', 'success');
        closeCompleteTaskModal();
        loadTasks();
    } catch (err) {
        console.error('Error completando tarea:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// =============================
// CAMBIO 4: HISTORIAL DE LIMPIEZA (solo admin)
// =============================
async function loadCleaningHistory() {
    const section = document.getElementById('cleaning-history-section');
    if (!section) return;

    const isAdmin = currentProfile?.role === 'admin';
    if (!isAdmin) { section.classList.add('hidden'); return; }

    section.classList.remove('hidden');
    const list = document.getElementById('cleaning-history-list');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--gray-400);">Cargando historial...</p>';

    try {
        const { data: completed, error } = await db
            .from('tasks')
            .select('*')
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(30);

        if (error) throw error;

        if (!completed?.length) {
            list.innerHTML = '<p class="text-muted">No hay tareas completadas aún.</p>';
            return;
        }

        list.innerHTML = completed.map(t => {
            const completedAt = t.completed_at
                ? new Date(t.completed_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '--';
            return `
                <div class="cleaning-history-card">
                    <div class="cleaning-history-title">🛏️ ${esc(t.title)}</div>
                    <div class="cleaning-history-meta">
                        <span>👤 ${esc(t.completed_by_name || 'Desconocido')}</span>
                        <span>🕐 ${esc(completedAt)}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error historial:', err);
        list.innerHTML = '<p class="text-muted">Error al cargar historial</p>';
    }
}

// =============================
// ELIMINAR TAREA (ADMIN)
// =============================
async function deleteTask(id) {
    if (!confirm('⚠️ ¿Eliminar esta tarea permanentemente? Esta acción no se puede deshacer.')) return;
    try {
        const { error } = await db.from('tasks').delete().eq('id', id);
        if (error) throw error;
        showToast('Tarea eliminada', 'success');
        loadTasks();
    } catch (err) {
        console.error('Error deleting task:', err);
        showToast('Error al eliminar: ' + err.message, 'error');
    }
}

// =============================
// CAMBIO 5: REPORTES
// =============================
async function loadReports() {
    const container = document.getElementById('reports-list');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--gray-400);">Cargando reportes...</p>';

    const isAdmin = currentProfile?.role === 'admin';

    try {
        const { data: reports, error } = await db
            .from('reports')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reports?.length) {
            container.innerHTML = '<p class="text-muted">No hay reportes abiertos.</p>';
            return;
        }

        const urgencyColor = { watch: '#d97706', important: '#059669', urgent: '#dc2626' };
        const urgencyLabel = { watch: '🟡 Tener en cuenta', important: '🟢 Importante', urgent: '🔴 Urgente' };

        container.innerHTML = reports.map(r => {
            const fecha = r.created_at
                ? new Date(r.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '--';
            const color = urgencyColor[r.urgency] || '#6b7280';
            const label = urgencyLabel[r.urgency] || r.urgency;
            return `
                <div class="report-card" style="border-left: 4px solid ${color};">
                    <div class="report-header">
                        <span style="color:${color}; font-weight:600; font-size:0.875rem;">${label}</span>
                        <span style="font-size:0.75rem; color:var(--gray-400);">${esc(fecha)}</span>
                    </div>
                    <div style="font-weight:700; margin: 0.25rem 0;">${esc(r.title)}</div>
                    <div style="font-size:0.875rem; color:var(--gray-600); margin-bottom:0.5rem;">${esc(r.description)}</div>
                    ${r.photo_url ? `<img src="${esc(r.photo_url)}" alt="Foto del reporte" style="max-width:100%;border-radius:var(--radius);max-height:200px;object-fit:cover;margin-bottom:0.5rem;">` : ''}
                    ${isAdmin ? `<button onclick="markReportDone('${r.id}')" class="btn btn-success btn-small">✓ Completado</button>` : ''}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error reportes:', err);
        container.innerHTML = '<p class="text-muted">Error al cargar reportes</p>';
    }
}

function showAddReportModal() {
    const modal = document.getElementById('add-report-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddReportModal() {
    const modal = document.getElementById('add-report-modal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('add-report-form')?.reset();
    const preview = document.getElementById('report-photo-preview');
    if (preview) preview.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('report-photo')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('report-photo-preview');
            if (preview) {
                preview.src = ev.target.result;
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    });
});

async function saveNewReport() {
    const title       = document.getElementById('report-title')?.value?.trim();
    const description = document.getElementById('report-description')?.value?.trim();
    const urgency     = document.querySelector('input[name="report-urgency"]:checked')?.value;
    const photoFile   = document.getElementById('report-photo')?.files[0];

    if (!title || !description || !urgency) {
        showToast('Completa todos los campos obligatorios', 'error');
        return;
    }

    try {
        let photoUrl = null;
        if (photoFile) {
            const fileName = `reports/${Date.now()}_${photoFile.name}`;
            const { error: uploadError } = await db.storage.from('receipts').upload(fileName, photoFile);
            if (!uploadError) {
                const { data: { publicUrl } } = db.storage.from('receipts').getPublicUrl(fileName);
                photoUrl = publicUrl;
            }
        }

        const { error } = await db.from('reports').insert([{
            title,
            description,
            photo_url: photoUrl,
            urgency,
            status: 'open',
            created_by: currentUser.id,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;
        showToast('Reporte enviado', 'success');
        closeAddReportModal();
        loadReports();
    } catch (err) {
        console.error('Error guardando reporte:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function markReportDone(reportId) {
    if (!confirm('¿Marcar este reporte como completado?')) return;
    try {
        const { error } = await db.from('reports').update({
            status: 'completed',
            completed_at: new Date().toISOString()
        }).eq('id', reportId);
        if (error) throw error;
        showToast('Reporte completado', 'success');
        loadReports();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function reassignTask(id) {
    showToast('Función en desarrollo', 'info');
}

// =============================
// EXPORTS
// =============================
window.loadTasks              = loadTasks;
window.deleteTask             = deleteTask;
window.reassignTask           = reassignTask;
window.showAddTaskModal       = showAddTaskModal;
window.closeAddTaskModal      = closeAddTaskModal;
window.saveNewTask            = saveNewTask;
window.showCompleteTaskModal  = showCompleteTaskModal;
window.closeCompleteTaskModal = closeCompleteTaskModal;
window.confirmCompleteTask    = confirmCompleteTask;
window.loadCleaningHistory    = loadCleaningHistory;
window.loadReports            = loadReports;
window.showAddReportModal     = showAddReportModal;
window.closeAddReportModal    = closeAddReportModal;
window.saveNewReport          = saveNewReport;
window.markReportDone         = markReportDone;
