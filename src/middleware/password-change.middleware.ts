import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para requerir cambio de contraseña
 * Debe usarse DESPUÉS de authMiddleware
 *
 * Si must_change_password es true, bloquea la petición y redirige a cambio de contraseña
 *
 * Uso:
 * router.use('/api/dashboard',
 *   authMiddleware,
 *   requireRole(['tenant_admin']),
 *   requirePasswordChange,  // <-- Verifica si debe cambiar password
 *   tenantController.dashboard
 * );
 */
export const requirePasswordChange = (req: Request, res: Response, next: NextFunction): void => {
  // Verificar que el usuario existe (debe pasar por authMiddleware primero)
  if (!req.user) {
    res.status(401).json({
      exito: false,
      mensaje: 'No autenticado',
      errores: ['Debe iniciar sesión']
    });
    return;
  }

  // Si must_change_password es true, bloquear la petición
  if (req.user.must_change_password) {
    res.status(403).json({
      exito: false,
      mensaje: 'Debe cambiar su contraseña antes de continuar',
      mustChangePassword: true,
      changePasswordUrl: '/api/auth/change-password',
      errores: [
        'Por seguridad, debe cambiar su contraseña antes de usar el sistema',
        'Vaya a Cambiar Contraseña para continuar'
      ]
    });
    return;
  }

  next();
};

/**
 * Middleware opcional de cambio de contraseña
 * Solo avisa si debe cambiar contraseña, pero no bloquea la petición
 */
export const suggestPasswordChange = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.must_change_password) {
    // Agregar header de aviso
    res.setHeader('X-Password-Change-Required', 'true');
  }

  next();
};
