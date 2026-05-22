import { Request, Response } from 'express';
import { z } from 'zod';
import { CampanaService } from '../services/campana.service';

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

      const campana = await CampanaService.crear(datos, usuarioEmail);

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
      const campanas = usuarioEmail
        ? await CampanaService.obtenerPorUsuario(usuarioEmail)
        : await CampanaService.obtenerTodas();

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
      const campana = await CampanaService.obtenerPorId(id);

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
      const eliminada = await CampanaService.eliminar(id);

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
  static async obtenerSiguienteNumero(_req: Request, res: Response): Promise<void> {
    try {
      const numero = await CampanaService.obtenerSiguienteNumero();

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
}
