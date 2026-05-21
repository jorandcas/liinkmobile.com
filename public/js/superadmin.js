/**
 * SuperAdmin Dashboard - Sistema Multitenant DN Verification
 */

let tenantsData = [];
let currentTab = 'tenants';

/**
 * Obtener token de autenticación
 */
function getAuthToken() {
  return localStorage.getItem('authToken');
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

    const apiStatusClass = tenant.api_status === 'valida' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const tenantStatusClass = tenant.tenant_status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

    const lastLogin = tenant.last_login_at ? new Date(tenant.last_login_at).toLocaleString() : 'Nunca';

    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${tenant.nombre}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tenant.email}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${apiStatusClass}">
          ${tenant.api_status || 'pendiente'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenantStatusClass}">
          ${tenant.tenant_status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lastLogin}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        ${tenant.tenant_status === 'activo'
          ? `<button onclick="suspendTenant(${tenant.id}, '${tenant.nombre}')" class="text-red-600 hover:text-red-900 mr-3">Suspender</button>`
          : `<button onclick="activateTenant(${tenant.id}, '${tenant.nombre}')" class="text-green-600 hover:text-green-900 mr-3">Activar</button>`
        }
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * Actualizar estadísticas de tenants
 */
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
  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    showTab('tenants');
  }
});
