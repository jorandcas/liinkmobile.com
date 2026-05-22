import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

/**
 * Extender Request para incluir usuario del JWT
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        nombre: string;
        role: string;
        tenant_id: number;
        must_change_password: boolean;
      };
    }
  }
}

// Pool para consultas a la base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bd_superadmin',
});

/**
 * Middleware de autenticación con JWT
 * Verifica que el usuario tenga un token válido
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autorizado',
        errores: ['Se requiere token de autenticación']
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Verificar token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[AuthMiddleware] JWT_SECRET no configurado');
      res.status(500).json({
        exito: false,
        mensaje: 'Error de configuración del servidor',
        errores: ['JWT_SECRET no configurado']
      });
      return;
    }

    let payload: any;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (error) {
      res.status(401).json({
        exito: false,
        mensaje: 'Token inválido o expirado',
        errores: ['Sesión no válida o ha expirado']
      });
      return;
    }

    // Verificar que el usuario exista y esté activo en la base de datos
    const result = await pool.query(
      `SELECT
        id,
        nombre,
        email,
        role,
        tenant_status,
        must_change_password,
        locked_until
       FROM tenants
       WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        exito: false,
        mensaje: 'Usuario no encontrado',
        errores: ['El usuario no existe en el sistema']
      });
      return;
    }

    const user = result.rows[0];

    // Verificar si el tenant está activo
    if (user.tenant_status !== 'activo') {
      res.status(403).json({
        exito: false,
        mensaje: 'Cuenta inactiva',
        errores: ['Su cuenta está suspendida. Contacte al administrador.']
      });
      return;
    }

    // Verificar si la cuenta está bloqueada por intentos fallidos
    if (user.locked_until && user.locked_until > new Date()) {
      res.status(423).json({
        exito: false,
        mensaje: 'Cuenta bloqueada temporalmente',
        errores: [`Su cuenta está bloqueada hasta ${user.locked_until.toLocaleString()}`]
      });
      return;
    }

    // Agregar usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      tenant_id: user.id,
      must_change_password: user.must_change_password
    };

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error de autenticación',
      errores: ['Error al verificar sesión']
    });
  }
}

/**
 * Middleware opcional de autenticación
 * No rechaza la petición si no hay token, pero agrega el usuario si existe
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const jwtSecret = process.env.JWT_SECRET;

      if (jwtSecret) {
        try {
          const payload = jwt.verify(token, jwtSecret) as any;

          // Verificar usuario y agregar al request
          const result = await pool.query(
            'SELECT id, nombre, email, role, must_change_password FROM tenants WHERE id = $1',
            [payload.userId]
          );

          if (result.rows.length > 0) {
            const user = result.rows[0];
            req.user = {
              id: user.id,
              email: user.email,
              nombre: user.nombre,
              role: user.role,
              tenant_id: user.id,
              must_change_password: user.must_change_password
            };
          }
        } catch {
          // Token inválido, continuar sin usuario
        }
      }
    }

    next();
  } catch (error) {
    next();
  }
}
