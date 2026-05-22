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
   * Ahora usa el nombre del tenant desde el JWT
   */
  router.get('/', (req: any, res) => {
    try {
      const user = req.user;

      // Usar el nombre del tenant desde el JWT, o fallback a config del entorno
      let distribuidor = 'No configurado';

      if (user?.nombre) {
        // Capitalizar primera letra
        distribuidor = user.nombre.charAt(0).toUpperCase() + user.nombre.slice(1);
      } else {
        // Fallback al método anterior (para SuperAdmin o desarrollo)
        const config = obtenerConfiguracion();
        distribuidor = config.distribuidor;
      }

      res.json({
        exito: true,
        config: {
          distribuidor,
          ambiente: process.env.NODE_ENV || 'development',
          hasApiKeyQA: !!process.env.API_KEY_QA,
          hasApiKeyPROD: !!process.env.API_KEY_PROD
        }
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
