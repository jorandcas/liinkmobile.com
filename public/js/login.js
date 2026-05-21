/**
 * Login Form Handler - Sistema Multitenant DN Verification
 */

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorDiv = document.getElementById('error');
const submitBtn = loginForm.querySelector('button[type="submit"]');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoader = submitBtn.querySelector('.btn-loader');

/**
 * Mostrar mensaje de error
 */
function showError(message, isError = true) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-green-50', 'text-green-700');

  if (isError) {
    errorDiv.classList.add('bg-red-50', 'text-red-700');
  } else {
    errorDiv.classList.add('bg-green-50', 'text-green-700');
  }

  errorDiv.style.display = 'block';

  // Ocultar después de 5 segundos
  setTimeout(() => {
    errorDiv.classList.add('hidden');
    errorDiv.style.display = 'none';
  }, 5000);
}

/**
 * Mostrar/ocultar loader
 */
function setLoading(isLoading) {
  if (isLoading) {
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    submitBtn.disabled = true;
    emailInput.disabled = true;
    passwordInput.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    submitBtn.disabled = false;
    emailInput.disabled = false;
    passwordInput.disabled = false;
  }
}

/**
 * Guardar token y datos de usuario en localStorage
 */
function saveSession(token, user) {
  localStorage.setItem('authToken', token);
  localStorage.setItem('userData', JSON.stringify(user));
}

/**
 * Limpiar sesión
 */
function clearSession() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
}

/**
 * Redirigir según el rol del usuario y si debe cambiar contraseña
 */
function redirectToDashboard(user) {
  // Si debe cambiar contraseña, redirigir a cambio de contraseña
  if (user.must_change_password) {
    window.location.href = '/cambiar-password.html';
    return;
  }

  // Redirigir según rol
  if (user.role === 'superadmin') {
    window.location.href = '/superadmin.html';
  } else {
    window.location.href = '/dashboard.html';
  }
}

/**
 * Verificar si ya hay una sesión activa
 */
async function checkExistingSession() {
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('userData');

  if (token && userData) {
    try {
      // Verificar si el token es válido
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.exito) {
        // Token válido, redirigir al dashboard correspondiente
        const user = data.user;
        redirectToDashboard(user);
      } else {
        // Token inválido o expirado
        clearSession();
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
      clearSession();
    }
  }
}

/**
 * Manejar submit del formulario
 */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Validaciones básicas
  if (!email || !password) {
    showError('Por favor completa todos los campos');
    return;
  }

  setLoading(true);
  errorDiv.style.display = 'none';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.exito) {
      // Login exitoso
      saveSession(data.token, data.user);
      showError('✅ Login exitoso. Redirigiendo...', false);

      // Redirigir después de 1 segundo
      setTimeout(() => {
        redirectToDashboard(data.user);
      }, 1000);
    } else {
      // Login fallido
      showError(data.mensaje || 'Error al iniciar sesión', true);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Error de conexión. Intenta nuevamente.', true);
  } finally {
    setLoading(false);
  }
});

// Verificar sesión existente al cargar la página
document.addEventListener('DOMContentLoaded', checkExistingSession);

// Permitir Enter para enviar formulario
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginForm.dispatchEvent(new Event('submit'));
  }
});
