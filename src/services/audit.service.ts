import { Pool } from 'pg';

/**
 * Servicio de auditoría para registrar acciones críticas del sistema
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
 * Registrar una acción en el log de auditoría
 *
 * @param tenantId - ID del tenant que realiza la acción
 * @param userEmail - Email del usuario
 * @param action - Tipo de acción (ej: 'tenant_created', 'tenant_suspended', 'login_success', 'login_failed')
 * @param details - Detalles adicionales en formato JSON
 * @param ipAddress - Dirección IP del cliente
 */
export async function logAction(
  tenantId: number | null,
  userEmail: string,
  action: string,
  details?: any,
  ipAddress?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_email, action, details, ip_address)
       VALUES ((SELECT id FROM tenants WHERE id = $1), $2, $3, $4, $5)`,
      [tenantId, userEmail, action, details ? JSON.stringify(details) : null, ipAddress || null]
    );
  } catch (error) {
    console.error('[AuditService] Error registrando acción:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Obtener logs de auditoría de un tenant específico
 */
export async function getAuditLogsByTenant(
  tenantId: number,
  limit: number = 50,
  offset: number = 0
): Promise<{
  success: boolean;
  logs?: any[];
  error?: string;
}> {
  try {
    const result = await pool.query(
      `SELECT
        id,
        tenant_id,
        user_email,
        action,
        details,
        ip_address,
        created_at
       FROM audit_logs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    return {
      success: true,
      logs: result.rows
    };
  } catch (error) {
    console.error('[AuditService] Error obteniendo logs:', error);
    return {
      success: false,
      error: 'Error al obtener logs de auditoría'
    };
  }
}

/**
 * Obtener todos los logs de auditoría (solo superadmin)
 */
export async function getAllAuditLogs(
  limit: number = 100,
  offset: number = 0,
  actionFilter?: string
): Promise<{
  success: boolean;
  logs?: any[];
  error?: string;
}> {
  try {
    let query = `
      SELECT
        id,
        tenant_id,
        user_email,
        action,
        details,
        ip_address,
        created_at
       FROM audit_logs
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (actionFilter) {
      paramCount++;
      query += ` WHERE action = $${paramCount}`;
      params.push(actionFilter);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      success: true,
      logs: result.rows
    };
  } catch (error) {
    console.error('[AuditService] Error obteniendo todos los logs:', error);
    return {
      success: false,
      error: 'Error al obtener logs de auditoría'
    };
  }
}

/**
 * Obtener estadísticas de auditoría
 */
export async function getAuditStats(): Promise<{
  success: boolean;
  stats?: any;
  error?: string;
}> {
  try {
    // Total de acciones por tipo
    const actionsResult = await pool.query(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `);

    // Total de logs
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM audit_logs');

    // Logs de las últimas 24 horas
    const recentResult = await pool.query(`
      SELECT COUNT(*) as recent
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    // Tenant más activo
    const activeTenantResult = await pool.query(`
      SELECT
        t.nombre,
        COUNT(a.id) as count
      FROM audit_logs a
      JOIN tenants t ON a.tenant_id = t.id
      GROUP BY t.id, t.nombre
      ORDER BY count DESC
      LIMIT 1
    `);

    return {
      success: true,
      stats: {
        totalActions: parseInt(totalResult.rows[0].total),
        recentActions: parseInt(recentResult.rows[0].recent),
        actionsByType: actionsResult.rows,
        mostActiveTenant: activeTenantResult.rows[0] || null
      }
    };
  } catch (error) {
    console.error('[AuditService] Error obteniendo estadísticas:', error);
    return {
      success: false,
      error: 'Error al obtener estadísticas de auditoría'
    };
  }
}
