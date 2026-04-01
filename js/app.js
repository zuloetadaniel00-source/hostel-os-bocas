// =====================================================
// HOSTEL-OS BOCAS - APP PRINCIPAL (FIXED)
// =====================================================

// 🔥 IMPORTS (CLAVE para evitar error de pantalla en blanco)
import './auth.js'
import './dashboard.js'
import './reservations.js'
import './operations.js'
import './finances.js'

// 🔑 SUPABASE CONFIG
const SUPABASE_URL = 'https://tusnumerosyletras.supabase.co'
const SUPABASE_ANON_KEY = 'TU_KEY_AQUI'

// ✅ CREAR CLIENTE BIEN (SIN ROMPER GLOBAL)
const { createClient } = window.supabase
window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 🌍 VARIABLES GLOBALES
window.currentUser = null
window.currentProfile = null

let reservationData = {
    roomId: null,
    bedId: null,
    checkIn: null,
    checkOut: null,
    guestId: null
}

// 🧼 ESCAPE (seguridad básica)
function esc(str) {
    return str == null ? '' : String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;')
}

// 🔔 TOAST
window.showToast = function(msg, type='info') {
    const container = document.getElementById('toast-container')
    if (!container) return

    const toast = document.createElement('div')
    toast.className = `toast ${type}`

    toast.innerHTML = `
        <span style="margin-right:8px;">
            ${type==='success'?'✓':type==='error'?'✕':type==='warning'?'⚠':'ℹ'}
        </span>
        ${esc(msg)}
    `

    container.appendChild(toast)

    setTimeout(() => {
        toast.style.opacity='0'
        setTimeout(() => toast.remove(), 300)
    }, 3000)
}

// 🧭 NAVEGACIÓN
window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'))

    const target = document.getElementById(pageId)
    if (target) target.classList.remove('hidden')

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))

    const btnPage = pageId.replace('-page','').replace('new-reservation-','')
    const activeBtn = document.querySelector(`[data-page="${btnPage}"]`)

    if (activeBtn) activeBtn.classList.add('active')

    const main = document.getElementById('main-content')
    if (main) main.scrollTop = 0
}

// 🔀 FUNCIONES GLOBALES (IMPORTANTE para HTML onclick)
window.showDashboard = function() {
    showPage('dashboard-page')
    if (window.loadDashboard) loadDashboard()
}

window.showReservations = function() {
    showPage('reservations-page')
    if (window.loadReservationsByDate) loadReservationsByDate()
}

window.showNewReservation = function() {
    showPage('new-reservation-page')
    if (window.resetReservationForm) resetReservationForm()
}

window.showOperations = function() {
    showPage('operations-page')
    if (window.loadTasks) loadTasks()
}

window.showFinances = function() {
    if (window.currentProfile?.role !== 'admin') {
        showToast('Sin permiso','error')
        return
    }
    showPage('finances-page')
    if (window.loadFinances) loadFinances()
}

// 🔙 BACK
window.goBack = function() {
    showReservations()
}

// 🧠 FORMATO
window.formatDate = d =>
    d ? new Date(d).toLocaleDateString('es-PA',{weekday:'short',day:'numeric',month:'short'}) : '-'

window.formatCurrency = a =>
    '$' + parseFloat(a||0).toFixed(2)

window.formatDateTime = iso =>
    iso ? new Date(iso).toLocaleString('es-PA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'

// 🔐 LOGIN / APP UI
function showLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden')
    document.getElementById('app-screen')?.classList.add('hidden')
}

async function showApp() {
    document.getElementById('login-screen')?.classList.add('hidden')
    document.getElementById('app-screen')?.classList.remove('hidden')

    if (window.currentProfile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'))
    }

    showDashboard()
}

// 🚀 INIT APP (AQUÍ ESTABA EL PROBLEMA REAL)
window.addEventListener('load', async () => {
    console.log('🚀 App iniciando...')

    const today = new Date().toISOString().split('T')[0]

    ;['check-in-date','check-out-date','reservations-date','finance-date'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.value = today
    })

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession()

        if (session) {
            window.currentUser = session.user

            if (window.loadUserProfile) {
                await loadUserProfile(session.user)
            }

            await showApp()
        } else {
            showLogin()
        }

    } catch (err) {
        console.error('❌ Error init:', err)
        showLogin()
    }

    // quitar loading
    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'
})
