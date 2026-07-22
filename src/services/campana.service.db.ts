import { Campana, CrearCampanaRequest } from '../types/campana.types';
import { Pool } from 'pg';
import { getTenantDatabaseConfig } from './tenant.service';
import { DistribuidorService } from './distribuidor.service';
import { getTenantApiKey } from './tenant.service';

/**
 * Servicio de campañas con persistencia en PostgreSQL
 * Cada tenant tiene sus propias campañas en su base de datos
 */

// Sistema de bloqueo: solo una campaña se puede actualizar a la vez
let campaignUpdating: string | null = null;

export class CampanaServiceDB {
  /**
   * Obtener conexión a la BD del tenant
   */
  private static async getTenantConnection(tenantId: number): Promise<Pool> {
    const dbConfigResult = await getTenantDatabaseConfig(tenantId);
    if (!dbConfigResult.success || !dbConfigResult.config) {
      throw new Error('No se pudo obtener configuración de base de datos del tenant');
    }

    return new Pool(dbConfigResult.config);
  }

  /**
   * Obtener siguiente número de campaña para el tenant
   */
  static async obtenerSiguienteNumero(tenantId: number): Promise<number> {
    const pool = await this.getTenantConnection(tenantId);

    try {
      const result = await pool.query(
        'SELECT COALESCE(MAX(id), 0) + 1 as siguiente FROM campanas'
      );
      return result.rows[0].siguiente;
    } finally {
      await pool.end();
    }
  }

  /**
   * Crear una nueva campaña
   */
  static async crear(
    datos: CrearCampanaRequest,
    usuarioEmail: string,
    tenantId: number
  ): Promise<Campana> {
    const pool = await this.getTenantConnection(tenantId);

    try {
      await pool.query('BEGIN');

      // Generar código usando la función de PostgreSQL
      const codigoResult = await pool.query('SELECT generar_codigo_campana() as codigo');
      const codigo = codigoResult.rows[0].codigo;

      const ahora = new Date();
      const totalTelefonos = datos.resultados.length;
      const vinculados = datos.resultados.filter(resultado => resultado.exito && resultado.vinculado).length;
      const errores = datos.resultados.filter(resultado => !resultado.exito).length;
      const noVinculados = totalTelefonos - vinculados - errores;
      const validados = totalTelefonos - errores;
      const porcentajeVinculacion = totalTelefonos > 0
        ? vinculados / totalTelefonos * 100
        : 0;

      // Insertar campaña
      const insertResult = await pool.query(
        `INSERT INTO campanas (
          codigo, nombre, fecha, ultima_actualizacion,
          tipo, entorno, creado_por,
          total_telefonos, validados, vinculados, no_vinculados, errores, porcentaje_vinculacion,
          estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          codigo,
          datos.nombre,
          ahora,
          ahora,
          datos.resultados.length > 1 ? 'multiple' : 'individual',
          datos.entorno,
          usuarioEmail,
          totalTelefonos,
          validados,
          vinculados,
          noVinculados,
          errores,
          porcentajeVinculacion,
          'completada'
        ]
      );

      const campanaId = insertResult.rows[0].id;

      // Insertar resultados
      for (const resultado of datos.resultados) {
        await pool.query(
          `INSERT INTO resultados_campana (campana_id, telefono, estado, mensaje, validado_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            campanaId,
            resultado.telefono,
            !resultado.exito
              ? 'error'
              : resultado.vinculado ? 'vinculado' : 'no_vinculado',
            resultado.mensaje || '',
            ahora
          ]
        );
      }

      await pool.query('COMMIT');

      // Retornar campaña completa
      return await this.obtenerPorId(codigo, tenantId) as Campana;

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    } finally {
      await pool.end();
    }
  }

  /**
   * Obtener todas las campañas del tenant
   */
  static async obtenerTodas(tenantId: number): Promise<Campana[]> {
    const pool = await this.getTenantConnection(tenantId);

    try {
      const result = await pool.query(
        `SELECT
          c.*, json_agg(
            json_build_object(
              'telefono', r.telefono,
              'estado', r.estado,
              'mensaje', r.mensaje,
              'ultima_consulta', r.validado_at,
              'exito', CASE WHEN r.estado != 'error' THEN true ELSE false END,
              'vinculado', CASE WHEN r.estado = 'vinculado' THEN true ELSE false END
            )
          ) as resultados
        FROM campanas c
        LEFT JOIN resultados_campana r ON c.id = r.campana_id
        GROUP BY c.id
        ORDER BY c.fecha DESC`
      );

      return result.rows.map(row => this.mapRowToCampana(row));

    } finally {
      await pool.end();
    }
  }

  /**
   * Obtener campaña por ID (código)
   */
  static async obtenerPorId(id: string, tenantId: number): Promise<Campana | null> {
    const pool = await this.getTenantConnection(tenantId);

    try {
      const result = await pool.query(
        `SELECT
          c.*, json_agg(
            json_build_object(
              'telefono', r.telefono,
              'estado', r.estado,
              'mensaje', r.mensaje,
              'ultima_consulta', r.validado_at,
              'exito', CASE WHEN r.estado != 'error' THEN true ELSE false END,
              'vinculado', CASE WHEN r.estado = 'vinculado' THEN true ELSE false END
            )
          ) as resultados
        FROM campanas c
        LEFT JOIN resultados_campana r ON c.id = r.campana_id
        WHERE c.codigo = $1
        GROUP BY c.id`,
        [id]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToCampana(result.rows[0]);

    } finally {
      await pool.end();
    }
  }

  /**
   * Obtener campañas por usuario (email)
   */
  static async obtenerPorUsuario(email: string, tenantId: number): Promise<Campana[]> {
    const pool = await this.getTenantConnection(tenantId);

    try {
      const result = await pool.query(
        `SELECT
          c.*, json_agg(
            json_build_object(
              'telefono', r.telefono,
              'estado', r.estado,
              'mensaje', r.mensaje,
              'ultima_consulta', r.validado_at,
              'exito', CASE WHEN r.estado != 'error' THEN true ELSE false END,
              'vinculado', CASE WHEN r.estado = 'vinculado' THEN true ELSE false END
            )
          ) as resultados
        FROM campanas c
        LEFT JOIN resultados_campana r ON c.id = r.campana_id
        WHERE c.creado_por = $1
        GROUP BY c.id
        ORDER BY c.fecha DESC`,
        [email]
      );

      return result.rows.map(row => this.mapRowToCampana(row));

    } finally {
      await pool.end();
    }
  }

  /**
   * Eliminar campaña
   */
  static async eliminar(id: string, tenantId: number): Promise<boolean> {
    const pool = await this.getTenantConnection(tenantId);

    try {
      const result = await pool.query(
        'DELETE FROM campanas WHERE codigo = $1',
        [id]
      );

      return (result.rowCount ?? 0) > 0;

    } finally {
      await pool.end();
    }
  }

  /**
   * Verificar si hay una campaña actualizándose
   */
  static getCampaignUpdating(): string | null {
    return campaignUpdating;
  }

  /**
   * Reconsultar solo los DN fallidos de una campaña
   */
  static async reconsultarFallidos(
    campaignId: string,
    tenantId: number,
    onProgress?: (procesados: number, total: number) => void
  ): Promise<Campana> {
    // Verificar sistema de bloqueo
    if (campaignUpdating) {
      throw new Error(
        `Ya hay una campaña actualizándose: ${campaignUpdating}. ` +
        'Por favor espera a que termine antes de actualizar otra.'
      );
    }

    let pool: Pool | null = null;

    try {
      pool = await this.getTenantConnection(tenantId);
      await pool.query('BEGIN');

      // Bloquear sistema
      campaignUpdating = campaignId;

      // Obtener campaña
      const campanaResult = await pool.query(
        'SELECT id, codigo, nombre, entorno, estado FROM campanas WHERE codigo = $1',
        [campaignId]
      );

      if (campanaResult.rows.length === 0) {
        throw new Error('Campaña no encontrada');
      }

      const campana = campanaResult.rows[0];

      // Obtener resultados fallidos
      const fallidosResult = await pool.query(
        `SELECT id, telefono FROM resultados_campana
         WHERE campana_id = $1 AND estado != 'vinculado'`,
        [campana.id]
      );

      const fallidos = fallidosResult.rows;

      if (fallidos.length === 0) {
        throw new Error('No hay DN fallidos para reconsultar');
      }

      console.log(`[CampanaServiceDB] Reconsultando ${fallidos.length} DN fallidos de campaña ${campaignId}`);

      // Obtener API Key del tenant
      const apiKeyResult = await getTenantApiKey(tenantId);
      if (!apiKeyResult.success || !apiKeyResult.apiKey) {
        throw new Error('No se pudo obtener API Key del tenant');
      }

      const dbConfigResult = await getTenantDatabaseConfig(tenantId);
      if (!dbConfigResult.success || !dbConfigResult.config) {
        throw new Error('No se pudo obtener configuración de base de datos del tenant');
      }

      // Crear servicio de distribuidor
      const distribuidorService = new DistribuidorService(
        tenantId,
        dbConfigResult.config,
        apiKeyResult.apiKey
      );

      // Reconsultar cada DN fallido
      let actualizados = 0;
      for (let i = 0; i < fallidos.length; i++) {
        const fallido = fallidos[i];

        try {
          // Determinar entorno
          const ambientes: ('QA' | 'PROD')[] = campana.entorno === 'AMBOS'
            ? ['PROD']
            : [campana.entorno];

          const resultados = await distribuidorService.validarMultipleAmbientes(
            fallido.telefono,
            ambientes
          );

          if (resultados[0]) {
            const enrolado = resultados[0].datos?.data?.enrolado ?? false;

            // Actualizar resultado
            await pool.query(
              `UPDATE resultados_campana
               SET estado = $1, mensaje = $2, validado_at = $3
               WHERE id = $4`,
              [
                enrolado ? 'vinculado' : 'no_vinculado',
                enrolado
                  ? 'DN validado correctamente y está vinculado'
                  : 'DN no encontrado o no vinculado',
                new Date(),
                fallido.id
              ]
            );

            actualizados++;

            // Reportar progreso
            if (onProgress) {
              onProgress(i + 1, fallidos.length);
            }
          }

          // Delay de 5 segundos entre requests
          if (i < fallidos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(`[CampanaServiceDB] Error al reconsultar ${fallido.telefono}:`, error);
        }
      }

      // Actualizar estadísticas
      const statsResult = await pool.query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN estado = 'vinculado' THEN 1 ELSE 0 END) as vinculados
        FROM resultados_campana
        WHERE campana_id = $1`,
        [campana.id]
      );

      const stats = statsResult.rows[0];
      const total = parseInt(stats.total);
      const vinculados = parseInt(stats.vinculados);
      const noVinculados = total - vinculados;

      await pool.query(
        `UPDATE campanas
         SET validados = $1,
             vinculados = $2,
             no_vinculados = $3,
             porcentaje_vinculacion = $4,
             ultima_actualizacion = $5,
             estado = $6
         WHERE id = $7`,
        [
          total,
          vinculados,
          noVinculados,
          total > 0 ? (vinculados / total * 100).toFixed(2) : 0,
          new Date(),
          'completada',
          campana.id
        ]
      );

      await pool.query('COMMIT');

      console.log(`[CampanaServiceDB] Reconsulta completada: ${actualizados} DN actualizados`);

      return await this.obtenerPorId(campaignId, tenantId) as Campana;

    } catch (error) {
      if (pool) {
        await pool.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (pool) {
        await pool.end();
      }
      // Liberar bloqueo
      campaignUpdating = null;
    }
  }

  /**
   * Mapear una fila de BD a objeto Campana
   */
  private static mapRowToCampana(row: any): Campana {
    const resultados = row.resultados && row.resultados[0] ? row.resultados : [];

    return {
      id: row.codigo,
      nombre: row.nombre,
      fecha: row.fecha,
      ultima_actualizacion: row.ultima_actualizacion,
      tipo: row.tipo,
      entorno: row.entorno,
      estadisticas: {
        totalProcesados: row.total_telefonos,
        exitosos: row.vinculados,
        fallidos: row.no_vinculados + row.errores,
        tiempoTotal: 0, // No almacenamos esto en BD
        total_telefonos: row.total_telefonos,
        validados: row.validados,
        vinculados: row.vinculados,
        no_vinculados: row.no_vinculados,
        errores: row.errores,
        porcentaje_vinculacion: parseFloat(row.porcentaje_vinculacion || 0)
      },
      resultados: resultados,
      creadoPor: row.creado_por
    };
  }
}
