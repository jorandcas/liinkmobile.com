import { Request, Response } from 'express';
import { z } from 'zod';
import { login, changePassword, getUserById } from '../services/auth.service';
import { logAction } from '../services/audit.service';

/**
 * Schema de validación para login
 */
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

/**
 * Schema de validación para cambio de contraseña
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
});

/**
 * Controlador de autenticación
 */
export class AuthController {
  /**
   * Manejar login de usuario
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // Validar datos de entrada
      const validatedData = loginSchema.parse(req.body);

      // Autenticar
      const result = await login(
        validatedData.email,
        validatedData.password,
        req.ip
      );

      if (!result.success) {
        // Registrar intento fallido
        await logAction(
          null, // La identidad/tenant no se considera resuelta en un login fallido
          validatedData.email,
          'login_failed',
          { error: result.error },
          req.ip
        );

        res.status(401).json({
          exito: false,
          mensaje: result.error,
          errores: [result.error || 'Error de autenticación']
        });
        return;
      }

      // Registrar login exitoso
      await logAction(
        result.user!.id,
        result.user!.email,
        'login_success',
        {},
        req.ip
      );

      res.json({
        exito: true,
        token: result.token,
        user: {
          id: result.user!.id,
          email: result.user!.email,
          nombre: result.user!.nombre,
          role: result.user!.role,
          mustChangePassword: result.user!.must_change_password
        },
        mensaje: 'Login exitoso'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          exito: false,
          mensaje: 'Datos de entrada inválidos',
          errores: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
        return;
      }

      console.error('[AuthController] Error en login:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor',
        errores: ['Error al procesar el login']
      });
    }
  }

  /**
   * Obtener información del usuario actual
   */
  static async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado'
      });
      return;
    }

    try {
      const result = await getUserById(req.user.id);

      if (!result.success) {
        res.status(404).json({
          exito: false,
          mensaje: result.error
        });
        return;
      }

      res.json({
        exito: true,
        user: result.user
      });
    } catch (error) {
      console.error('[AuthController] Error obteniendo usuario:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener información del usuario'
      });
    }
  }

  /**
   * Cambiar contraseña
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado'
      });
      return;
    }

    try {
      const validatedData = changePasswordSchema.parse(req.body);

      const result = await changePassword(
        req.user.id,
        validatedData.currentPassword,
        validatedData.newPassword
      );

      if (!result.success) {
        res.status(400).json({
          exito: false,
          mensaje: result.error,
          errores: [result.error || 'Error al cambiar contraseña']
        });
        return;
      }

      // Registrar cambio de contraseña
      await logAction(
        req.user.id,
        req.user.email,
        'password_changed',
        {},
        req.ip
      );

      res.json({
        exito: true,
        mensaje: result.message
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          exito: false,
          mensaje: 'Datos de entrada inválidos',
          errores: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
        return;
      }

      console.error('[AuthController] Error cambiando contraseña:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al cambiar contraseña'
      });
    }
  }

  /**
   * Logout (cliente debe eliminar el token)
   */
  static async logout(req: Request, res: Response): Promise<void> {
    if (req.user) {
      // Registrar logout
      await logAction(
        req.user.id,
        req.user.email,
        'logout',
        {},
        req.ip
      );
    }

    res.json({
      exito: true,
      mensaje: 'Logout exitoso'
    });
  }
}
