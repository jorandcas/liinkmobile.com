import { Request, Response } from 'express';
import { DistribuidorService } from '../services/distribuidor.service';
import { getTenantDatabaseConfig, getTenantApiKey } from '../services/tenant.service';
import { ApiResponse } from '../types/distribuidor.types';
import { z } from 'zod';

/**
 * Schemas de validación con Zod
 */
const ValidacionIndividualSchema = z.object({
  telefono: z.string().regex(/^\d{10,15}$/, 'Formato de teléfono inválido'),
  verificarEn: z.array(z.enum(['QA', 'PROD'])).optional()
});

const ValidacionMasivaSchema = z.object({
  verificarEn: z.array(z.enum(['QA', 'PROD'])).optional(),
  maxConcurrent: z.number().min(1).max(50).optional()
});

/**
 * Controlador de endpoints de distribuidores - MULTITENANT
 * Cada tenant usa su propia BD y API Key
 */
export class DistribuidorController {
  /**
   * Crear instancia del servicio para el tenant actual
   */
  private async createService(req: Request): Promise<DistribuidorService> {
    if (!req.user) {
      throw new Error('No autenticado');
    }

    // Obtener configuración de BD del tenant
    const dbConfigResult = await getTenantDatabaseConfig(req.user.tenant_id);
    if (!dbConfigResult.success || !dbConfigResult.config) {
      throw new Error('Error obteniendo configuración de BD del tenant');
    }

    // Obtener API Key del tenant (descifrada)
    const apiKeyResult = await getTenantApiKey(req.user.tenant_id);
    if (!apiKeyResult.success || !apiKeyResult.apiKey) {
      throw new Error('Error obteniendo API Key del tenant');
    }

    // Crear servicio con configuración del tenant
    return new DistribuidorService(
      req.user.tenant_id,
      dbConfigResult.config,
      apiKeyResult.apiKey
    );
  }

  /**
   * POST /api/validate/single
   * Validar un número individual
   */
  async validarIndividual(req: Request, res: Response): Promise<void> {
    let service: DistribuidorService | null = null;

    try {
      // Validar request
      const body = ValidacionIndividualSchema.parse(req.body);

      console.log(`[Tenant ${req.user?.tenant_id}] Validando teléfono individual: ${body.telefono}`);

      // Crear servicio para el tenant
      service = await this.createService(req);

      // Ejecutar validación
      const resultados = await service.validarIndividual(body);

      const response: ApiResponse<typeof resultados> = {
        exito: true,
        datos: resultados,
        mensaje: `Validación completada para ${body.telefono}`
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    } finally {
      if (service) {
        await service.close();
      }
    }
  }

  /**
   * POST /api/validate/batch
   * Validar múltiples números (lote)
   */
  async validarLote(req: Request, res: Response): Promise<void> {
    let service: DistribuidorService | null = null;

    try {
      const body = z.object({
        telefonos: z.array(z.string().regex(/^\d{10,15}$/)).min(1).max(100),
        verificarEn: z.array(z.enum(['QA', 'PROD'])).optional(),
        maxConcurrent: z.number().min(1).max(50).optional()
      }).parse(req.body);

      console.log(`[Tenant ${req.user?.tenant_id}] Validando lote de ${body.telefonos.length} teléfonos`);

      // Crear servicio para el tenant
      service = await this.createService(req);

      // Ejecutar validación
      const resultados = await service.validarLote(
        body.telefonos,
        body.verificarEn || ['PROD'],
        body.maxConcurrent
      );

      const estadisticas = service.obtenerEstadisticas(resultados);

      res.json({
        exito: true,
        datos: {
          resultados,
          estadisticas: {
            total: estadisticas.total,
            exitosos: estadisticas.exitosos,
            fallidos: estadisticas.fallidos,
            porcentajeExito: estadisticas.porcentajeExito,
            porcentajeFallo: estadisticas.porcentajeFallo
          }
        },
        mensaje: `Validación completada para ${body.telefonos.length} teléfonos`
      });
    } catch (error) {
      this.handleError(error, res);
    } finally {
      if (service) {
        await service.close();
      }
    }
  }

  /**
   * POST /api/validate/bulk
   * Validar múltiples números desde CSV con SSE para progreso
   */
  async validarMasiva(req: Request, res: Response): Promise<void> {
    let service: DistribuidorService | null = null;

    try {
      // Configurar headers SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Verificar archivo
      if (!req.file) {
        res.write(`data: ${JSON.stringify({ error: 'No se proporcionó archivo CSV' })}\n\n`);
        res.end();
        return;
      }

      console.log(`[Tenant ${req.user?.tenant_id}] Iniciando validación masiva desde CSV: ${req.file.originalname}`);

      // Crear servicio para el tenant
      service = await this.createService(req);

      // Parsear campos desde FormData (todo viene como string)
      const verificarEnRaw = req.body.verificarEn;
      const maxConcurrentRaw = req.body.maxConcurrent;

      // Parsear verificarEn (viene como string JSON)
      let verificarEn: ('QA' | 'PROD')[] = ['QA'];
      if (verificarEnRaw) {
        try {
          const parsed = JSON.parse(verificarEnRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            verificarEn = parsed;
          }
        } catch (e) {
          console.warn('[Controller] Error parseando verificarEn, usando QA por defecto');
        }
      }

      // Parsear maxConcurrent (viene como string)
      const maxConcurrent = maxConcurrentRaw ? parseInt(maxConcurrentRaw, 10) : undefined;

      // Validar con schema Zod
      const body = ValidacionMasivaSchema.parse({
        verificarEn,
        maxConcurrent
      });

      // Callback de progreso para SSE
      const onProgress = (procesados: number, total: number) => {
        const progreso = {
          tipo: 'progreso',
          procesados,
          total,
          porcentaje: Math.round((procesados / total) * 100)
        };
        res.write(`data: ${JSON.stringify(progreso)}\n\n`);
      };

      // Ejecutar validación masiva
      const resultado = await service.validarMasivaCSV(
        req.file.path,
        body.verificarEn || ['PROD'],
        body.maxConcurrent,
        onProgress
      );

      // Enviar resultado final
      const resultadoFinal = {
        tipo: 'completo',
        datos: resultado
      };

      console.log(`[Tenant ${req.user?.tenant_id}] Enviando resultado final:`, JSON.stringify(resultadoFinal, null, 2));

      res.write(`data: ${JSON.stringify(resultadoFinal)}\n\n`);
      res.end();

      console.log(`[Tenant ${req.user?.tenant_id}] Validación masiva completada: ${resultado.totalProcesados} procesados, ${resultado.exitosos} exitosos, ${resultado.fallidos} fallidos`);
    } catch (error) {
      console.error('[Controller] Error en validación masiva:', error);

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          tipo: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        })}\n\n`);
        res.end();
      }
    } finally {
      if (service) {
        await service.close();
      }
    }
  }

  /**
   * Manejo de errores
   */
  private handleError(error: unknown, res: Response): void {
    console.error('[DistribuidorController] Error:', error);

    if (error instanceof z.ZodError) {
      const errores = error.errors.map(err => ({
        campo: err.path.join('.'),
        mensaje: err.message
      }));

      res.status(400).json({
        exito: false,
        mensaje: 'Datos de entrada inválidos',
        errores
      });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor',
        errores: [{ campo: 'general', mensaje: error.message }]
      });
      return;
    }

    res.status(500).json({
      exito: false,
      mensaje: 'Error desconocido',
      errores: [{ campo: 'general', mensaje: 'Error al procesar la solicitud' }]
    });
  }
}
