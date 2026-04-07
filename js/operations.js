// =====================================================
// OPERACIONES / TAREAS
// Premium UX Edition
// =====================================================

async function loadTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    
    // Show loading skeletons
    list.innerHTML = `
        <div class="skeleton" style="height: 120px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 120px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 120px; border-radius: var(--radius-lg);"></div>
    `;
    
    try {
        const { data: tasks, error } = await db
            .from('tasks')
            .select('*, room:room_id(number, name), assigned:assigned_to(full_name)')
            .eq('status', 'pending')
            .order('priority', { ascending: false })
            .order('due_date');
            
        if (error) throw error;
        
        const isAdmin = currentProfile?.role === 'admin';

        // Add button visible only for admin
        const addBtnContainer = document.getElementById('add-task-btn-container');
        if (addBtnContainer) {
            addBtnContainer.innerHTML = isAdmin
                ? `<button onclick="showAddTaskModal()" class="btn btn-primary btn-small">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Agregar
                   </button>`
                : '';
        }
        
        if (!tasks?.length) {
            list.innerHTML = `
                <div style="text-align: center; padding: var(--space-10) var(--space-4); color: var(--gray-400);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-3);">🎉</div>
                    <div style="font-weight: 600;">Sin tareas pendientes</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">¡Todo está al día!</div>
                </div>
            `;
            loadCleaningHistory();
            loadReports();
            return;
        }
        
        list.innerHTML = tasks.map((t, index) => `
            <div class="task-card priority-${t.priority}" style="animation-delay: ${index * 0.05}s;">
                <div class="task-header">
                    <span class="task-title">${esc(t.title)}</span>
                    <span class="task-room">${esc(t.room?.name || '')}</span>
                </div>
                ${t.description ? `<p class="task-description">${esc(t.description)}</p>` : ''}
                <div class="task-meta">
                    <span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        ${esc(t.assigned_to_name || t.assigned?.full_name || 'Sin asignar')}
                    </span>
                    <span style="text-transform: capitalize;">${esc(t.priority)}</span>
                </div>
                <div class="task-actions">
                    <button onclick="showCompleteTaskModal('${t.id}')" class="btn btn-success btn-small">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Completar
                    </button>
                    ${isAdmin ? `
                        <button onclick="deleteTask('${t.id}')" class="btn btn-danger btn-small">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        loadCleaningHistory();
        loadReports();
        
    } catch (err) {
        console.error('Error tareas:', err);
        list.innerHTML = '<p class="text-muted">Error al cargar tareas</p>';
    }
}

function showAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (modal) {
        modal.style.animation = 'slideDownModal 0.3s ease forwards';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.animation = '';
            document.body.style.overflow = '';
        }, 300);
    }
    document.getElementById('add-task-form')?.reset();
}

async function saveNewTask() {
    const title       = document.getElementById('new-task-title')?.value?.trim();
    const description = document.getElementById('new-task-description')?.value?.trim() || null;
    const assignedTo  = document.getElementById('new-task-assigned')?.value?.trim();

    const priorityRaw = document.getElementById('new-task-priority')?.value || 'medium';
    const priorityMap = {
        'low': 'low', 'medium': 'medium', 'high': 'high',
        'baja': 'low', 'media': 'medium', 'alta': 'high',
        'bajo': 'low', 'medio': 'medium', 'alto': 'high'
    };
    const priority = priorityMap[priorityRaw.toLowerCase()] || 'medium';
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
        showToast('✅ Tarea creada exitosamente', 'success');
        closeAddTaskModal();
        loadTasks();
    } catch (err) {
        console.error('Error creando tarea:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

let pendingCompleteTaskId = null;

function showCompleteTaskModal(taskId) {
    pendingCompleteTaskId = taskId;
    const modal = document.getElementById('complete-task-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    const input = document.getElementById('completed-by-name');
    if (input) { 
        input.value = ''; 
        setTimeout(() => input.focus(), 100);
    }
}

function closeCompleteTaskModal() {
    const modal = document.getElementById('complete-task-modal');
    if (modal) {
        modal.style.animation = 'slideDownModal 0.3s ease forwards';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.animation = '';
            document.body.style.overflow = '';
        }, 300);
    }
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
        showToast('✅ Tarea completada', 'success');
        closeCompleteTaskModal();
        loadTasks();
    } catch (err) {
        console.error('Error completando tarea:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function loadCleaningHistory() {
    const section = document.getElementById('cleaning-history-section');
    if (!section) return;

    const isAdmin = currentProfile?.role === 'admin';
    if (!isAdmin) { section.classList.add('hidden'); return; }

    section.classList.remove('hidden');
    const list = document.getElementById('cleaning-history-list');
    if (!list) return;
    
    list.innerHTML = `
        <div class="skeleton" style="height: 70px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 70px; border-radius: var(--radius-lg);"></div>
    `;

    try {
        const { data: completed, error } = await db
            .from('tasks')
            .select('*')
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!completed?.length) {
            list.innerHTML = '<p class="text-muted">No hay tareas completadas aún.</p>';
            return;
        }

        list.innerHTML = completed.map((t, index) => {
            const completedAt = t.completed_at
                ? formatDateTime(t.completed_at)
                : '--';
            return `
                <div class="cleaning-history-card" style="animation-delay: ${index * 0.03}s;">
                    <div class="cleaning-history-title">
                        <span>🛏️</span>
                        ${esc(t.title)}
                    </div>
                    <div class="cleaning-history-meta">
                        <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            ${esc(t.completed_by_name || 'Desconocido')}
                        </span>
                        <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            ${esc(completedAt)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error historial:', err);
        list.innerHTML = '<p class="text-muted">Error al cargar historial</p>';
    }
}

async function deleteTask(id) {
    if (!confirm('⚠️ ¿Eliminar esta tarea permanentemente?')) return;
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

async function loadReports() {
    const container = document.getElementById('reports-list');
    if (!container) return;
    
    container.innerHTML = `
        <div class="skeleton" style="height: 150px; border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></div>
        <div class="skeleton" style="height: 150px; border-radius: var(--radius-lg);"></div>
    `;

    const isAdmin = currentProfile?.role === 'admin';

    try {
        const { data: reports, error } = await db
            .from('reports')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reports?.length) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--space-10) var(--space-4); color: var(--gray-400);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-3);">📋</div>
                    <div style="font-weight: 600;">No hay reportes abiertos</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">Todo está funcionando correctamente</div>
                </div>
            `;
            return;
        }

        const urgencyColor = { watch: '#d97706', important: '#059669', urgent: '#dc2626' };
        const urgencyLabel = { watch: '🟡 Tener en cuenta', important: '🟢 Importante', urgent: '🔴 Urgente' };
        const urgencyBg = { watch: '#fffbeb', important: '#f0fdf4', urgent: '#fef2f2' };

        container.innerHTML = reports.map((r, index) => {
            const fecha = r.created_at ? formatDateTime(r.created_at) : '--';
            const color = urgencyColor[r.urgency] || '#6b7280';
            const label = urgencyLabel[r.urgency] || r.urgency;
            const bg = urgencyBg[r.urgency] || '#f9fafb';
            
            return `
                <div class="report-card" style="border-left-color: ${color}; background: linear-gradient(135deg, ${bg} 0%, var(--surface) 100%); animation-delay: ${index * 0.05}s;">
                    <div class="report-header">
                        <span style="color:${color}; font-weight:700; font-size:0.875rem; display: flex; align-items: center; gap: var(--space-2);">
                            ${label}
                        </span>
                        <span style="font-size:0.75rem; color:var(--gray-400); font-weight: 500;">${esc(fecha)}</span>
                    </div>
                    <div style="font-weight:700; margin: var(--space-2) 0; font-size: 1rem; color: var(--gray-900);">${esc(r.title)}</div>
                    <div style="font-size:0.875rem; color:var(--gray-600); margin-bottom:var(--space-4); line-height: 1.5;">${esc(r.description)}</div>
                    ${r.photo_url ? `<img src="${esc(r.photo_url)}" alt="Foto del reporte" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: var(--radius-lg); margin-bottom: var(--space-4); box-shadow: var(--shadow-sm);">` : ''}
                    ${isAdmin ? `
                        <button onclick="markReportDone('${r.id}')" class="btn btn-success btn-small">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                            Completado
                        </button>
                    ` : ''}
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
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeAddReportModal() {
    const modal = document.getElementById('add-report-modal');
    if (modal) {
        modal.style.animation = 'slideDownModal 0.3s ease forwards';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.animation = '';
            document.body.style.overflow = '';
        }, 300);
    }
    document.getElementById('add-report-form')?.reset();
    const preview = document.getElementById('report-photo-preview');
    if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
    }
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
                preview.style.animation = 'fadeIn 0.3s ease';
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
        showToast('✅ Reporte enviado correctamente', 'success');
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
        showToast('✅ Reporte completado', 'success');
        loadReports();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

window.loadTasks = loadTasks;
window.deleteTask = deleteTask;
window.showAddTaskModal = showAddTaskModal;
window.closeAddTaskModal = closeAddTaskModal;
window.saveNewTask = saveNewTask;
window.showCompleteTaskModal = showCompleteTaskModal;
window.closeCompleteTaskModal = closeCompleteTaskModal;
window.confirmCompleteTask = confirmCompleteTask;
window.loadCleaningHistory = loadCleaningHistory;
window.loadReports = loadReports;
window.showAddReportModal = showAddReportModal;
window.closeAddReportModal = closeAddReportModal;
window.saveNewReport = saveNewReport;
window.markReportDone = markReportDone;

