import { Router } from 'express';
import { SuperAdminController } from '../controllers/superadmin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/role.middleware';

/**
 * Crear router de SuperAdmin
 * Todas las rutas requieren ser superadmin
 */
export function createSuperAdminRouter(): Router {
  const router = Router();

  // Aplicar middlewares a todas las rutas
  router.use(authMiddleware, requireSuperAdmin);

  /**
   * @route   POST /api/superadmin/tenants
   * @desc    Crear un nuevo tenant
   * @access  SuperAdmin
   */
  router.post('/tenants', SuperAdminController.createTenant);

  /**
   * @route   GET /api/superadmin/tenants
   * @desc    Listar todos los tenants
   * @access  SuperAdmin
   */
  router.get('/tenants', SuperAdminController.listTenants);

  /**
   * @route   PATCH /api/superadmin/tenants/:id/suspend
   * @desc    Suspender un tenant
   * @access  SuperAdmin
   */
  router.patch('/tenants/:id/suspend', SuperAdminController.suspendTenant);

  /**
   * @route   PATCH /api/superadmin/tenants/:id/activate
   * @desc    Activar un tenant
   * @access  SuperAdmin
   */
  router.patch('/tenants/:id/activate', SuperAdminController.activateTenant);

  /**
   * @route   GET /api/superadmin/tenants/:id/apikey
   * @desc    Verificar API Key de un tenant (parcialmente oculta)
   * @access  SuperAdmin
   */
  router.get('/tenants/:id/apikey', SuperAdminController.checkTenantApiKey);

  /**
   * @route   GET /api/superadmin/audit-logs
   * @desc    Obtener logs de auditoría
   * @access  SuperAdmin
   */
  router.get('/audit-logs', SuperAdminController.getAuditLogs);

  /**
   * @route   GET /api/superadmin/audit-stats
   * @desc    Obtener estadísticas de auditoría
   * @access  SuperAdmin
   */
  router.get('/audit-stats', SuperAdminController.getAuditStats);

  return router;
}
