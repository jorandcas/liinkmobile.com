import { Router } from 'express';
import { CampanaController } from '../controllers/campana.controller';
import { authMiddleware } from '../middleware/auth.middleware';

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
   * @route   POST /api/campanas/:id/reconsultar-fallidos
   * @desc    Reconsultar DN fallidos de una campaña
   * @access  Private
   */
  router.post('/:id/reconsultar-fallidos', authMiddleware, (req, res) => CampanaController.reconsultarFallidos(req, res));

  return router;
}
