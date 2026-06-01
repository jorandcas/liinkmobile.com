import { Router } from 'express';
import { CampanaController } from '../controllers/campana.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';

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

    console.log('[AuthMiddlewareSSE] Iniciando - URL:', req.url);
    console.log('[AuthMiddlewareSSE] Query params:', req.query);

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

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.log('[AuthMiddlewareSSE] ERROR: JWT_SECRET no configurado');
      res.write(`data: ${JSON.stringify({
        type: 'error',
        mensaje: 'Error de configuración del servidor'
      })}\n\n`);
      res.end();
      return;
    }

    let payload: any;
    try {
      payload = jwt.verify(token, jwtSecret);
      console.log('[AuthMiddlewareSSE] Token válido - Payload:', payload);
    } catch (error) {
      console.log('[AuthMiddlewareSSE] ERROR: Token inválido -', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        mensaje: 'Token inválido o expirado'
      })}\n\n`);
      res.end();
      return;
    }

    // Agregar usuario al request
    req.user = {
      id: payload.userId,
      email: payload.email,
      nombre: payload.nombre,
      role: payload.role,
      tenant_id: payload.userId, // Para tenants, userId = tenant_id
      must_change_password: payload.must_change_password || false
    };

    console.log('[AuthMiddlewareSSE] Usuario autenticado:', req.user);
    next();
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
