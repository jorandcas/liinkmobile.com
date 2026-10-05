import { Router } from 'express';
import { CampanaController } from '../controllers/campana.controller';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Middleware de autenticación para SSE (Server-Sent Events)
 * Acepta token por query parameter porque EventSource no puede enviar headers
 */
async function authMiddlewareSSE(req: any, res: any, next: any) {
  try {
    // IMPORTANTE: Configurar headers SSE ANTES de cualquier posible error
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');


    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      console.log('[AuthMiddlewareSSE] ERROR: Token no proporcionado');
      res.write(`data: ${JSON.stringify({
        type: 'error',
        mensaje: 'No autorizado - Token no proporcionado'
      })}\n\n`);
      res.end();
      return;
    }

    req.headers.authorization = `Bearer ${token}`;
    await authMiddleware(req, res, next);
  } catch (error) {
    console.error('[AuthMiddlewareSSE] Error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      mensaje: 'Error de autenticación'
    })}\n\n`);
    res.end();
  }
}

/**
 * Crear router de campañas
 */
export function createCampanaRouter(): Router {
  const router = Router();

  /**
   * @route   POST /api/campanas
   * @desc    Crear nueva campaña
   * @access  Private
   */
  router.post('/', authMiddleware, (req, res) => CampanaController.crear(req, res));

  /**
   * @route   GET /api/campanas
   * @desc    Obtener todas las campañas del usuario
   * @access  Private
   */
  router.get('/', authMiddleware, (req, res) => CampanaController.obtenerTodas(req, res));

  /**
   * @route   POST /api/campanas/prueba
   * @desc    Crear campaña de prueba
   * @access  Private
   */
  router.post('/prueba', authMiddleware, (req, res) => CampanaController.crearPrueba(req, res));

  /**
   * @route   GET /api/campanas/numero-siguiente
   * @desc    Obtener siguiente número de campaña
   * @access  Private
   */
  router.get('/numero-siguiente', authMiddleware, (req, res) => CampanaController.obtenerSiguienteNumero(req, res));

  /**
   * @route   GET /api/campanas/:id
   * @desc    Obtener campaña por ID
   * @access  Private
   */
  router.get('/:id', authMiddleware, (req, res) => CampanaController.obtenerPorId(req, res));

  /**
   * @route   DELETE /api/campanas/:id
   * @desc    Eliminar campaña
   * @access  Private
   */
  router.delete('/:id', authMiddleware, (req, res) => CampanaController.eliminar(req, res));

  /**
   * @route   GET /api/campanas/:id/reconsultar-fallidos
   * @desc    Reconsultar DN fallidos de una campaña (SSE)
   * @access  Private (con token por query parameter)
   */
  router.get('/:id/reconsultar-fallidos', authMiddlewareSSE, (req, res) => CampanaController.reconsultarFallidos(req, res));

  return router;
}
