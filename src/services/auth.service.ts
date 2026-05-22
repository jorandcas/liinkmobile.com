import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

/**
 * Servicio de autenticación con JWT y bcrypt
 */

// Pool para consultas a la base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bd_superadmin',
});

/**
 * Generar un token JWT
 */
export function generateToken(userId: number, email: string, role: string, nombre?: string): string {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiration = process.env.JWT_EXPIRATION || '24h';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está configurado en variables de entorno');
  }

  const payload: any = {
    userId,
    email,
    role
  };

  // Agregar nombre si está disponible
  if (nombre) {
    payload.nombre = nombre;
  }

  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiration } as jwt.SignOptions);
}

/**
 * Verificar un token JWT
 */
export function verifyToken(token: string): any {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está configurado en variables de entorno');
  }

  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Login de usuario
 * Verifica credenciales y genera token JWT
 */
export async function login(
  email: string,
  password: string,
  _ipAddress?: string
): Promise<{
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
}> {
  try {
    // Buscar usuario por email
    const result = await pool.query(
      `SELECT
        id,
        nombre,
        email,
        password_hash,
        role,
        tenant_status,
        must_change_password,
        failed_login_attempts,
        locked_until
       FROM tenants
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    const user = result.rows[0];

    // Verificar si el tenant está activo
    if (user.tenant_status !== 'activo') {
      return {
        success: false,
        error: 'Cuenta inactiva. Contacte al administrador.'
      };
    }

    // Verificar si la cuenta está bloqueada
    if (user.locked_until && user.locked_until > new Date()) {
      return {
        success: false,
        error: `Cuenta bloqueada temporalmente hasta ${user.locked_until.toLocaleString()}`
      };
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Incrementar intentos fallidos
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
      const newAttempts = (user.failed_login_attempts || 0) + 1;

      if (newAttempts >= maxAttempts) {
        // Bloquear cuenta
        const lockTime = parseInt(process.env.ACCOUNT_LOCK_TIME || '900'); // 15 minutos default
        const lockedUntil = new Date(Date.now() + lockTime * 1000);

        await pool.query(
          `UPDATE tenants
           SET failed_login_attempts = $1,
               locked_until = $2
           WHERE id = $3`,
          [newAttempts, lockedUntil, user.id]
        );

        return {
          success: false,
          error: `Cuenta bloqueada por múltiples intentos fallidos. Intente nuevamente después de ${lockTime / 60} minutos.`
        };
      }

      // Actualizar intentos fallidos sin bloquear
      await pool.query(
        `UPDATE tenants
         SET failed_login_attempts = $1
         WHERE id = $2`,
        [newAttempts, user.id]
      );

      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    // Resetear intentos fallidos y actualizar último login
    await pool.query(
      `UPDATE tenants
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Generar token
    const token = generateToken(user.id, user.email, user.role, user.nombre);

    // Retornar usuario sin el hash de contraseña
    const { password_hash, ...userWithoutPassword } = user;

    return {
      success: true,
      token,
      user: userWithoutPassword
    };
  } catch (error) {
    console.error('[AuthService] Error en login:', error);
    return {
      success: false,
      error: 'Error al procesar el login'
    };
  }
}

/**
 * Cambiar contraseña de usuario
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Obtener usuario y password actual
    const result = await pool.query(
      'SELECT password_hash FROM tenants WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }

    const user = result.rows[0];

    // Verificar contraseña actual
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return {
        success: false,
        error: 'La contraseña actual es incorrecta'
      };
    }

    // Validar longitud mínima de la nueva contraseña
    const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '8');
    if (newPassword.length < minLength) {
      return {
        success: false,
        error: `La contraseña debe tener al menos ${minLength} caracteres`
      };
    }

    // Hashear nueva contraseña
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña y quitar flag de must_change_password
    await pool.query(
      `UPDATE tenants
       SET password_hash = $1,
           must_change_password = false,
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, userId]
    );

    return {
      success: true,
      message: 'Contraseña cambiada exitosamente'
    };
  } catch (error) {
    console.error('[AuthService] Error cambiando contraseña:', error);
    return {
      success: false,
      error: 'Error al cambiar la contraseña'
    };
  }
}

/**
 * Obtener información del usuario por ID
 */
export async function getUserById(userId: number): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const result = await pool.query(
      `SELECT
        id,
        nombre,
        email,
        role,
        tenant_status,
        must_change_password,
        last_login_at,
        created_at
       FROM tenants
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }

    return {
      success: true,
      user: result.rows[0]
    };
  } catch (error) {
    console.error('[AuthService] Error obteniendo usuario:', error);
    return {
      success: false,
      error: 'Error al obtener usuario'
    };
  }
}
