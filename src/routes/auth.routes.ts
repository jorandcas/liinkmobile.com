import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Crear router de autenticación
 */
export function createAuthRouter(): Router {
  const router = Router();

  /**
   * @route   POST /api/auth/login
   * @desc    Iniciar sesión
   * @access  Public
   */
  router.post('/login', AuthController.login);

  /**
   * @route   GET /api/auth/me
   * @desc    Obtener información del usuario actual
   * @access  Private (requiere token)
   */
  router.get('/me', authMiddleware, AuthController.me);

  /**
   * @route   POST /api/auth/change-password
   * @desc    Cambiar contraseña
   * @access  Private (requiere token)
   */
  router.post('/change-password', authMiddleware, AuthController.changePassword);

  /**
   * @route   POST /api/auth/logout
   * @desc    Cerrar sesión
   * @access  Private (requiere token)
   */
  router.post('/logout', authMiddleware, AuthController.logout);

  return router;
}
