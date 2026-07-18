import { Request, Response } from 'express';
import { z } from 'zod';
import { CampanaServiceDB } from '../services/campana.service.db';

/**
 * Schema para crear campaña
 */
const crearCampanaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  resultados: z.array(z.object({
    telefono: z.string(),
    entorno: z.string(),
    exito: z.boolean(),
    vinculado: z.boolean(),
    mensaje: z.string().optional()
  })).min(1, 'Debe haber al menos un resultado'),
  entorno: z.string(),
  estadisticas: z.object({
    totalProcesados: z.number(),
    exitosos: z.number(),
    fallidos: z.number(),
    tiempoTotal: z.number()
  })
});

/**
 * Controlador de campañas
 */
export class CampanaController {
  /**
   * Crear nueva campaña
   */
  static async crear(req: Request, res: Response): Promise<void> {
    try {
      // Validar datos
      const datos = crearCampanaSchema.parse(req.body);
      const usuarioEmail = (req as any).user?.email || 'desconocido';
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario sin tenant_id'
        });
        return;
      }

      const campana = await CampanaServiceDB.crear(datos, usuarioEmail, tenantId);

      res.json({
        exito: true,
        mensaje: 'Campaña creada exitosamente',
        datos: campana
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          exito: false,
          mensaje: 'Datos inválidos',
          errores: error.errors.map(e => e.message)
        });
        return;
      }

      console.error('[CampanaController] Error:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al crear campaña'
      });
    }
  }

  /**
   * Obtener todas las campañas
   */
  static async obtenerTodas(req: Request, res: Response): Promise<void> {
    try {
      const usuarioEmail = (req as any).user?.email;
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario sin tenant_id'
        });
        return;
      }

      const campanas = usuarioEmail
        ? await CampanaServiceDB.obtenerPorUsuario(usuarioEmail, tenantId)
        : await CampanaServiceDB.obtenerTodas(tenantId);

      res.json({
        exito: true,
        datos: campanas
      });
    } catch (error) {
      console.error('[CampanaController] Error:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener campañas'
      });
    }
  }

  /**
   * Obtener campaña por ID
   */
  static async obtenerPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario sin tenant_id'
        });
        return;
      }

      const campana = await CampanaServiceDB.obtenerPorId(id, tenantId);

      if (!campana) {
        res.status(404).json({
          exito: false,
          mensaje: 'Campaña no encontrada'
        });
        return;
      }

      res.json({
        exito: true,
        datos: campana
      });
    } catch (error) {
      console.error('[CampanaController] Error:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener campaña'
      });
    }
  }

  /**
   * Eliminar campaña
   */
  static async eliminar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario sin tenant_id'
        });
        return;
      }

      const eliminada = await CampanaServiceDB.eliminar(id, tenantId);

      if (!eliminada) {
        res.status(404).json({
          exito: false,
          mensaje: 'Campaña no encontrada'
        });
        return;
      }

      res.json({
        exito: true,
        mensaje: 'Campaña eliminada exitosamente'
      });
    } catch (error) {
      console.error('[CampanaController] Error:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al eliminar campaña'
      });
    }
  }

  /**
   * Crear campaña de prueba
   */
  static async crearPrueba(_req: Request, res: Response): Promise<void> {
    try {
      const campana = await CampanaService.crearCampanaPrueba();

      res.json({
        exito: true,
        mensaje: 'Campaña de prueba creada',
        datos: campana
      });
    } catch (error) {
      console.error('[CampanaController] Error:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al crear campaña de prueba'
      });
    }
  }

  /**
   * Obtener siguiente número de campaña
   */
  static async obtenerSiguienteNumero(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario sin tenant_id'
        });
        return;
      }

      const numero = await CampanaServiceDB.obtenerSiguienteNumero(tenantId);

      res.json({
        exito: true,
        datos: { numero }
      });
    } catch (error) {
      console.error('[CampanaController] Error:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener siguiente número'
      });
    }
  }

  /**
   * Reconsultar DN fallidos de una campaña (con SSE)
   */
  static async reconsultarFallidos(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          mensaje: 'No autorizado - Usuario sin tenant_id'
        })}\n\n`);
        res.end();
        return;
      }

      // Configurar headers para SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Verificar si hay otra campaña actualizándose
      const campaignUpdating = CampanaServiceDB.getCampaignUpdating();
      if (campaignUpdating) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          mensaje: `Ya hay una campaña actualizándose. Por favor espera a que termine.`
        })}\n\n`);
        res.end();
        return;
      }

      // Obtener campaña para contar fallidos
      const campana = await CampanaServiceDB.obtenerPorId(id, tenantId);
      if (!campana) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          mensaje: 'Campaña no encontrada'
        })}\n\n`);
        res.end();
        return;
      }

      // Contar DN fallidos
      const fallidos = campana.resultados.filter(r => !r.exito || !r.vinculado);
      const total = fallidos.length;

      if (total === 0) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          mensaje: 'No hay DN fallidos para reconsultar'
        })}\n\n`);
        res.end();
        return;
      }

      // Enviar evento de inicio con tiempo estimado
      const tiempoEstimado = total * 5; // 5 segundos por DN
      console.log('[CampanaController] Enviando evento START - Total:', total, 'Tiempo estimado:', tiempoEstimado);
      res.write(`data: ${JSON.stringify({
        type: 'start',
        total,
        tiempoEstimado,
        mensaje: `Reconsultando ${total} DN fallidos...`
      })}\n\n`);

      // Ejecutar re-consulta con callback de progreso
      try {
        console.log('[CampanaController] Iniciando re-consulta...');
        const campanaActualizada = await CampanaServiceDB.reconsultarFallidos(
          id,
          tenantId,
          (procesados, total) => {
            // Enviar progreso
            const porcentaje = Math.round((procesados / total) * 100);
            console.log(`[CampanaController] Progreso: ${procesados}/${total} (${porcentaje}%)`);
            res.write(`data: ${JSON.stringify({
              type: 'progress',
              procesados,
              total,
              porcentaje,
              mensaje: `Procesando ${procesados} de ${total} DN...`
            })}\n\n`);
          }
        );

        // Enviar evento de completado
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          campana: campanaActualizada,
          mensaje: 'Reconsulta completada exitosamente'
        })}\n\n`);

        res.end();
      } catch (error: any) {
        console.error('[CampanaController] Error en reconsulta:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          mensaje: error.message || 'Error al reconsultar DN'
        })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error('[CampanaController] Error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          exito: false,
          mensaje: 'Error al reconsultar DN fallidos'
        });
      }
    }
  }
}
