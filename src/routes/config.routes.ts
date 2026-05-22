import { Router } from 'express';
import { obtenerConfiguracion } from '../services/config.service';

/**
 * Crear router de configuración
 */
export function createConfigRouter(): Router {
  const router = Router();

  /**
   * GET /api/config
   * Obtiene la configuración del sistema
   */
  router.get('/', (_req, res) => {
    try {
      const config = obtenerConfiguracion();
      res.json({
        exito: true,
        config
      });
    } catch (error) {
      console.error('[Config] Error al obtener configuración:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener configuración del sistema'
      });
    }
  });

  return router;
}
