import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para verificar roles de usuario
 * Debe usarse DESPUÉS de authMiddleware
 *
 * Uso:
 * router.get('/admin', authMiddleware, requireRole(['superadmin']), adminHandler);
 * router.get('/dashboard', authMiddleware, requireRole(['tenant_admin', 'superadmin']), dashboardHandler);
 */

/**
 * Requiere que el usuario tenga uno de los roles especificados
 * @param roles - Array de roles permitidos
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Verificar que el usuario existe (debe pasar por authMiddleware primero)
    if (!req.user) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado',
        errores: ['Debe iniciar sesión para acceder a este recurso']
      });
      return;
    }

    // Verificar que el rol del usuario esté en la lista de roles permitidos
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        exito: false,
        mensaje: 'No autorizado',
        errores: [
          `No tiene permisos para acceder a este recurso`,
          `Rol requerido: ${roles.join(' o ')}`
        ]
      });
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar si es superadmin
 */
export const requireSuperAdmin = requireRole(['superadmin']);

/**
 * Middleware para verificar si es tenant admin o superadmin
 */
export const requireTenantAdmin = requireRole(['tenant_admin', 'superadmin']);
