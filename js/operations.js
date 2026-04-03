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
        
        if (!tasks?.length) {
            list.innerHTML = '<p class="text-muted">Sin tareas pendientes 🎉</p>';
            return;
        }
        
        list.innerHTML = tasks.map(t => `
            <div class="task-card priority-${t.priority}">
                <div class="task-header">
                    <span class="task-title">${esc(t.title)}</span>
                    <span class="task-room">${esc(t.room?.name || 'General')}</span>
                </div>
                ${t.description ? `<p class="task-description">${esc(t.description)}</p>` : ''}
                <div class="task-meta">
                    <span>Asignado: ${t.assigned?.full_name || 'Sin asignar'}</span>
                    <span>Prioridad: ${t.priority}</span>
                </div>
                <div class="task-actions">
                    <button onclick="completeTask('${t.id}')" class="btn btn-success btn-small">✓ Completar</button>
                    ${currentProfile?.role === 'admin' ? `<button onclick="reassignTask('${t.id}')" class="btn btn-secondary btn-small">Reasignar</button>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        console.error('Error tareas:', err);
        list.innerHTML = '<p class="text-muted">Error al cargar</p>';
    }
}

async function completeTask(id) {
    try {
        const { error } = await db.from('tasks').update({
            status: 'completed',
            completed_by: currentUser.id,
            completed_at: new Date().toISOString()
        }).eq('id', id);
        
        if (error) throw error;
        showToast('Tarea completada', 'success');
        loadTasks();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function reassignTask(id) {
    showToast('Función en desarrollo', 'info');
}

window.loadTasks = loadTasks;
window.completeTask = completeTask;
window.reassignTask = reassignTask;
