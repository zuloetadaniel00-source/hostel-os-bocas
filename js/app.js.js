// =====================================================
// HOSTEL-OS BOCAS — js/app.js (VERSIÓN CORREGIDA)
// =====================================================
// ⚠️  REGLAS CLAVE:
//   1. Supabase se importa desde CDN ESM (con /+esm al final)
//   2. NO uses import './auth.js' etc. — todo va en este archivo
//      hasta que los otros archivos estén listos
//   3. UN solo listener de arranque (DOMContentLoaded)
//   4. try/catch/finally garantiza que loading desaparece siempre
// =====================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ─────────────────────────────────────────────────────
// ⚙️  CONFIGURACIÓN SUPABASE
// Reemplaza con tus valores reales del dashboard de Supabase
// Project Settings → API → Project URL + anon public key
// ─────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://TU_PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI'

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Exponer globalmente para que otros módulos puedan usarlo después
window.sb = sb

// ─────────────────────────────────────────────────────
// 📦 ESTADO GLOBAL
// ─────────────────────────────────────────────────────
window.currentUser    = null   // objeto de auth de Supabase
window.currentProfile = null   // fila de la tabla public.users

// ─────────────────────────────────────────────────────
// 🚀 ARRANQUE PRINCIPAL
// ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await init()
  } catch (err) {
    console.error('❌ Error al iniciar la app:', err)
    // Si falla todo, al menos mostrar el login
    showLogin()
  } finally {
    // Se ejecuta SIEMPRE — haya error o no
    // Esto es lo que quitaba la pantalla de "Cargando sistema..."
    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'
  }
})

// ─────────────────────────────────────────────────────
// 🔧 INIT — lógica de arranque
// ─────────────────────────────────────────────────────
async function init() {
  console.log('🚀 HostelOS Bocas iniciando...')

  // Poner fecha de hoy en todos los date inputs
  const today = new Date().toISOString().split('T')[0]
  const dateInputIds = ['check-in-date', 'check-out-date', 'reservations-date', 'finance-date']
  dateInputIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = today
  })

  // Verificar si hay sesión activa
  const { data: { session }, error } = await sb.auth.getSession()
  if (error) throw error

  if (session) {
    window.currentUser = session.user
    await cargarPerfilUsuario(session.user.id)
    await mostrarApp()
  } else {
    showLogin()
  }

  // Escuchar cambios de sesión (login / logout)
  sb.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      window.currentUser = session.user
      await cargarPerfilUsuario(session.user.id)
      await mostrarApp()
    } else {
      window.currentUser    = null
      window.currentProfile = null
      showLogin()
    }
  })
}

// ─────────────────────────────────────────────────────
// 👤 PERFIL DE USUARIO
// ─────────────────────────────────────────────────────
async function cargarPerfilUsuario(userId) {
  const { data, error } = await sb
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single()

  if (error) {
    console.warn('No se encontró perfil en tabla users:', error.message)
    // Crear perfil mínimo para no romper la app
    window.currentProfile = { id: userId, role: 'volunteer', name: 'Usuario' }
    return
  }

  window.currentProfile = data
}

// ─────────────────────────────────────────────────────
// 🔐 LOGIN / LOGOUT
// ─────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen')?.classList.remove('hidden')
  document.getElementById('app-screen')?.classList.add('hidden')

  // Escuchar submit del formulario de login
  // removeEventListener primero para no acumular listeners
  const form = document.getElementById('login-form')
  if (form) {
    const newForm = form.cloneNode(true)  // truco para limpiar listeners
    form.parentNode.replaceChild(newForm, form)

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      await handleLogin()
    })
  }
}

async function handleLogin() {
  const email    = document.getElementById('login-email')?.value.trim()
  const password = document.getElementById('login-password')?.value
  const errEl    = document.getElementById('login-error')
  const btnEl    = document.querySelector('#login-form button[type="submit"]')

  if (errEl)  errEl.textContent = ''
  if (btnEl)  { btnEl.disabled = true; btnEl.textContent = 'Ingresando...' }

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    // onAuthStateChange se encarga del resto
  } catch (err) {
    if (errEl) errEl.textContent = 'Correo o contraseña incorrectos'
    console.error('Error de login:', err.message)
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Ingresar' }
  }
}

window.logout = async function() {
  await sb.auth.signOut()
  // onAuthStateChange llama a showLogin() automáticamente
}

// ─────────────────────────────────────────────────────
// 📱 MOSTRAR APP
// ─────────────────────────────────────────────────────
async function mostrarApp() {
  document.getElementById('login-screen')?.classList.add('hidden')
  document.getElementById('app-screen')?.classList.remove('hidden')

  const role = window.currentProfile?.role || 'volunteer'
  const name = window.currentProfile?.name || 'Usuario'

  // Badge de rol en el header
  const roleEl = document.getElementById('user-role')
  if (roleEl) {
    roleEl.textContent = role === 'admin' ? '👑 Admin' : '🙋 Voluntario'
  }

  // Mostrar u ocultar elementos exclusivos de admin
  document.querySelectorAll('.admin-only').forEach(el => {
    if (role === 'admin') {
      el.classList.remove('hidden')
    } else {
      el.classList.add('hidden')
    }
  })

  console.log(`✅ Sesión activa: ${name} (${role})`)

  // Ir al dashboard
  showDashboard()
}

// ─────────────────────────────────────────────────────
// 🧭 NAVEGACIÓN
// ─────────────────────────────────────────────────────
window.showPage = function(pageId) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'))

  // Mostrar la página pedida
  const target = document.getElementById(pageId)
  if (target) {
    target.classList.remove('hidden')
  } else {
    console.warn('Página no encontrada:', pageId)
  }

  // Actualizar nav activo
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const activeBtn = document.querySelector(`.nav-btn[data-page="${pageId.replace('-page','')}"]`)
  if (activeBtn) activeBtn.classList.add('active')

  // Scroll al tope
  const main = document.getElementById('main-content')
  if (main) main.scrollTop = 0
}

window.showDashboard = function() {
  showPage('dashboard-page')
  document.getElementById('page-title').textContent = 'Dashboard'
  loadDashboard()
}

window.showReservations = function() {
  showPage('reservations-page')
  document.getElementById('page-title').textContent = 'Reservas'
  loadReservations()
}

window.showNewReservation = function() {
  showPage('new-reservation-page')
  document.getElementById('page-title').textContent = 'Nueva Reserva'
}

window.showOperations = function() {
  showPage('operations-page')
  document.getElementById('page-title').textContent = 'Operaciones'
  loadTasks()
}

window.showFinances = function() {
  if (window.currentProfile?.role !== 'admin') {
    showToast('Sin permiso para ver finanzas', 'error')
    return
  }
  showPage('finances-page')
  document.getElementById('page-title').textContent = 'Caja'
  loadFinances()
}

window.goBack = function() {
  showReservations()
}

// ─────────────────────────────────────────────────────
// 🔔 TOAST (notificaciones)
// ─────────────────────────────────────────────────────
window.showToast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container')
  if (!container) return

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${esc(msg)}`

  container.appendChild(toast)

  // Animar salida
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(10px)'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// ─────────────────────────────────────────────────────
// 🛡️ SEGURIDAD — escape HTML
// ─────────────────────────────────────────────────────
window.esc = function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ─────────────────────────────────────────────────────
// 🗓️ FORMATO DE FECHAS Y MONEDA
// ─────────────────────────────────────────────────────
window.formatDate = function(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-PA', {
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

window.formatCurrency = function(a) {
  return '$' + parseFloat(a || 0).toFixed(2)
}

window.formatDateTime = function(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PA', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

// ─────────────────────────────────────────────────────
// 📊 DASHBOARD
// ─────────────────────────────────────────────────────
async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0]

  // Fecha bonita en el header del dashboard
  const dateEl = document.getElementById('current-date')
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-PA', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
  }

  try {
    // Cargar conteos en paralelo
    const [bedsRes, checkinsRes, checkoutsRes, tasksRes] = await Promise.all([
      sb.from('beds').select('id, status'),
      sb.from('reservations').select('id').eq('check_in_date', today).in('status', ['reserved', 'checked_in']),
      sb.from('reservations').select('id').eq('check_out_date', today).eq('status', 'checked_in'),
      sb.from('tasks').select('id').eq('status', 'pending')
    ])

    const beds        = bedsRes.data      || []
    const totalBeds   = beds.length
    const occupiedBeds= beds.filter(b => b.status === 'occupied').length
    const cleaningBeds= beds.filter(b => b.status === 'cleaning').length

    // Actualizar tarjetas del dashboard
    setDashCard('dash-occupied',  `${occupiedBeds}/${totalBeds}`)
    setDashCard('dash-checkins',  checkinsRes.data?.length  ?? '—')
    setDashCard('dash-checkouts', checkoutsRes.data?.length ?? '—')
    setDashCard('dash-tasks',     tasksRes.data?.length     ?? '—')

    if (cleaningBeds > 0) {
      showToast(`${cleaningBeds} cama(s) pendiente(s) de limpieza`, 'warning')
    }

    // Finanzas solo para admin
    if (window.currentProfile?.role === 'admin') {
      const { data: finData } = await sb
        .from('finance_records')
        .select('type, amount')
        .eq('record_date', today)

      const income = (finData || [])
        .filter(f => f.type === 'income')
        .reduce((s, f) => s + parseFloat(f.amount), 0)

      setDashCard('dash-income', '$' + income.toFixed(2))
    }

  } catch (err) {
    console.error('Error cargando dashboard:', err)
    showToast('Error al cargar el dashboard', 'error')
  }
}

function setDashCard(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

// ─────────────────────────────────────────────────────
// 🛏️ RESERVAS
// ─────────────────────────────────────────────────────
async function loadReservations() {
  const dateEl = document.getElementById('reservations-date')
  const date   = dateEl?.value || new Date().toISOString().split('T')[0]
  const listEl = document.getElementById('reservations-list')
  if (!listEl) return

  listEl.innerHTML = '<p style="padding:16px;color:#888">Cargando...</p>'

  try {
    const { data, error } = await sb
      .from('reservations')
      .select(`
        id, guest_name, status, payment_status, outstanding_balance,
        check_in_date, check_out_date, booking_type,
        rooms(name), beds(label)
      `)
      .or(`check_in_date.eq.${date},check_out_date.eq.${date}`)
      .not('status', 'in', '(cancelled,no_show)')
      .order('check_in_date')

    if (error) throw error

    if (!data || data.length === 0) {
      listEl.innerHTML = '<p style="padding:16px;text-align:center;color:#888">Sin reservas para este día</p>'
      return
    }

    listEl.innerHTML = data.map(r => {
      const statusColors = {
        reserved:    '#4FA3F7',
        checked_in:  '#2DD9C4',
        hosted:      '#34C97A',
        checked_out: '#9896A0'
      }
      const statusLabels = {
        reserved:    'Reservado',
        checked_in:  'Check-in ✓',
        hosted:      'Hospedado',
        checked_out: 'Check-out ✓'
      }
      const color = statusColors[r.status] || '#888'
      const label = statusLabels[r.status] || r.status
      const lugar = r.rooms?.name + (r.beds?.label ? ` · Cama ${r.beds.label}` : ' (completa)')
      const deuda = parseFloat(r.outstanding_balance || 0)

      return `
        <div class="reservation-card" onclick="openReservation('${r.id}')">
          <div class="res-header">
            <strong>${esc(r.guest_name)}</strong>
            <span class="res-status" style="background:${color}20;color:${color};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">${label}</span>
          </div>
          <div class="res-detail">${esc(lugar)}</div>
          <div class="res-detail">
            ${formatDate(r.check_in_date)} → ${formatDate(r.check_out_date)}
          </div>
          ${deuda > 0 ? `<div style="color:#FF5B5B;font-size:12px;margin-top:4px">⚠ $${deuda.toFixed(2)} pendiente</div>` : ''}
          <div class="res-actions">
            ${r.status === 'reserved'   ? `<button class="btn btn-small btn-primary" onclick="doCheckin('${r.id}');event.stopPropagation()">Check-in</button>` : ''}
            ${r.status === 'checked_in' ? `<button class="btn btn-small btn-warning" onclick="doCheckout('${r.id}');event.stopPropagation()">Check-out</button>` : ''}
            ${deuda > 0                 ? `<button class="btn btn-small btn-success" onclick="openPayment('${r.id}');event.stopPropagation()">Cobrar</button>` : ''}
          </div>
        </div>
      `
    }).join('')

  } catch (err) {
    console.error('Error cargando reservas:', err)
    listEl.innerHTML = '<p style="padding:16px;color:#FF5B5B">Error al cargar reservas</p>'
  }
}

window.doCheckin = async function(resId) {
  try {
    const { error } = await sb.from('reservations').update({
      status:          'checked_in',
      actual_check_in: new Date().toISOString()
    }).eq('id', resId)

    if (error) throw error
    showToast('Check-in realizado ✓', 'success')
    loadReservations()
  } catch (err) {
    showToast('Error al hacer check-in: ' + err.message, 'error')
  }
}

window.doCheckout = async function(resId) {
  try {
    // Verificar deuda primero
    const { data: res } = await sb
      .from('reservations')
      .select('outstanding_balance, guest_name')
      .eq('id', resId)
      .single()

    if (res && parseFloat(res.outstanding_balance) > 0) {
      if (!confirm(`${res.guest_name} tiene $${parseFloat(res.outstanding_balance).toFixed(2)} pendiente.\n¿Confirmar checkout de todas formas?`)) return
    }

    const { error } = await sb.from('reservations').update({
      status:           'checked_out',
      actual_check_out: new Date().toISOString()
    }).eq('id', resId)

    if (error) throw error
    showToast('Check-out realizado. Tarea de limpieza creada 🧹', 'success')
    loadReservations()
  } catch (err) {
    showToast('Error al hacer check-out: ' + err.message, 'error')
  }
}

window.openReservation = function(resId) {
  // Por ahora solo muestra el id — aquí implementarás el detalle
  console.log('Ver detalle de reserva:', resId)
  showToast('Detalle de reserva próximamente', 'info')
}

window.openPayment = function(resId) {
  console.log('Registrar pago para:', resId)
  showToast('Módulo de pago próximamente', 'info')
}

// ─────────────────────────────────────────────────────
// ✅ TAREAS (OPERACIONES)
// ─────────────────────────────────────────────────────
async function loadTasks() {
  const listEl = document.getElementById('tasks-list')
  if (!listEl) return

  listEl.innerHTML = '<p style="padding:16px;color:#888">Cargando...</p>'

  try {
    let query = sb
      .from('tasks')
      .select('id, type, title, location_label, priority, status, assigned_to, auto_generated, created_at')
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })

    // Voluntario solo ve sus tareas y las sin asignar
    if (window.currentProfile?.role !== 'admin') {
      query = query.or(`assigned_to.eq.${window.currentProfile.id},assigned_to.is.null`)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:32px;color:#888">Sin tareas pendientes 🎉</div>'
      return
    }

    const priColors = { urgent: '#FF5B5B', high: '#F5A623', normal: '#4FA3F7', low: '#9896A0' }
    const typeLabels= { cleaning: '🧹 Limpieza', maintenance: '🔧 Mantenimiento', laundry: '👕 Lavandería', other: '📋 Otro' }

    listEl.innerHTML = data.map(t => `
      <div class="task-card" id="task-${t.id}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div class="task-check ${t.status === 'completed' ? 'done' : ''}"
               onclick="completeTask('${t.id}')"
               style="width:22px;height:22px;border-radius:5px;border:2px solid #ccc;cursor:pointer;flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center">
          </div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${esc(t.title)}</div>
            <div style="font-size:12px;color:#888;margin-top:3px">${esc(t.location_label || '')}</div>
            <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
              <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${priColors[t.priority] || '#888'}20;color:${priColors[t.priority] || '#888'}">
                ${t.priority}
              </span>
              <span style="font-size:11px;color:#888">${typeLabels[t.type] || t.type}</span>
              ${t.auto_generated ? '<span style="font-size:11px;color:#888">Auto</span>' : ''}
            </div>
          </div>
        </div>
      </div>
    `).join('')

  } catch (err) {
    console.error('Error cargando tareas:', err)
    listEl.innerHTML = '<p style="padding:16px;color:#FF5B5B">Error al cargar tareas</p>'
  }
}

window.completeTask = async function(taskId) {
  try {
    const { error } = await sb.from('tasks').update({
      status:       'completed',
      completed_at: new Date().toISOString()
    }).eq('id', taskId)

    if (error) throw error

    // Marcar visualmente sin recargar
    const card  = document.getElementById(`task-${taskId}`)
    const check = card?.querySelector('.task-check')
    const title = card?.querySelector('[style*="font-weight:600"]')
    if (check) { check.style.background = '#34C97A'; check.style.borderColor = '#34C97A'; check.textContent = '✓'; check.style.color = '#fff' }
    if (title) title.style.textDecoration = 'line-through'

    showToast('Tarea completada ✓', 'success')
  } catch (err) {
    showToast('Error: ' + err.message, 'error')
  }
}

// ─────────────────────────────────────────────────────
// 💰 FINANZAS (solo admin)
// ─────────────────────────────────────────────────────
async function loadFinances() {
  const dateEl  = document.getElementById('finance-date')
  const date    = dateEl?.value || new Date().toISOString().split('T')[0]
  const listEl  = document.getElementById('finance-list')
  if (!listEl) return

  listEl.innerHTML = '<p style="padding:16px;color:#888">Cargando...</p>'

  try {
    const { data, error } = await sb
      .from('finance_records')
      .select('id, type, category, amount, payment_method, description, created_at')
      .eq('record_date', date)
      .order('created_at', { ascending: false })

    if (error) throw error

    const records = data || []
    const income  = records.filter(f => f.type === 'income') .reduce((s, f) => s + parseFloat(f.amount), 0)
    const expense = records.filter(f => f.type === 'expense').reduce((s, f) => s + parseFloat(f.amount), 0)
    const balance = income - expense

    // Actualizar métricas
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val }
    setEl('finance-income',  '$' + income.toFixed(2))
    setEl('finance-expense', '$' + expense.toFixed(2))
    setEl('finance-balance', '$' + balance.toFixed(2))

    // Colorear balance
    const balEl = document.getElementById('finance-balance')
    if (balEl) balEl.style.color = balance >= 0 ? '#34C97A' : '#FF5B5B'

    if (records.length === 0) {
      listEl.innerHTML = '<p style="padding:16px;text-align:center;color:#888">Sin movimientos este día</p>'
      return
    }

    const METH = { cash: 'Efectivo', yappy: 'Yappy', card: 'Tarjeta', transfer: 'Transferencia' }

    listEl.innerHTML = records.map(f => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f0f0f0">
        <div>
          <div style="font-size:14px;font-weight:500">${esc(f.description)}</div>
          <div style="font-size:12px;color:#888">${METH[f.payment_method] || f.payment_method}</div>
        </div>
        <div style="font-size:16px;font-weight:600;color:${f.type === 'income' ? '#34C97A' : '#FF5B5B'}">
          ${f.type === 'income' ? '+' : '-'}$${parseFloat(f.amount).toFixed(2)}
        </div>
      </div>
    `).join('')

  } catch (err) {
    console.error('Error cargando finanzas:', err)
    listEl.innerHTML = '<p style="padding:16px;color:#FF5B5B">Error al cargar finanzas</p>'
  }
}

// Exponer para que el botón de cambiar fecha funcione
window.loadFinances     = loadFinances
window.loadReservations = loadReservations
window.loadTasks        = loadTasks
window.loadDashboard    = loadDashboard
