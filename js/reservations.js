// =====================================================
// OPERACIONES / TAREAS
// =====================================================

async function loadTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '<p>Cargando tareas...</p>';
    
    const { data: tasks } = await supabase
        .from('tasks')
        .select('*, room:room_id(number, name), assigned:assigned_to(full_name)')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });
    
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<p class="text-muted">No hay tareas pendientes 🎉</p>';
        return;
    }
    
    list.innerHTML = '';
    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;
        card.innerHTML = `
            <div class="task-header">
                <span class="task-title">${esc(task.title)}</span>
                <span class="task-room">${esc(task.room?.name || 'General')}</span>
            </div>
            ${task.description ? `<p class="task-description">${esc(task.description)}</p>` : ''}
            <div class="task-meta">
                <span>Asignado: ${task.assigned?.full_name || 'Sin asignar'}</span>
                <span>Prioridad: ${task.priority}</span>
            </div>
            <div class="task-actions">
                <button onclick="completeTask('${task.id}')" class="btn btn-success btn-small">
                    ✓ Completar
                </button>
                ${currentProfile?.role === 'admin' ? `
                    <button onclick="assignTask('${task.id}')" class="btn btn-secondary btn-small">
                        Reasignar
                    </button>
                ` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

async function completeTask(taskId) {
    const { error } = await supabase
        .from('tasks')
        .update({
            status: 'completed',
            completed_by: currentUser.id,
            completed_at: new Date().toISOString()
        })
        .eq('id', taskId);
    
    if (error) {
        showToast('Error al completar tarea: ' + error.message, 'error');
    } else {
        showToast('Tarea completada', 'success');
        loadTasks();
    }
}

function filterTasks(filter) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    // Implementar filtro real
    loadTasks();
}

function showNewTaskModal() {
    // Cargar habitaciones para el select
    loadRoomOptions();
    showModal('new-task-modal');
}

async function loadRoomOptions() {
    const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .order('number');
    
    const select = document.getElementById('task-room');
    select.innerHTML = rooms.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}

document.getElementById('new-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { error } = await supabase
        .from('tasks')
        .insert([{
            type: document.getElementById('task-type').value,
            room_id: document.getElementById('task-room').value,
            priority: document.getElementById('task-priority').value,
            description: document.getElementById('task-description').value,
            title: 'Tarea manual',
            due_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id
        }]);
    
    if (error) {
        showToast('Error al crear tarea: ' + error.message, 'error');
    } else {
        showToast('Tarea creada', 'success');
        closeModal();
        loadTasks();
    }
});
