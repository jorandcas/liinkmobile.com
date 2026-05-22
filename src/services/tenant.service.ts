import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import axios from 'axios';
import { encryptApiKey, decryptApiKey } from '../utils/encryption.util';
import { logAction } from './audit.service';

/**
 * Servicio para gestión de tenants (distribuidores)
 */

// Pool para consultas a la base de datos principal (superadmin)
const superAdminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bd_superadmin',
});

/**
 * Validar una API Key haciendo un test request al endpoint de DN
 * Usa el endpoint real: http://94.74.77.50:8010/api/v1/distribuidores/enrolamiento/{dn}
 */
async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const testPhone = process.env.VALIDATION_TEST_PHONE || '7773354612';
    const endpoint = 'http://94.74.77.50:8010/api/v1/distribuidores/enrolamiento';

    const response = await axios.get(`${endpoint}/${testPhone}`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'ConsumerName': 'Movistar'
      },
      timeout: 10000 // 10 segundos timeout
    });

    // Verificar que la respuesta tenga el formato esperado
    // La respuesta exitosa es: { success: true, data: { dn: "...", enrolado: false } }
    if (response.data.success === true && response.data.data && response.data.data.dn) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: 'API Key devolvió respuesta inválida'
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // El servidor respondió con un status code diferente de 2xx
        return {
          valid: false,
          error: `API Key inválida. Status: ${error.response.status}`
        };
      } else if (error.request) {
        // La request fue hecha pero no se recibió respuesta
        return {
          valid: false,
          error: 'No se pudo conectar al endpoint de DN. Verifica tu conexión.'
        };
      } else {
        // Error al configurar la request
        return {
          valid: false,
          error: `Error: ${error.message}`
        };
      }
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Crear la base de datos de un tenant
 */
async function createTenantDatabase(bdName: string): Promise<void> {
  const client = await superAdminPool.connect();

  try {
    // CREATE DATABASE no puede ejecutarse dentro de una transacción en PostgreSQL
    // Se debe ejecutar fuera del bloque de transacción
    await client.query(`CREATE DATABASE ${bdName}`);

    // Conectar a la nueva base de datos y crear tablas
    const tenantPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: bdName,
    });

    // Usar transacción para la creación de tablas
    const tenantClient = await tenantPool.connect();
    try {
      await tenantClient.query('BEGIN');

      // Crear tabla de validaciones
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS validaciones (
          id SERIAL PRIMARY KEY,
          telefono VARCHAR(20) NOT NULL,
          resultado JSONB NOT NULL,
          origen VARCHAR(10) NOT NULL,
          exitoso BOOLEAN NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Crear índices
      await tenantClient.query('CREATE INDEX IF NOT EXISTS idx_validaciones_telefono ON validaciones(telefono)');
      await tenantClient.query('CREATE INDEX IF NOT EXISTS idx_validaciones_origen ON validaciones(origen)');
      await tenantClient.query('CREATE INDEX IF NOT EXISTS idx_validaciones_created ON validaciones(created_at)');

      await tenantClient.query('COMMIT');
    } catch (error) {
      await tenantClient.query('ROLLBACK');
      throw error;
    } finally {
      tenantClient.release();
      tenantPool.end();
    }

    console.log(`[TenantService] Base de datos '${bdName}' creada exitosamente`);
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Crear un nuevo tenant (solo superadmin)
 */
export async function createTenant(
  adminTenantId: number,
  adminEmail: string,
  nombre: string,
  email: string,
  password: string,
  apiKey: string,
  ipAddress?: string
): Promise<{
  success: boolean;
  tenant?: any;
  error?: string;
}> {
  const client = await superAdminPool.connect();

  try {
    await client.query('BEGIN');

    // Validar que el nombre no exista
    const existingName = await client.query(
      'SELECT id FROM tenants WHERE nombre = $1',
      [nombre]
    );

    if (existingName.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Ya existe un tenant con ese nombre'
      };
    }

    // Validar que el email no exista
    const existingEmail = await client.query(
      'SELECT id FROM tenants WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Ya existe un usuario con ese email'
      };
    }

    // Validar API Key
    console.log(`[TenantService] Validando API Key para tenant '${nombre}'...`);
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `API Key inválida: ${validation.error}`
      };
    }

    console.log(`[TenantService] API Key válida para tenant '${nombre}'`);

    // Generar nombre de base de datos
    const bdName = `tenant_${nombre.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Crear base de datos del tenant
    console.log(`[TenantService] Creando base de datos '${bdName}'...`);
    await createTenantDatabase(bdName);

    // Cifrar API Key
    console.log(`[TenantService] Cifrando API Key...`);
    let encryptedApiKey: string;
    try {
      encryptedApiKey = encryptApiKey(apiKey);
    } catch (error) {
      await client.query('ROLLBACK');
      // Limpiar BD huérfana
      await superAdminPool.query(`DROP DATABASE IF EXISTS ${bdName}`);
      return {
        success: false,
        error: `Error cifrando API Key: ${error instanceof Error ? error.message : error}`
      };
    }

    // Hashear contraseña
    console.log(`[TenantService] Hasheando contraseña...`);
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(password, 10);
    } catch (error) {
      await client.query('ROLLBACK');
      // Limpiar BD huérfana
      await superAdminPool.query(`DROP DATABASE IF EXISTS ${bdName}`);
      return {
        success: false,
        error: `Error hasheando contraseña: ${error instanceof Error ? error.message : error}`
      };
    }

    // Insertar tenant
    console.log(`[TenantService] Insertando tenant en BD...`);
    let result;
    try {
      result = await client.query(
        `INSERT INTO tenants
          (nombre, email, password_hash, bd_name, api_key_encrypted, api_status, role, tenant_status, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING
           id,
           nombre,
           email,
           bd_name,
           api_status,
           tenant_status,
           role,
           must_change_password,
           created_at`,
        [
          nombre,
          email.toLowerCase(),
          passwordHash,
          bdName,
          encryptedApiKey,
          'valida',
          'tenant_admin', // role: tenant_admin
          'activo', // tenant_status: activo
          true // Debe cambiar contraseña al primer login
        ]
      );
    } catch (error) {
      await client.query('ROLLBACK');
      // Limpiar BD huérfana
      await superAdminPool.query(`DROP DATABASE IF EXISTS ${bdName}`);
      return {
        success: false,
        error: `Error insertando tenant: ${error instanceof Error ? error.message : error}`
      };
    }

    const tenant = result.rows[0];

    await client.query('COMMIT');

    // Registrar en auditoría
    await logAction(
      adminTenantId,
      adminEmail,
      'tenant_created',
      {
        tenantId: tenant.id,
        tenantName: nombre,
        tenantEmail: email,
        bdName
      },
      ipAddress
    );

    console.log(`[TenantService] Tenant '${nombre}' creado exitosamente (ID: ${tenant.id})`);

    return {
      success: true,
      tenant: {
        id: tenant.id,
        nombre: tenant.nombre,
        email: tenant.email,
        bdName: tenant.bd_name,
        apiStatus: tenant.api_status,
        tenantStatus: tenant.tenant_status,
        role: tenant.role,
        mustChangePassword: tenant.must_change_password,
        createdAt: tenant.created_at
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[TenantService] Error creando tenant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear tenant'
    };
  } finally {
    client.release();
  }
}

/**
 * Obtener todos los tenants (solo superadmin)
 */
export async function getAllTenants(): Promise<{
  success: boolean;
  tenants?: any[];
  error?: string;
}> {
  try {
    const result = await superAdminPool.query(
      `SELECT
        id,
        nombre,
        email,
        bd_name,
        api_status,
        tenant_status,
        role,
        must_change_password,
        last_login_at,
        failed_login_attempts,
        locked_until,
        created_at,
        updated_at
       FROM tenants
       WHERE role = 'tenant_admin'
       ORDER BY created_at DESC`
    );

    // No devolver la API Key cifrada por seguridad
    return {
      success: true,
      tenants: result.rows
    };
  } catch (error) {
    console.error('[TenantService] Error obteniendo tenants:', error);
    return {
      success: false,
      error: 'Error al obtener tenants'
    };
  }
}

/**
 * Suspender un tenant
 */
export async function suspendTenant(
  adminTenantId: number,
  adminEmail: string,
  tenantId: number,
  ipAddress?: string
): Promise<{
  success: boolean;
  tenant?: any;
  error?: string;
}> {
  try {
    const result = await superAdminPool.query(
      `UPDATE tenants
       SET tenant_status = 'suspendido',
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, nombre, email, tenant_status`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Tenant no encontrado'
      };
    }

    const tenant = result.rows[0];

    // Registrar en auditoría
    await logAction(
      adminTenantId,
      adminEmail,
      'tenant_suspended',
      {
        tenantId,
        tenantName: tenant.nombre
      },
      ipAddress
    );

    return {
      success: true,
      tenant
    };
  } catch (error) {
    console.error('[TenantService] Error suspendiendo tenant:', error);
    return {
      success: false,
      error: 'Error al suspender tenant'
    };
  }
}

/**
 * Activar un tenant
 */
export async function activateTenant(
  adminTenantId: number,
  adminEmail: string,
  tenantId: number,
  ipAddress?: string
): Promise<{
  success: boolean;
  tenant?: any;
  error?: string;
}> {
  try {
    const result = await superAdminPool.query(
      `UPDATE tenants
       SET tenant_status = 'activo',
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, nombre, email, tenant_status`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Tenant no encontrado'
      };
    }

    const tenant = result.rows[0];

    // Registrar en auditoría
    await logAction(
      adminTenantId,
      adminEmail,
      'tenant_activated',
      {
        tenantId,
        tenantName: tenant.nombre
      },
      ipAddress
    );

    return {
      success: true,
      tenant
    };
  } catch (error) {
    console.error('[TenantService] Error activando tenant:', error);
    return {
      success: false,
      error: 'Error al activar tenant'
    };
  }
}

/**
 * Obtener la API Key descifrada de un tenant
 */
export async function getTenantApiKey(tenantId: number): Promise<{
  success: boolean;
  apiKey?: string;
  error?: string;
}> {
  try {
    const result = await superAdminPool.query(
      'SELECT api_key_encrypted FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Tenant no encontrado'
      };
    }

    const encryptedApiKey = result.rows[0].api_key_encrypted;

    if (!encryptedApiKey) {
      return {
        success: false,
        error: 'El tenant no tiene API Key configurada'
      };
    }

    const apiKey = decryptApiKey(encryptedApiKey);

    return {
      success: true,
      apiKey
    };
  } catch (error) {
    console.error('[TenantService] Error obteniendo API Key:', error);
    return {
      success: false,
      error: 'Error al obtener API Key'
    };
  }
}

/**
 * Obtener la configuración de base de datos de un tenant
 */
export async function getTenantDatabaseConfig(tenantId: number): Promise<{
  success: boolean;
  config?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  error?: string;
}> {
  try {
    const result = await superAdminPool.query(
      'SELECT bd_name FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Tenant no encontrado'
      };
    }

    const bdName = result.rows[0].bd_name;

    return {
      success: true,
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: bdName
      }
    };
  } catch (error) {
    console.error('[TenantService] Error obteniendo config de BD:', error);
    return {
      success: false,
      error: 'Error al obtener configuración de base de datos'
    };
  }
}
