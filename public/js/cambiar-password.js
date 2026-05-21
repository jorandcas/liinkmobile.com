/**
 * Cambio de Contraseña - Sistema Multitenant DN Verification
 */

const changePasswordForm = document.getElementById('changePasswordForm');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const messageDiv = document.getElementById('message');
const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoader = submitBtn.querySelector('.btn-loader');
const logoutBtn = document.getElementById('logoutBtn');

/**
 * Mostrar mensaje
 */
function showMessage(message, isSuccess = true) {
  messageDiv.textContent = message;
  messageDiv.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-green-50', 'text-green-700');

  if (isSuccess) {
    messageDiv.classList.add('bg-green-50', 'text-green-700');
  } else {
    messageDiv.classList.add('bg-red-50', 'text-red-700');
  }

  messageDiv.classList.remove('hidden');
}

/**
 * Mostrar/ocultar loader
 */
function setLoading(isLoading) {
  if (isLoading) {
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    submitBtn.disabled = true;
    currentPasswordInput.disabled = true;
    newPasswordInput.disabled = true;
    confirmPasswordInput.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    submitBtn.disabled = false;
    currentPasswordInput.disabled = false;
    newPasswordInput.disabled = false;
    confirmPasswordInput.disabled = false;
  }
}

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

    if (!data.exito) {
      logout();
      return false;
    }

    // Si ya no debe cambiar contraseña, redirigir al dashboard
    if (!data.user.must_change_password) {
      if (data.user.role === 'superadmin') {
        window.location.href = '/superadmin.html';
      } else {
        window.location.href = '/dashboard.html';
      }
      return false;
    }

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
 * Manejar submit del formulario
 */
changePasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validaciones
  if (newPassword.length < 8) {
    showMessage('La nueva contraseña debe tener al menos 8 caracteres', false);
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage('Las contraseñas no coinciden', false);
    return;
  }

  if (currentPassword === newPassword) {
    showMessage('La nueva contraseña debe ser diferente a la actual', false);
    return;
  }

  setLoading(true);
  messageDiv.classList.add('hidden');

  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await response.json();

    if (data.exito) {
      showMessage('✅ Contraseña cambiada exitosamente. Redirigiendo...', true);

      // Actualizar userData en localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      userData.must_change_password = false;
      localStorage.setItem('userData', JSON.stringify(userData));

      // Redirigir después de 2 segundos
      setTimeout(() => {
        if (userData.role === 'superadmin') {
          window.location.href = '/superadmin.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      }, 2000);
    } else {
      showMessage(data.mensaje || 'Error al cambiar contraseña', false);
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('Error de conexión. Intenta nuevamente.', false);
  } finally {
    setLoading(false);
  }
});

/**
 * Manejar logout
 */
logoutBtn.addEventListener('click', () => {
  if (confirm('¿Estás seguro de cerrar sesión?')) {
    logout();
  }
});

// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', checkAuth);
