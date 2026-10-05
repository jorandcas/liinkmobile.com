/**
 * SuperAdmin Dashboard - Sistema Multitenant DN Verification
 */

let tenantsData = [];
let currentTab = 'tenants';
let apiStatusCountdownTarget = null;
let apiStatusCheckInProgress = false;

/**
 * Obtener token de autenticación
 */
function getAuthToken() {
  return localStorage.getItem('authToken');
}

async function loadApiStatusSchedule() {
  try {
    const response = await fetch('/api/superadmin/api-status/schedule', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (!response.ok) throw new Error('No se pudo consultar el horario');
    const data = await response.json();
    const schedule = data.schedule;
    apiStatusCheckInProgress = Boolean(schedule?.checking);
    if (apiStatusCheckInProgress) {
      apiStatusCountdownTarget = null;
    } else if (schedule?.nextCheckAt && schedule?.serverNow) {
      const remainingMs = Date.parse(schedule.nextCheckAt) - Date.parse(schedule.serverNow);
      apiStatusCountdownTarget = Date.now() + Math.max(0, remainingMs);
    } else {
      apiStatusCountdownTarget = null;
    }
    renderApiStatusCountdown();
  } catch (error) {
    console.error('Error cargando horario de revisión de APIs:', error);
    document.getElementById('apiStatusCountdown').textContent = 'Horario no disponible';
  }
}

function renderApiStatusCountdown() {
  const element = document.getElementById('apiStatusCountdown');
  if (!element) return;
  if (apiStatusCheckInProgress) {
    element.textContent = 'Revisión en curso…';
    return;
  }
  if (apiStatusCountdownTarget === null) {
    element.textContent = 'Esperando horario…';
    return;
  }
  const remaining = Math.max(0, apiStatusCountdownTarget - Date.now());
  if (remaining === 0) {
    element.textContent = 'Iniciando revisión…';
    return;
  }
  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  element.textContent = days ? `${days}d ${clock}` : clock;
}

/**
 * Verificar autenticación
 */
async function checkAuth() {
  const token = getAuthToken();

  if (!token) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!data.exito || data.user.role !== 'superadmin') {
      logout();
      return false;
    }

    // Mostrar nombre del usuario
    document.getElementById('userName').textContent = data.user.nombre;
    return true;
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    logout();
    return false;
  }
}

/**
 * Cerrar sesión
 */
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  window.location.href = '/login.html';
}

/**
 * Mostrar tab específico
 */
function showTab(tabName) {
  currentTab = tabName;

  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });

  // Mostrar tab seleccionado
  document.getElementById(`${tabName}-tab`).classList.remove('hidden');

  // Actualizar estilos de botones
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('border-gray-900', 'text-gray-900');
    btn.classList.add('border-transparent', 'text-gray-500');
  });

  const activeBtn = document.getElementById(`tab-${tabName}`);
  activeBtn.classList.remove('border-transparent', 'text-gray-500');
  activeBtn.classList.add('border-gray-900', 'text-gray-900');

  // Cargar datos del tab
  if (tabName === 'tenants') {
    loadTenants();
  } else if (tabName === 'audit') {
    loadAuditLogs();
  }
}

/**
 * Cargar lista de tenants
 */
async function loadTenants() {
  const token = getAuthToken();

  try {
    const response = await fetch('/api/superadmin/tenants', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.exito) {
      tenantsData = data.tenants;
      renderTenants();
      updateTenantsStats();
    } else {
      console.error('Error cargando tenants:', data.mensaje);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Renderizar tabla de tenants
 */
function renderTenants() {
  const tbody = document.getElementById('tenantsTableBody');
  tbody.innerHTML = '';

  if (tenantsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No hay tenants registrados</td></tr>';
    return;
  }

  tenantsData.forEach(tenant => {
    const tr = document.createElement('tr');

    const [apiStatusLabel, apiStatusClass] = apiStatusPresentation(tenant.api_status);
    const tenantStatusClass = tenant.tenant_status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

    const lastLogin = tenant.last_login_at ? new Date(tenant.last_login_at).toLocaleString() : 'Nunca';

    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(tenant.nombre)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(tenant.email)}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${apiStatusClass}">
          ${escapeHtml(apiStatusLabel)}
        </span>
        ${tenant.api_status_error ? `<button type="button" onclick="openApiErrorModal(${tenant.id})" aria-label="Ver error de API de ${escapeHtml(tenant.nombre)}" title="Ver detalle del error" class="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-amber-600 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400">
          <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3l-7.6-13.1a2 2 0 0 0-3.4 0Z"/></svg>
        </button>` : ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenantStatusClass}">
          ${escapeHtml(tenant.tenant_status)}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lastLogin}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        ${tenant.tenant_status === 'activo'
          ? `<button onclick="suspendTenant(${tenant.id}, this.dataset.name)" data-name="${escapeHtml(tenant.nombre)}" class="text-red-600 hover:text-red-900 mr-3">Suspender</button>`
          : `<button onclick="activateTenant(${tenant.id}, this.dataset.name)" data-name="${escapeHtml(tenant.nombre)}" class="text-green-600 hover:text-green-900 mr-3">Activar</button>`
        }
        <button onclick="openEditTenantModal(${tenant.id})" aria-label="Editar ${escapeHtml(tenant.nombre)}" title="Editar cliente" class="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg>
        </button>${tenant.tenant_status === 'activo' ? `<button onclick="openTenantProfile(${tenant.id}, this)" aria-label="Ingresar al módulo de ${escapeHtml(tenant.nombre)}" title="Ingresar al módulo del cliente" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400">
          <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>` : ''}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * Actualizar estadísticas de tenants
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function apiStatusPresentation(status) {
  const values = {
    valida: ['Operativa', 'bg-green-100 text-green-800'],
    invalida: ['Clave rechazada', 'bg-red-100 text-red-800'],
    no_disponible: ['No disponible', 'bg-amber-100 text-amber-800'],
    pendiente: ['Pendiente', 'bg-gray-100 text-gray-700']
  };
  return values[status] || [status || 'Pendiente', 'bg-gray-100 text-gray-700'];
}

function openApiErrorModal(tenantId) {
  const tenant = tenantsData.find(item => item.id === tenantId);
  if (!tenant) return;
  document.getElementById('apiErrorTenantName').textContent = tenant.nombre;
  document.getElementById('apiErrorMessage').textContent = tenant.api_status_error || 'No hay un error registrado.';
  document.getElementById('apiErrorCheckedAt').textContent = tenant.api_status_checked_at
    ? new Date(tenant.api_status_checked_at).toLocaleString()
    : 'Sin revisión registrada';
  const retryButton = document.getElementById('apiErrorRetryButton');
  retryButton.dataset.tenantId = String(tenantId);
  document.getElementById('apiErrorModal').classList.remove('hidden');
}

function closeApiErrorModal() {
  document.getElementById('apiErrorModal').classList.add('hidden');
}

function openEditTenantModal(tenantId) {
  const tenant = tenantsData.find(item => item.id === tenantId);
  if (!tenant) return;
  document.getElementById('editTenantId').value = String(tenant.id);
  document.getElementById('editTenantName').value = tenant.nombre;
  document.getElementById('editTenantEmail').value = tenant.email;
  document.getElementById('editTenantApiKey').value = '';
  document.getElementById('editTenantError').classList.add('hidden');
  document.getElementById('editTenantModal').classList.remove('hidden');
}

function closeEditTenantModal() {
  document.getElementById('editTenantModal').classList.add('hidden');
}

async function checkTenantApi(tenantId, button) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Revisando…';
  try {
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/check-api`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await response.json();
    if (!response.ok || !data.exito) throw new Error(data.mensaje || 'No se pudo revisar la API');
    await loadTenants();
    if (!document.getElementById('apiErrorModal').classList.contains('hidden')) {
      openApiErrorModal(tenantId);
    }
  } catch (error) {
    alert(error.message || 'Error revisando la API');
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

function checkApiFromErrorModal(button) {
  const tenantId = Number(button.dataset.tenantId);
  if (Number.isInteger(tenantId) && tenantId > 0) void checkTenantApi(tenantId, button);
}

async function openTenantProfile(tenantId, button) {
  const profileWindow = window.open('about:blank', '_blank');
  if (!profileWindow) {
    alert('Permite las ventanas emergentes para abrir el perfil del cliente.');
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/access`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await response.json();
    if (!response.ok || !data.exito) throw new Error(data.mensaje || 'No se pudo abrir el perfil');
    profileWindow.location.replace(`/dashboard.html#${encodeURIComponent(data.token)}`);
    profileWindow.opener = null;
  } catch (error) {
    profileWindow.close();
    alert(error.message || 'No se pudo abrir el perfil del cliente');
  } finally {
    button.disabled = false;
  }
}

function updateTenantsStats() {
  const total = tenantsData.length;
  const active = tenantsData.filter(t => t.tenant_status === 'activo').length;
  const suspended = tenantsData.filter(t => t.tenant_status === 'suspendido').length;

  document.getElementById('totalTenants').textContent = total;
  document.getElementById('activeTenants').textContent = active;
  document.getElementById('suspendedTenants').textContent = suspended;
}

/**
 * Mostrar modal de crear tenant
 */
function showCreateTenantModal() {
  document.getElementById('createTenantModal').classList.remove('hidden');
  document.getElementById('modalError').classList.add('hidden');
  document.getElementById('modalSuccess').classList.add('hidden');
  document.getElementById('createTenantForm').reset();
}

/**
 * Ocultar modal de crear tenant
 */
function hideCreateTenantModal() {
  document.getElementById('createTenantModal').classList.add('hidden');
}

/**
 * Crear tenant
 */
document.getElementById('createTenantForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = getAuthToken();
  const nombre = document.getElementById('tenantName').value.trim();
  const email = document.getElementById('tenantEmail').value.trim();
  const password = document.getElementById('tenantPassword').value;
  const apiKey = document.getElementById('tenantApiKey').value.trim();

  const modalError = document.getElementById('modalError');
  const modalSuccess = document.getElementById('modalSuccess');

  modalError.classList.add('hidden');
  modalSuccess.classList.add('hidden');

  try {
    const response = await fetch('/api/superadmin/tenants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, email, password, apiKey })
    });

    const data = await response.json();

    if (data.exito) {
      modalSuccess.textContent = '✅ Tenant creado exitosamente';
      modalSuccess.classList.remove('hidden');

      // Recargar lista de tenants
      await loadTenants();

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        hideCreateTenantModal();
      }, 2000);
    } else {
      modalError.textContent = data.mensaje || 'Error al crear tenant';
      modalError.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error:', error);
    modalError.textContent = 'Error de conexión. Intenta nuevamente.';
    modalError.classList.remove('hidden');
  }
});

/**
 * Suspender tenant
 */
async function suspendTenant(tenantId, tenantName) {
  if (!confirm(`¿Estás seguro de suspender el tenant "${tenantName}"?`)) {
    return;
  }

  const token = getAuthToken();

  try {
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/suspend`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.exito) {
      alert(`Tenant "${tenantName}" suspendido exitosamente`);
      await loadTenants();
    } else {
      alert(`Error: ${data.mensaje}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión. Intenta nuevamente.');
  }
}

/**
 * Activar tenant
 */
async function activateTenant(tenantId, tenantName) {
  if (!confirm(`¿Estás seguro de activar el tenant "${tenantName}"?`)) {
    return;
  }

  const token = getAuthToken();

  try {
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/activate`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.exito) {
      alert(`Tenant "${tenantName}" activado exitosamente`);
      await loadTenants();
    } else {
      alert(`Error: ${data.mensaje}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión. Intenta nuevamente.');
  }
}

/**
 * Cargar logs de auditoría
 */
async function loadAuditLogs() {
  const token = getAuthToken();

  try {
    const response = await fetch('/api/superadmin/audit-logs?limit=50', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.exito) {
      renderAuditLogs(data.logs);
    } else {
      console.error('Error cargando logs:', data.mensaje);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Renderizar tabla de auditoría
 */
function renderAuditLogs(logs) {
  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No hay logs de auditoría</td></tr>';
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    const fecha = new Date(log.created_at).toLocaleString();

    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.user_email}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.action}</td>
      <td class="px-6 py-4 text-sm text-gray-500">${log.details ? JSON.stringify(log.details) : '-'}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  const apiErrorModal = document.getElementById('apiErrorModal');
  apiErrorModal.addEventListener('click', event => {
    if (event.target === apiErrorModal) closeApiErrorModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeApiErrorModal();
      closeEditTenantModal();
    }
  });
  document.getElementById('editTenantModal').addEventListener('click', event => {
    if (event.target.id === 'editTenantModal') closeEditTenantModal();
  });

  document.getElementById('editTenantForm').addEventListener('submit', async event => {
    event.preventDefault();
    const tenantId = document.getElementById('editTenantId').value;
    const errorBox = document.getElementById('editTenantError');
    const saveButton = document.getElementById('editTenantSaveButton');
    const payload = {
      nombre: document.getElementById('editTenantName').value.trim(),
      email: document.getElementById('editTenantEmail').value.trim(),
      apiKey: document.getElementById('editTenantApiKey').value
    };
    saveButton.disabled = true;
    saveButton.textContent = 'Guardando…';
    errorBox.classList.add('hidden');
    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.exito) throw new Error(data.mensaje || 'No se pudo guardar el cliente');
      closeEditTenantModal();
      await loadTenants();
    } catch (error) {
      errorBox.textContent = error.message || 'No se pudo guardar el cliente';
      errorBox.classList.remove('hidden');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Guardar';
    }
  });

  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    await loadApiStatusSchedule();
    window.setInterval(renderApiStatusCountdown, 1000);
    window.setInterval(loadApiStatusSchedule, 30000);
    showTab('tenants');
  }
});
