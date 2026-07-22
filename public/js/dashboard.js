/**
 * Dashboard Handler con Sistema de Campañas
 * Estructura separada para validación individual y múltiple
 */

// DOM Elements - Header
const tenantTitle = document.getElementById('tenantTitle');
const distribuidorName = document.getElementById('distribuidorName');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

// DOM Elements - Validación Individual
const singlePhoneInput = document.getElementById('singlePhone');
const validateIndividualBtn = document.getElementById('validateIndividualBtn');
const individualResult = document.getElementById('individualResult');
const individualResultContent = document.getElementById('individualResultContent');
const phoneError = document.getElementById('phoneError');

// DOM Elements - Validación Múltiple
const csvFileInput = document.getElementById('csvFile');
const csvFileChangeInput = document.getElementById('csvFileChange');
const validateBulkBtn = document.getElementById('validateBulkBtn');
const bulkResult = document.getElementById('bulkResult');
const bulkResultContent = document.getElementById('bulkResultContent');
const downloadTemplateBtn = document.getElementById('downloadTemplate');
const downloadResultsBtn = document.getElementById('downloadResults');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressDetail = document.getElementById('progressDetail');
const progressProcessed = document.getElementById('progressProcessed');
const progressElapsed = document.getElementById('progressElapsed');
const progressRemaining = document.getElementById('progressRemaining');
const noFileSelected = document.getElementById('noFileSelected');
const fileSelected = document.getElementById('fileSelected');
const selectedFileName = document.getElementById('selectedFileName');
const clearFileBtn = document.getElementById('clearFileBtn');

// DOM Elements - Campañas
const campaignsList = document.getElementById('campaignsList');
const createTestCampaignBtn = document.getElementById('createTestCampaign');
const campaignModal = document.getElementById('campaignModal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const closeModalBtn = document.getElementById('closeModal');

// DOM Elements - Modal de Confirmación
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmDetails = document.getElementById('confirmDetails');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

// DOM Elements - Loading
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');

// DOM Elements - Toast de éxito
const successToast = document.getElementById('successToast');
const closeSuccessToast = document.getElementById('closeSuccessToast');

// DOM Elements - Save Campaign (creado dinámicamente)
let saveCampaignBtn = null;

// Get token from localStorage
let authToken = localStorage.getItem('authToken');
let lastValidationResults = null;
let selectedEnvironment = 'PROD'; // Global environment selection (default: PROD)

/**
 * Inicializar toggle de entorno
 */
function initEnvironmentToggle() {
  const toggle = document.getElementById('environmentToggle');
  if (!toggle) return;

  const buttons = toggle.querySelectorAll('.env-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const env = btn.dataset.env;
      if (env) {
        selectedEnvironment = env;

        // Update button styles
        buttons.forEach(b => {
          if (b === btn) {
            b.classList.remove('text-slate-500', 'hover:text-slate-900');
            b.classList.add('bg-white', 'text-slate-950', 'shadow-sm');
          } else {
            b.classList.remove('bg-white', 'text-slate-950', 'shadow-sm');
            b.classList.add('text-slate-500', 'hover:text-slate-900');
          }
        });

        // Update checkboxes to match
        document.querySelectorAll('input[name="individualEnvironment"], input[name="bulkEnvironment"]').forEach(cb => {
          cb.checked = (cb.value === env);
        });
      }
    });
  });
}

/**
 * Manejar selección de archivo CSV
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    showFileSelected(file);
    console.log('[FileSelect] Archivo seleccionado:', file.name);
  }
}

/**
 * Mostrar que un archivo está seleccionado
 */
function showFileSelected(file) {
  noFileSelected.classList.add('hidden');
  fileSelected.classList.remove('hidden');
  selectedFileName.textContent = file.name;
}

/**
 * Limpiar selección de archivo
 */
function clearFileSelection() {
  csvFileInput.value = '';
  csvFileChangeInput.value = '';
  noFileSelected.classList.remove('hidden');
  fileSelected.classList.add('hidden');
  selectedFileName.textContent = '';
  console.log('[FileSelect] Selección de archivo limpiada');
}

/**
 * Obtener el archivo seleccionado (desde cualquier input)
 */
function getSelectedFile() {
  // Priorizar el input principal
  if (csvFileInput.files[0]) {
    return csvFileInput.files[0];
  }
  // Si no, intentar con el input de cambio
  if (csvFileChangeInput.files[0]) {
    return csvFileChangeInput.files[0];
  }
  return null;
}

// Event listeners para selección de archivo
csvFileInput.addEventListener('change', handleFileSelect);
csvFileChangeInput.addEventListener('change', handleFileSelect);

// Event listener para botón de eliminar archivo
clearFileBtn.addEventListener('click', clearFileSelection);

// Event listener para cerrar toast de éxito
closeSuccessToast.addEventListener('click', hideSuccessToast);

/**
 * Cargar configuración del distribuidor
 */
function loadDistribuidorConfig() {
  console.log('[Dashboard] Cargando configuración del distribuidor...');

  fetch('/api/config')
    .then(response => {
      console.log('[Dashboard] Response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('[Dashboard] Config data:', data);
      if (data.exito && data.config) {
        console.log('[Dashboard] Distribuidor encontrado:', data.config.distribuidor);
        tenantTitle.textContent = data.config.distribuidor;
        distribuidorName.textContent = data.config.distribuidor;
      } else {
        console.log('[Dashboard] No hay config válida');
        distribuidorName.textContent = 'No configurado';
      }
    })
    .catch(error => {
      console.error('[Dashboard] Error cargando config:', error);
      distribuidorName.textContent = 'Error';
    });
}

/**
 * Verificar autenticación
 */
function checkAuth() {
  if (!authToken) {
    window.location.href = '/login.html';
    return false;
  }

  fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(response => response.json())
  .then(data => {
    if (data.exito) {
      userName.textContent = data.user.nombre || data.user.email;
      loadDistribuidorConfig();
      loadCampaigns();
    } else {
      logout();
    }
  })
  .catch(() => logout());

  return true;
}

/**
 * Cerrar sesión
 */
function logout() {
  localStorage.removeItem('authToken');
  window.location.href = '/login.html';
}

/**
 * Mostrar/ocultar loader
 */
function setLoading(show, message = 'Procesando...') {
  loadingMessage.textContent = message;
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

/**
 * Mostrar indicador de carga
 */
let bulkProgressStartedAt = 0;
let bulkProgressTimer = null;
let bulkStatusPollingTimer = null;
let bulkProgressProcessed = 0;
let bulkProgressTotal = 0;

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderBulkProgress() {
  const elapsedSeconds = bulkProgressStartedAt
    ? (Date.now() - bulkProgressStartedAt) / 1000
    : 0;
  const percentage = bulkProgressTotal > 0
    ? Math.round((bulkProgressProcessed / bulkProgressTotal) * 100)
    : 0;
  const secondsPerDn = bulkProgressProcessed > 0
    ? elapsedSeconds / bulkProgressProcessed
    : 3;
  const remainingSeconds = (bulkProgressTotal - bulkProgressProcessed) * secondsPerDn;

  progressBar.style.width = `${percentage}%`;
  progressText.textContent = `${percentage}%`;
  progressProcessed.textContent = `${bulkProgressProcessed} / ${bulkProgressTotal}`;
  progressElapsed.textContent = formatDuration(elapsedSeconds);
  progressRemaining.textContent = formatDuration(remainingSeconds);
}

async function pollBulkProgress() {
  try {
    const response = await fetch('/api/validate/bulk/status', {
      headers: { 'Authorization': `Bearer ${authToken}` },
      cache: 'no-store'
    });
    if (!response.ok) return;

    const payload = await response.json();
    const status = payload.datos;
    if (!status || status.total <= 0) return;

    updateProgressBar(status.procesados, status.total);
    if (status.estado === 'completado') {
      progressDetail.textContent = 'Validación completada. Preparando resultados...';
      validateBulkBtn.disabled = false;
      clearInterval(bulkStatusPollingTimer);
      bulkStatusPollingTimer = null;
    } else if (status.estado === 'error') {
      progressDetail.textContent = status.error || 'La validación terminó con error';
      validateBulkBtn.disabled = false;
      clearInterval(bulkStatusPollingTimer);
      bulkStatusPollingTimer = null;
    }
  } catch (error) {
    console.warn('[Progress] No se pudo consultar el estado:', error);
  }
}

function startBulkProgressPolling() {
  clearInterval(bulkStatusPollingTimer);
  void pollBulkProgress();
  bulkStatusPollingTimer = setInterval(pollBulkProgress, 1000);
}

function showProgressBar(total, iniciadoEn = null) {
  bulkProgressStartedAt = iniciadoEn ? new Date(iniciadoEn).getTime() : Date.now();
  bulkProgressProcessed = 0;
  bulkProgressTotal = total;
  progressContainer.classList.remove('hidden');
  progressDetail.textContent = 'Iniciando validación...';
  renderBulkProgress();
  clearInterval(bulkProgressTimer);
  bulkProgressTimer = setInterval(renderBulkProgress, 1000);
  startBulkProgressPolling();
  console.log('[ProgressBar] Mostrando indicador de carga');
}

async function getBulkProgressStatus() {
  const response = await fetch('/api/validate/bulk/status', {
    headers: { 'Authorization': `Bearer ${authToken}` },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.datos;
}

async function resumeActiveBulkProgress() {
  try {
    const status = await getBulkProgressStatus();
    if (status?.estado !== 'procesando' || status.total <= 0) return false;

    showProgressBar(status.total, status.iniciadoEn);
    updateProgressBar(status.procesados, status.total);
    progressDetail.textContent = `Validación activa: ${status.procesados} de ${status.total} DN`;
    validateBulkBtn.disabled = true;
    return true;
  } catch (error) {
    console.warn('[Progress] No se pudo recuperar la validación activa:', error);
    return false;
  }
}

/**
 * Ocultar indicador de carga
 */
function hideProgressBar() {
  clearInterval(bulkProgressTimer);
  bulkProgressTimer = null;
  clearInterval(bulkStatusPollingTimer);
  bulkStatusPollingTimer = null;
  progressContainer.classList.add('hidden');
}

/**
 * Actualizar indicador de progreso
 */
function updateProgressBar(procesados, total) {
  bulkProgressProcessed = procesados;
  bulkProgressTotal = total;
  progressDetail.textContent = `Validando número ${procesados} de ${total}...`;
  renderBulkProgress();
  console.log(`[Progreso] ${procesados}/${total} procesados`);
}

/**
 * Mostrar toast de éxito
 * @param {string} campaignName - Nombre de la campaña creada
 */
function showSuccessToast(campaignName = '') {
  console.log('[showSuccessToast] Iniciando...');
  console.log('[showSuccessToast] campaignName:', campaignName);
  console.log('[showSuccessToast] successToast element:', successToast);

  if (!successToast) {
    console.error('[showSuccessToast] ERROR: successToast element no existe');
    return;
  }

  console.log('[showSuccessToast] Removiendo clases hidden y animate-fade-out');
  successToast.classList.remove('hidden');
  successToast.classList.remove('animate-fade-out');
  successToast.classList.add('animate-slide-in');

  // Actualizar el mensaje con el nombre de la campaña si se proporciona
  const titleElement = successToast.querySelector('.text-base');
  const messageElement = successToast.querySelector('.text-sm');

  console.log('[showSuccessToast] titleElement:', titleElement);
  console.log('[showSuccessToast] messageElement:', messageElement);

  if (campaignName) {
    console.log('[showSuccessToast] Actualizando texto con nombre de campaña:', campaignName);
    titleElement.textContent = `¡${campaignName} creada con éxito!`;
    messageElement.textContent = 'Proceso terminado. Puedes ver los resultados en el historial de campañas';
  } else {
    console.log('[showSuccessToast] Actualizando texto sin nombre de campaña');
    titleElement.textContent = '¡Proceso terminado con éxito!';
    messageElement.textContent = 'La validación se ha completado correctamente';
  }

  // Ocultar automáticamente después de 6 segundos
  setTimeout(() => {
    console.log('[showSuccessToast] Ocultando toast automáticamente después de 6 segundos');
    hideSuccessToast();
  }, 6000);

  console.log('[showSuccessToast] Toast mostrado exitosamente');
}

/**
 * Ocultar toast de éxito
 */
function hideSuccessToast() {
  successToast.classList.add('animate-fade-out');
  setTimeout(() => {
    successToast.classList.add('hidden');
  }, 300);
}

/**
 * Obtener entornos seleccionados (usa el entorno global seleccionado)
 */
function getSelectedEnvironments(type) {
  // Usar el entorno seleccionado globalmente
  return [selectedEnvironment];
}

/**
 * Mostrar modal de confirmación personalizado
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje principal
 * @param {Array} details - Array de detalles a mostrar [{label, value}]
 * @returns {Promise<boolean>} - Promise que resuelve a true si confirma, false si cancela
 */
function showConfirmModal(title, message, details = []) {
  return new Promise((resolve) => {
    // Configurar contenido
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    // Construir detalles HTML
    if (details.length > 0) {
      const detailsHtml = details.map(detail => `
        <div class="flex justify-between items-center py-1">
          <span class="text-slate-600">${detail.label}:</span>
          <span class="font-bold text-slate-950">${detail.value}</span>
        </div>
      `).join('');
      confirmDetails.innerHTML = detailsHtml;
      confirmDetails.classList.remove('hidden');
    } else {
      confirmDetails.classList.add('hidden');
    }

    // Mostrar modal
    confirmModal.classList.remove('hidden');

    // Handler para botón Confirmar
    const handleConfirm = () => {
      confirmModal.classList.add('hidden');
      confirmOk.removeEventListener('click', handleConfirm);
      confirmCancel.removeEventListener('click', handleCancel);
      resolve(true);
    };

    // Handler para botón Cancelar
    const handleCancel = () => {
      confirmModal.classList.add('hidden');
      confirmOk.removeEventListener('click', handleConfirm);
      confirmCancel.removeEventListener('click', handleCancel);
      resolve(false);
    };

    // Agregar event listeners
    confirmOk.addEventListener('click', handleConfirm);
    confirmCancel.addEventListener('click', handleCancel);

    // Permitir cerrar con Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

// ============================================================================
// VALIDACIÓN INDIVIDUAL
// ============================================================================

/**
 * Validar entrada de teléfono - Solo números, 10 dígitos
 */
singlePhoneInput.addEventListener('input', function(e) {
  // Eliminar cualquier carácter que no sea número
  let value = e.target.value.replace(/\D/g, '');

  // Limitar a 10 dígitos
  if (value.length > 10) {
    value = value.slice(0, 10);
  }

  e.target.value = value;

  // Mostrar/ocultar error
  if (value.length === 10) {
    phoneError.classList.add('hidden');
    e.target.classList.remove('border-red-300');
    e.target.classList.add('border-gray-300');
  } else if (value.length > 0) {
    phoneError.classList.remove('hidden');
    e.target.classList.remove('border-gray-300');
    e.target.classList.add('border-red-300');
  } else {
    phoneError.classList.add('hidden');
    e.target.classList.remove('border-red-300');
    e.target.classList.add('border-gray-300');
  }
});

/**
 * Validar número individual
 */
validateIndividualBtn.addEventListener('click', async () => {
  const phone = singlePhoneInput.value.trim();

  // Validar que tenga exactamente 10 dígitos
  if (!phone || phone.length !== 10) {
    phoneError.classList.remove('hidden');
    singlePhoneInput.classList.remove('border-gray-300');
    singlePhoneInput.classList.add('border-red-300');
    return;
  }

  const verificarEn = getSelectedEnvironments('individual');

  // Confirmar antes de validar con modal personalizado
  const confirmacion = await showConfirmModal(
    'Confirmar Validación',
    '¿Deseas continuar con la validación?',
    [
      { label: 'Cantidad de DN(s)', value: '1' },
      { label: 'Teléfono', value: phone },
      { label: 'Entorno', value: verificarEn[0] }
    ]
  );

  if (!confirmacion) {
    return;
  }

  setLoading(true, 'Validando número...');

  try {
    const response = await fetch('/api/validate/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        telefono: phone,
        verificarEn
      })
    });

    const data = await response.json();
    showIndividualResult(data);
  } catch (error) {
    console.error('Error:', error);
    showIndividualResult({ exito: false, mensaje: 'Error de conexión' });
  } finally {
    setLoading(false);
  }
});

/**
 * Mostrar resultado individual
 */
function showIndividualResult(data) {
  individualResult.classList.remove('hidden');

  if (!data.exito) {
    individualResultContent.innerHTML = `
      <div class="bg-red-50 text-red-700 p-4 rounded-lg">
        <p class="font-medium mb-1">Error</p>
        <p class="text-sm">${data.mensaje || 'Error en la validación'}</p>
        ${data.errores && data.errores.length > 0 ? '<ul class="list-disc list-inside text-sm mt-2">' + data.errores.map(e => `<li>${e}</li>`).join('') + '</ul>' : ''}
      </div>
    `;
    return;
  }

  // Procesar resultados
  if (data.datos && Array.isArray(data.datos)) {
    let html = '<div class="space-y-3">';

    data.datos.forEach(resultado => {
      // Estado API: Exitosa si la API respondió (tiene datos), Fallida si hubo error
      const apiFunciono = resultado.exitoso === true;
      const bgColor = apiFunciono ? 'bg-green-50' : 'bg-red-50';
      const statusColor = apiFunciono ? 'text-green-700' : 'text-red-700';
      const entorno = resultado.origen || 'N/A';
      const telefono = resultado.telefono || 'N/A';

      // Obtener información del distribuidor desde datos.datos
      const datosInternos = resultado.datos;
      let vinculado = 'Falso';
      let mensaje = resultado.error || '-';
      let enrolado = false;

      if (datosInternos) {
        // La API de Movistar devuelve datos en este formato:
        // { success: true, data: { dn: "...", enrolado: true/false } }
        if (datosInternos.data && datosInternos.data.enrolado !== undefined) {
          enrolado = datosInternos.data.enrolado;
          vinculado = enrolado ? 'Verdadero' : 'Falso';
          mensaje = enrolado ? 'Número enrolado' : 'Número no enrolado';
        }
        // Compatibilidad con otros formatos
        else if (datosInternos.distribuidor) {
          vinculado = 'Verdadero';
          mensaje = `Distribuidor: ${datosInternos.distribuidor.nombre || 'Encontrado'}`;
        } else if (datosInternos.estado) {
          vinculado = 'Verdadero';
          mensaje = datosInternos.estado;
        }
      }

      html += `
        <div class="${bgColor} border border-gray-200 rounded-lg p-4">
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="font-medium text-gray-700">Entorno:</span>
              <span class="ml-2 font-semibold">${entorno}</span>
            </div>
            <div>
              <span class="font-medium text-gray-700">Teléfono:</span>
              <span class="ml-2">${telefono}</span>
            </div>
            <div>
              <span class="font-medium text-gray-700">Vinculado:</span>
              <span class="ml-2 font-semibold ${statusColor}">${vinculado}</span>
            </div>
            <div>
              <span class="font-medium text-gray-700">Estado API:</span>
              <span class="ml-2 ${statusColor}">${apiFunciono ? 'Exitosa' : 'Fallida'}</span>
            </div>
          </div>
          ${mensaje !== '-' ? `<div class="mt-2 text-sm"><span class="font-medium text-gray-700">Detalle:</span> ${mensaje}</div>` : ''}
        </div>
      `;
    });

    html += '</div>';
    individualResultContent.innerHTML = html;
  }
}

// ============================================================================
// VALIDACIÓN MÚLTIPLE (CSV)
// ============================================================================

/**
 * Validar lote desde CSV con SSE
 */
validateBulkBtn.addEventListener('click', async () => {
  if (await resumeActiveBulkProgress()) {
    alert('Ya existe una validación masiva en curso. Se muestra su progreso actual.');
    return;
  }

  const csvFile = getSelectedFile();

  if (!csvFile) {
    alert('Por favor selecciona un archivo CSV');
    return;
  }

  const verificarEn = getSelectedEnvironments('bulk');

  // Leer archivo para contar líneas antes de confirmar
  const fileText = await csvFile.text();
  const lineas = fileText.trim().split('\n').filter(linea => linea.trim());
  const cantidadNumeros = lineas.length;

  // Confirmar antes de validar con modal personalizado
  const tiempoEstimado = Math.ceil(cantidadNumeros * 3 / 60); // 3 seg por número
  const confirmacion = await showConfirmModal(
    'Confirmar Validación Masiva',
    '¿Deseas continuar con la validación masiva?',
    [
      { label: 'Total de DN(s)', value: cantidadNumeros },
      { label: 'Entorno', value: verificarEn[0] },
      { label: 'Tiempo estimado', value: `~${tiempoEstimado} minuto(s)` }
    ]
  );

  if (!confirmacion) {
    return;
  }

  const formData = new FormData();
  formData.append('file', csvFile);
  formData.append('verificarEn', JSON.stringify(verificarEn));
  formData.append('maxConcurrent', '10');

  // Mostrar barra de progreso
  showProgressBar(cantidadNumeros);
  validateBulkBtn.disabled = true;

  try {
    const response = await fetch('/api/validate/bulk', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error en la respuesta del servidor');
    }

    // Leer el stream SSE
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('No se pudo leer la respuesta');
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decodificar y agregar al buffer
      buffer += decoder.decode(value, { stream: true });

      // Procesar líneas completas
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Mantener la última línea incompleta en el buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('[SSE] Evento recibido:', data.tipo, data);

            if (data.tipo === 'progreso') {
              // Actualizar barra de progreso
              console.log('[SSE] Actualizando progreso:', data.procesados, 'de', data.total);
              updateProgressBar(data.procesados, data.total);
            } else if (data.tipo === 'completo') {
              // Validación completada
              console.log('[SSE] Validación completada, ocultando barra de progreso');
              hideProgressBar();

              // La campaña ya fue persistida por el backend.
              const nombreCampana = data.campana?.nombre || '';
              await loadCampaigns();

              // Mostrar toast de éxito con el nombre de la campaña
              console.log('[SSE] Mostrando toast con nombre:', nombreCampana);
              showSuccessToast(nombreCampana);

              // Limpiar selección de archivo
              console.log('[SSE] Limpiando selección de archivo...');
              clearFileSelection();

              // NO mostrar los resultados de validación (solo en el historial)
              console.log('[SSE] Finalizado proceso de validación');
            } else if (data.tipo === 'error') {
              // Error durante la validación
              hideProgressBar();
              showBulkResult({ exito: false, mensaje: data.error });
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    hideProgressBar();
    showBulkResult({ exito: false, mensaje: 'Error de conexión' });
  } finally {
    validateBulkBtn.disabled = false;
  }
});

/**
 * Crear campaña automáticamente después de validación bulk
 * @returns {string} Nombre de la campaña creada (vacío si falló)
 */
async function autoCreateCampaign(datos, verificarEn) {
  console.log('[autoCreateCampaign] Iniciando creación de campaña...');
  console.log('[autoCreateCampaign] datos:', datos);
  console.log('[autoCreateCampaign] verificarEn:', verificarEn);

  try {
    // Obtener siguiente número de campaña
    console.log('[autoCreateCampaign] Obteniendo número de siguiente campaña...');
    const numeroResponse = await fetch('/api/campanas/numero-siguiente', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const numeroData = await numeroResponse.json();
    console.log('[autoCreateCampaign] numeroResponse:', numeroData);
    const numero = numeroData.exito ? numeroData.datos.numero : Date.now();
    console.log('[autoCreateCampaign] Número de campaña:', numero);

    // datos es ResultadoValidacionMasiva: { totalProcesados, exitosos, fallidos, resultados, errores }
    const resultados = datos.resultados || [];
    console.log('[autoCreateCampaign] Cantidad de resultados:', resultados.length);

    if (resultados.length === 0) {
      console.log('[autoCreateCampaign] No hay resultados para guardar, retornando string vacío');
      return ''; // No hay resultados para guardar
    }

    // Preparar resultados en el formato esperado por la API de campañas
    const resultadosFormateados = resultados.map(r => {
      // Determinar si está vinculado
      let vinculado = false;
      const datosInternos = r.datos;
      if (datosInternos) {
        if (datosInternos.data && datosInternos.data.enrolado !== undefined) {
          vinculado = datosInternos.data.enrolado;
        } else if (datosInternos.distribuidor || datosInternos.estado) {
          vinculado = true;
        }
      }

      return {
        telefono: r.telefono || r.numero || 'N/A',
        entorno: r.origen || r.entorno || verificarEn.join('-'),
        exito: r.exitoso === true, // La API respondió correctamente, aunque no esté vinculado
        vinculado: vinculado,
        mensaje: r.mensaje || r.error || r.datos?.mensaje
      };
    });

    // Crear estadísticas para la campaña
    const estadisticas = {
      totalProcesados: datos.totalProcesados || resultados.length,
      exitosos: datos.exitosos || 0,
      fallidos: datos.fallidos || 0,
      tiempoTotal: resultados.length * 3 // 3 segundos por validación
    };

    const nombreCampana = `Campaña ${numero}`;
    console.log('[autoCreateCampaign] Nombre de campaña a crear:', nombreCampana);
    console.log('[autoCreateCampaign] Enviando solicitud POST /api/campanas...');

    // Crear campaña con nombre automático
    const response = await fetch('/api/campanas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        nombre: nombreCampana,
        resultados: resultadosFormateados,
        entorno: verificarEn.join('-'),
        estadisticas
      })
    });

    console.log('[autoCreateCampaign] Response status:', response.status);
    const data = await response.json();
    console.log('[autoCreateCampaign] Response data:', data);
    console.log('[autoCreateCampaign] data.exito:', data.exito);
    console.log('[autoCreateCampaign] data.datos:', data.datos);

    if (data.exito) {
      console.log('[autoCreateCampaign] ¡Campaña creada exitosamente!');
      console.log('[autoCreateCampaign] Nombre de campaña:', data.datos.nombre);
      console.log('[autoCreateCampaign] Recargando lista de campañas...');
      loadCampaigns(); // Recargar lista de campañas
      console.log('[autoCreateCampaign] Retornando nombre:', data.datos.nombre);
      return data.datos.nombre; // Devolver el nombre de la campaña
    } else {
      console.log('[autoCreateCampaign] ERROR: data.exito es false');
      console.log('[autoCreateCampaign] Mensaje de error:', data.mensaje);
    }

    console.log('[autoCreateCampaign] Retornando string vacío (data.exito = false)');
    return '';
  } catch (error) {
    console.error('[autoCreateCampaign] EXCEPCIÓN:', error);
    console.error('[autoCreateCampaign] Stack trace:', error.stack);
    return '';
  }
}

/**
 * Mostrar resultados múltiples
 */
function showBulkResult(data) {
  console.log('[showBulkResult] Datos recibidos:', data);
  console.log('[showBulkResult] totalProcesados:', data.totalProcesados);
  console.log('[showBulkResult] exitosos:', data.exitosos);
  console.log('[showBulkResult] fallidos:', data.fallidos);
  console.log('[showBulkResult] resultados:', data.resultados);
  console.log('[showBulkResult] cantidad de resultados:', data.resultados?.length || 0);

  bulkResult.classList.remove('hidden');
  bulkResultContent.innerHTML = formatBulkResults(data);
  lastValidationResults = data;
}

/**
 * Formatear resultados múltiples
 */
function formatBulkResults(data) {
  // Manejar dos estructuras posibles:
  // 1. Error: { exito: false, mensaje: "...", errores: [] }
  // 2. ResultadoValidacionMasiva: { totalProcesados, exitosos, fallidos, resultados, errores }

  const isError = data.exito === false;
  const isResultadoMasiva = data.totalProcesados !== undefined || data.resultados !== undefined;

  // Caso 1: Error
  if (isError) {
    return `
      <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
        <p class="font-medium mb-1">Error</p>
        <p class="text-sm">${data.mensaje || 'Error en la validación'}</p>
        ${data.errores && data.errores.length > 0 ? '<ul class="list-disc list-inside text-sm mt-2">' + data.errores.map(e => `<li>${e}</li>`).join('') + '</ul>' : ''}
      </div>
    `;
  }

  // Caso 2: ResultadoValidacionMasiva
  if (isResultadoMasiva) {
    const total = data.totalProcesados || 0;
    const exitosos = data.exitosos || 0;
    const fallidos = data.fallidos || 0;
    const resultados = data.resultados || [];
    const errores = data.errores || [];

    let html = '<div class="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-medium">Validación completada</div>';

    // Estadísticas
    html += `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-white p-3 rounded border">
          <div class="text-xs text-gray-500 uppercase">Total</div>
          <div class="text-lg font-semibold">${total}</div>
        </div>
        <div class="bg-green-50 p-3 rounded border border-green-200">
          <div class="text-xs text-gray-500 uppercase">Exitosos</div>
          <div class="text-lg font-semibold text-green-700">${exitosos}</div>
        </div>
        <div class="bg-red-50 p-3 rounded border border-red-200">
          <div class="text-xs text-gray-500 uppercase">Fallidos</div>
          <div class="text-lg font-semibold text-red-700">${fallidos}</div>
        </div>
        <div class="bg-white p-3 rounded border">
          <div class="text-xs text-gray-500 uppercase">Tiempo</div>
          <div class="text-lg font-semibold">${(total * 3 / 60).toFixed(1)}m</div>
        </div>
      </div>
    `;

    // Mostrar errores si los hay
    if (errores.length > 0) {
      html += `
        <div class="bg-amber-50 text-amber-700 p-3 rounded-lg mb-4">
          <p class="font-medium mb-2">Errores detectados:</p>
          <ul class="list-disc list-inside text-sm">
            ${errores.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Tabla de resultados
    if (resultados.length > 0) {
      console.log('[formatBulkResults] Renderizando tabla con', resultados.length, 'resultados');
      html += '<p class="text-sm font-medium mb-2">Resultados Detallados:</p>';
      html += '<div class="overflow-x-auto">';
      html += '<table class="w-full text-sm bg-white rounded border">';
      html += '<thead class="bg-gray-50 border-b"><tr>';
      html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Entorno</th>';
      html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Teléfono</th>';
      html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Estado API</th>';
      html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Vinculado</th>';
      html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Mensaje</th>';
      html += '</tr></thead><tbody>';

      resultados.forEach((resultado, index) => {
        console.log(`[formatBulkResults] Resultado ${index}:`, resultado);
        // Estado API: Exitosa si la API respondió (tiene datos), Fallida si hubo error
        const apiFunciono = resultado.exitoso === true;
        const statusBg = apiFunciono ? 'bg-green-50' : 'bg-red-50';
        const statusText = apiFunciono ? 'Exitosa' : 'Fallida';
        const entorno = resultado.origen || resultado.entorno || 'N/A';
        const telefono = resultado.telefono || resultado.numero || 'N/A';

        // Determinar si está vinculado
        let vinculado = 'Falso';
        const datosInternos = resultado.datos;
        if (datosInternos) {
          if (datosInternos.data && datosInternos.data.enrolado !== undefined) {
            vinculado = datosInternos.data.enrolado ? 'Verdadero' : 'Falso';
          } else if (datosInternos.distribuidor || datosInternos.estado) {
            vinculado = 'Verdadero';
          }
        }

        const mensaje = resultado.mensaje || resultado.error || resultado.datos?.mensaje || '-';

        html += `
          <tr class="border-b ${statusBg}">
            <td class="px-3 py-2 font-medium">${entorno}</td>
            <td class="px-3 py-2">${telefono}</td>
            <td class="px-3 py-2">${statusText}</td>
            <td class="px-3 py-2">${vinculado}</td>
            <td class="px-3 py-2">${mensaje}</td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
    }

    return html;
  }

  // Si no coincide con ningún formato conocido
  return '<div class="bg-gray-50 text-gray-700 p-4 rounded-lg mb-4">Formato de respuesta no reconocido</div>';
}

/**
 * Descargar plantilla CSV
 */
downloadTemplateBtn.addEventListener('click', () => {
  const csvContent = 'telefono\n1234567890\n0987654321\n5555555555';
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'formato_ejemplo.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
});

/**
 * Descargar resultados CSV
 */
if (downloadResultsBtn) {
  downloadResultsBtn.addEventListener('click', () => {
  console.log('[Download] lastValidationResults:', lastValidationResults);

  // lastValidationResults es ResultadoValidacionMasiva directamente
  if (!lastValidationResults || !lastValidationResults.resultados) {
    alert('No hay resultados para descargar');
    return;
  }

  const resultados = lastValidationResults.resultados;
  let csvContent = 'telefono,entorno,vinculado,estado_api,mensaje\n';

  if (Array.isArray(resultados)) {
    resultados.forEach(resultado => {
      const telefono = resultado.telefono || resultado.numero || 'N/A';
      const entorno = resultado.origen || resultado.entorno || 'N/A';

      // Determinar si está vinculado
      let vinculado = 'Falso';
      const datosInternos = resultado.datos;
      if (datosInternos) {
        if (datosInternos.data && datosInternos.data.enrolado !== undefined) {
          vinculado = datosInternos.data.enrolado ? 'Verdadero' : 'Falso';
        } else if (datosInternos.distribuidor || datosInternos.estado) {
          vinculado = 'Verdadero';
        }
      }

      const estado = resultado.exitoso === true ? 'Exitosa' : 'Fallida';
      const mensaje = resultado.mensaje || resultado.error || resultado.datos?.mensaje || '-';
      csvContent += `${telefono},${entorno},${vinculado},${estado},${mensaje}\n`;
    });
  }

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  a.download = `resultados_validacion_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  });
}

/**
 * Guardar como campaña
 * NOTA: Esta funcionalidad requiere que el botón sea creado dinámicamente
 * en los resultados individuales. Por ahora, las campañas solo se crean
 * automáticamente en validaciones masivas CSV.
 */
/*
saveCampaignBtn?.addEventListener('click', async () => {
  if (!lastValidationResults || !lastValidationResults.datos) {
    alert('No hay resultados para guardar');
    return;
  }

  const nombre = prompt('Nombre de la campaña:');
  if (!nombre) return;

  const datos = lastValidationResults.datos;
  const entorno = getSelectedEnvironments('bulk').join('-');

  let resultados = [];

  if (datos.resultados && Array.isArray(datos.resultados)) {
    resultados = datos.resultados.map(r => {
      // Determinar si está vinculado
      let vinculado = false;
      const datosInternos = r.datos;
      if (datosInternos) {
        if (datosInternos.data && datosInternos.data.enrolado !== undefined) {
          vinculado = datosInternos.data.enrolado;
        } else if (datosInternos.distribuidor || datosInternos.estado) {
          vinculado = true;
        }
      }

      return {
        telefono: r.telefono || r.numero || 'N/A',
        entorno: r.origen || r.entorno || entorno,
        exito: r.datos !== undefined, // exito = la API funcionó (tiene datos)
        vinculado: vinculado,
        mensaje: r.mensaje || r.error || r.datos?.mensaje
      };
    });
  }

  if (resultados.length === 0) {
    alert('No hay resultados para guardar');
    return;
  }

  setLoading(true, 'Guardando campaña...');

  try {
    const response = await fetch('/api/campanas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        nombre,
        resultados,
        entorno,
        estadisticas: datos.estadisticas || {
          totalProcesados: resultados.length,
          exitosos: resultados.filter(r => r.datos !== undefined).length,
          fallidos: resultados.filter(r => r.datos === undefined).length,
          tiempoTotal: 0
        }
      })
    });

    const data = await response.json();

    if (data.exito) {
      alert('Campaña guardada exitosamente');
      loadCampaigns();
    } else {
      alert('Error al guardar campaña: ' + data.mensaje);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión al guardar campaña');
  } finally {
    setLoading(false);
  }
});
*/

// ============================================================================
// GESTIÓN DE CAMPAÑAS
// ============================================================================

/**
 * Cargar campañas
 */
async function loadCampaigns() {
  console.log('[loadCampaigns] Iniciando carga de campañas...');
  try {
    const response = await fetch('/api/campanas', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    console.log('[loadCampaigns] Response status:', response.status);

    const data = await response.json();
    console.log('[loadCampaigns] Response data:', data);
    console.log('[loadCampaigns] data.exito:', data.exito);
    console.log('[loadCampaigns] Cantidad de campañas:', data.datos?.length || 0);

    // Actualizar contador
    const count = data.exito && data.datos ? data.datos.length : 0;
    const countEl = document.getElementById('campaignCount');
    if (countEl) {
      countEl.textContent = count;
      console.log('[loadCampaigns] Contador actualizado:', count);
    }

    if (data.exito && data.datos.length > 0) {
      console.log('[loadCampaigns] Renderizando', data.datos.length, 'campañas');
      renderCampaigns(data.datos);
    } else {
      console.log('[loadCampaigns] No hay campañas para mostrar');
      // Desktop: tabla vacía
      const desktopList = document.getElementById('campaignsListDesktop');
      if (desktopList) {
        desktopList.innerHTML = `
          <tr>
            <td colspan="6" class="px-8 py-8 text-center text-sm text-slate-500">
              No hay campañas guardadas
            </td>
          </tr>
        `;
      }

      // Mobile: lista vacía
      const mobileList = document.getElementById('campaignsListMobile');
      if (mobileList) {
        mobileList.innerHTML = '<p class="text-center text-sm text-slate-500">No hay campañas guardadas</p>';
      }
    }
    console.log('[loadCampaigns] Carga de campañas finalizada');
  } catch (error) {
    console.error('[loadCampaigns] Error al cargar campañas:', error);
  }
}

/**
 * Renderizar campañas
 */
function renderCampaigns(campaigns) {
  // Desktop table
  const desktopList = document.getElementById('campaignsListDesktop');
  if (desktopList) {
    desktopList.innerHTML = campaigns.map(campana => renderCampaignRow(campana)).join('');
  }

  // Mobile cards
  const mobileList = document.getElementById('campaignsListMobile');
  if (mobileList) {
    mobileList.innerHTML = campaigns.map(campana => renderCampaignMobileCard(campana)).join('');
  }
}

/**
 * Renderizar fila de campaña (desktop)
 */
function renderCampaignRow(campana) {
  const processed = campana.estadisticas.totalProcesados || 0;
  const successful = campana.estadisticas.exitosos || 0;
  const failed = campana.estadisticas.fallidos || 0;
  const percent = processed > 0 ? Math.round((processed / campana.resultados.length) * 100) : 0;

  const dateStr = new Date(campana.fecha).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Fecha de última actualización
  const ultimaActualizacion = campana.ultima_actualizacion
    ? new Date(campana.ultima_actualizacion).toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '<span class="text-slate-400">No actualizada</span>';

  // Verificar si ha sido actualizada después de la creación
  const fueActualizada = campana.ultima_actualizacion &&
    new Date(campana.ultima_actualizacion).getTime() > new Date(campana.fecha).getTime();

  const ultimaActualizacionClass = fueActualizada
    ? 'text-emerald-700 font-medium'
    : 'text-slate-500';

  return `
    <tr class="transition hover:bg-slate-50/80">
      <td class="px-8 py-5">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div>
            <p class="font-bold text-slate-950">${campana.nombre}</p>
            <p class="mt-1 text-xs text-slate-500">${dateStr}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-5">
        <p class="${ultimaActualizacionClass}">${ultimaActualizacion}</p>
      </td>
      <td class="px-4 py-5">
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          ${campana.entorno || 'QA'}
        </span>
      </td>
      <td class="px-4 py-5">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Completada
        </span>
      </td>
      <td class="px-4 py-5">
        <p class="font-bold text-slate-950">${campana.resultados.length}</p>
        <p class="text-xs text-slate-500">registros</p>
      </td>
      <td class="px-4 py-5">
        <div class="min-w-40">
          <div class="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>100% procesado</span>
            <span>${processed}/${campana.resultados.length}</span>
          </div>
          <div class="h-2 rounded-full bg-slate-100">
            <div class="h-2 rounded-full bg-emerald-500" style="width: 100%"></div>
          </div>
          <div class="mt-2 flex gap-3 text-xs">
            <span class="flex items-center gap-1 text-emerald-700">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              ${successful}
            </span>
            <span class="flex items-center gap-1 text-rose-600">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              ${failed}
            </span>
          </div>
        </div>
      </td>
      <td class="px-8 py-5">
        <div class="flex justify-end gap-2">
          <button onclick="viewCampaign('${campana.id}')" class="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          <button onclick="downloadCampaignCSVById('${campana.id}')" class="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
          </button>
          <button onclick="reconsultarCampaign('${campana.id}')" class="rounded-2xl border border-emerald-500 bg-emerald-50 p-2.5 text-emerald-700 hover:bg-emerald-100 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
    <!-- Fila de progreso de actualización (oculta por defecto) -->
    <tr id="updating-${campana.id}" class="hidden">
      <td colspan="6" class="px-8 py-4 bg-emerald-50/50">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p id="status-${campana.id}" class="text-sm font-medium text-emerald-700">
              Iniciando actualización...
            </p>
            <span id="progress-text-${campana.id}" class="text-xs text-emerald-600">
              Preparando...
            </span>
          </div>
          <div class="h-2.5 rounded-full bg-emerald-100 overflow-hidden">
            <div id="progress-${campana.id}" class="h-full rounded-full bg-emerald-500 transition-all duration-300" style="width: 0%"></div>
          </div>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Renderizar tarjeta de campaña (mobile)
 */
function renderCampaignMobileCard(campana) {
  const processed = campana.estadisticas.totalProcesados || 0;
  const successful = campana.estadisticas.exitosos || 0;
  const failed = campana.estadisticas.fallidos || 0;

  const dateStr = new Date(campana.fecha).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Fecha de última actualización
  const ultimaActualizacion = campana.ultima_actualizacion
    ? new Date(campana.ultima_actualizacion).toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'No actualizada';

  // Verificar si ha sido actualizada
  const fueActualizada = campana.ultima_actualizacion &&
    new Date(campana.ultima_actualizacion).getTime() > new Date(campana.fecha).getTime();

  const ultimaActualizacionClass = fueActualizada
    ? 'text-emerald-700 font-medium text-xs'
    : 'text-slate-500 text-xs';

  return `
    <div class="rounded-3xl border border-slate-200 bg-white p-5">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <p class="font-bold text-slate-950">${campana.nombre}</p>
          <p class="mt-1 text-xs text-slate-500">${dateStr}</p>
          ${fueActualizada
            ? `<p class="mt-1 ${ultimaActualizacionClass}">Actualizado: ${ultimaActualizacion}</p>`
            : ''
          }
        </div>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Completada
        </span>
      </div>
      <div class="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>100% procesado</span>
        <span>${processed}/${campana.resultados.length}</span>
      </div>
      <div class="h-2 rounded-full bg-slate-100">
        <div class="h-2 rounded-full bg-emerald-500" style="width: 100%"></div>
      </div>
      <div class="mt-4 flex gap-2">
        <button onclick="viewCampaign('${campana.id}')" class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
          Ver
        </button>
        <button onclick="downloadCampaignCSVById('${campana.id}')" class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
          Descargar
        </button>
        <button onclick="reconsultarCampaign('${campana.id}')" class="flex-1 rounded-2xl border border-emerald-500 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition">
          Actualizar
        </button>
      </div>
      <div id="updating-${campana.id}" class="hidden mt-3">
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div class="flex items-center gap-2 mb-2">
            <svg class="h-4 w-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-semibold text-emerald-800" id="status-${campana.id}">Actualizando...</span>
          </div>
          <div class="h-2 rounded-full bg-emerald-200 mb-2">
            <div class="h-2 rounded-full bg-emerald-500 transition-all duration-300" id="progress-${campana.id}" style="width: 0%"></div>
          </div>
          <p class="text-xs text-emerald-600" id="progress-text-${campana.id}">Preparando...</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Descargar campaña por ID (helper function)
 */
window.downloadCampaignCSVById = function(id) {
  // Obtener campaña primero
  fetch(`/api/campanas/${id}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(res => res.json())
  .then(data => {
    if (data.exito) {
      // Temporalmente setear currentCampaign y usar la función existente
      currentCampaign = data.datos;
      downloadCampaignCSV();
    }
  })
  .catch(err => console.error('Error:', err));
};

/**
 * Ver detalles de campaña
 */
window.viewCampaign = async function(id) {
  try {
    const response = await fetch(`/api/campanas/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (data.exito) {
      showCampaignModal(data.datos);
    } else {
      alert('Error al cargar campaña');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión');
  }
};

/**
 * Reconsultar DN fallidos de una campaña
 */
window.reconsultarCampaign = async function(id) {
  try {
    // Mostrar UI de progreso
    const updatingDiv = document.getElementById(`updating-${id}`);
    const progressBar = document.getElementById(`progress-${id}`);
    const progressText = document.getElementById(`progress-text-${id}`);
    const statusText = document.getElementById(`status-${id}`);

    if (updatingDiv) updatingDiv.classList.remove('hidden');

    // Conectar SSE (token como parámetro porque EventSource no soporta headers)
    const eventSource = new EventSource(`/api/campanas/${id}/reconsultar-fallidos?token=${authToken}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'start') {
        if (statusText) statusText.textContent = `Actualizando ${data.total} DN...`;
        if (progressText) {
          const minutos = Math.ceil(data.tiempoEstimado / 60);
          progressText.textContent = `Tiempo estimado: ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
        }
      }

      if (data.type === 'progress') {
        if (progressBar) progressBar.style.width = `${data.porcentaje}%`;
        if (progressText) progressText.textContent = `Procesando ${data.procesados} de ${data.total} DN...`;
        if (statusText) statusText.textContent = `${data.porcentaje}% completado`;
      }

      if (data.type === 'complete') {
        eventSource.close();

        if (statusText) statusText.textContent = '¡Actualizado correctamente!';
        if (progressText) progressText.textContent = 'Reconsulta completada';

        // Ocultar UI después de 2 segundos
        setTimeout(() => {
          if (updatingDiv) updatingDiv.classList.add('hidden');
          // Recargar campañas
          loadCampaigns();
        }, 2000);
      }

      if (data.type === 'error') {
        eventSource.close();
        alert(data.mensaje || 'Error al reconsultar DN');
        if (updatingDiv) updatingDiv.classList.add('hidden');
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
      alert('Error de conexión al reconsultar DN');
      if (updatingDiv) updatingDiv.classList.add('hidden');
    };

    // Guardar referencia para poder cerrar si es necesario
    window[`eventSource-${id}`] = eventSource;
  } catch (error) {
    console.error('Error:', error);
    alert('Error al iniciar reconsulta');
  }
};

let currentCampaign = null;

/**
 * Mostrar modal de campaña
 */
function showCampaignModal(campana) {
  currentCampaign = campana;
  modalTitle.textContent = campana.nombre;

  let html = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500">
          <p><strong>Fecha:</strong> ${new Date(campana.fecha).toLocaleString('es-ES')}</p>
          <p><strong>Tipo:</strong> Masiva</p>
          <p><strong>Entorno:</strong> ${campana.entorno}</p>
        </div>
        <button
          onclick="downloadCampaignCSV()"
          class="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          Exportar
        </button>
      </div>

      <div class="grid grid-cols-4 gap-3 bg-gray-50 p-3 rounded">
        <div class="text-center">
          <div class="text-lg font-semibold">${campana.estadisticas.totalProcesados || 0}</div>
          <div class="text-xs text-gray-500">Total</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold text-green-600">${campana.estadisticas.exitosos || 0}</div>
          <div class="text-xs text-gray-500">Exitosos</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold text-red-600">${campana.estadisticas.fallidos || 0}</div>
          <div class="text-xs text-gray-500">Fallidos</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold">${campana.estadisticas.tiempoTotal ? campana.estadisticas.tiempoTotal.toFixed(1) + 's' : 'N/A'}</div>
          <div class="text-xs text-gray-500">Tiempo</div>
        </div>
      </div>

      <div>
        <h4 class="text-sm font-medium mb-2">Resultados (${campana.resultados.length} números):</h4>
        <div class="max-h-96 overflow-y-auto border rounded">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left">Teléfono</th>
                <th class="px-3 py-2 text-left">Entorno</th>
                <th class="px-3 py-2 text-left">Estado API</th>
                <th class="px-3 py-2 text-left">Vinculado</th>
                <th class="px-3 py-2 text-left">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              ${campana.resultados.map(r => `
                <tr class="border-t ${r.exito ? 'bg-green-50' : 'bg-red-50'}">
                  <td class="px-3 py-2 font-medium">${r.telefono}</td>
                  <td class="px-3 py-2">${r.entorno || 'N/A'}</td>
                  <td class="px-3 py-2">${r.exito ? 'Exitosa' : 'Fallida'}</td>
                  <td class="px-3 py-2">${r.vinculado ? 'Verdadero' : 'Falso'}</td>
                  <td class="px-3 py-2">${r.mensaje || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  modalContent.innerHTML = html;
  campaignModal.classList.remove('hidden');
}

/**
 * Descargar campaña en CSV
 */
window.downloadCampaignCSV = function() {
  if (!currentCampaign || !currentCampaign.resultados) {
    alert('No hay campaña para descargar');
    return;
  }

  const campana = currentCampaign;

  let csvContent = 'telefono,entorno,vinculado,estado_api,mensaje\n';

  campana.resultados.forEach(r => {
    const telefono = r.telefono || 'N/A';
    const entorno = r.entorno || 'N/A'; // Usar entorno directamente
    const vinculado = r.vinculado ? 'Verdadero' : 'Falso';
    const estado = r.exito ? 'Exitosa' : 'Fallida'; // Usar exito (sin acento) como se guarda en BD
    const mensaje = r.mensaje || '-';

    csvContent += `${telefono},${entorno},${vinculado},${estado},${mensaje}\n`;
  });

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const fecha = new Date(campana.fecha).toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const nombreLimpio = campana.nombre.replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `CAMPAÑA_${nombreLimpio}_${fecha}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * Crear campaña de prueba
 */
createTestCampaignBtn.addEventListener('click', async () => {
  setLoading(true, 'Creando campaña de prueba...');

  try {
    const response = await fetch('/api/campanas/prueba', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (data.exito) {
      alert('Campaña de prueba creada exitosamente');
      loadCampaigns();
    } else {
      alert('Error al crear campaña de prueba');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión');
  } finally {
    setLoading(false);
  }
});

/**
 * Cerrar modal
 */
closeModalBtn.addEventListener('click', () => {
  campaignModal.classList.add('hidden');
});

campaignModal.addEventListener('click', (e) => {
  if (e.target === campaignModal) {
    campaignModal.classList.add('hidden');
  }
});

/**
 * Logout
 */
logoutBtn.addEventListener('click', logout);

// Verificar autenticación al cargar
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initEnvironmentToggle();
  void resumeActiveBulkProgress();
});
