import { Router } from 'express';
import { DistribuidorController } from '../controllers/distribuidor.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireTenantAdmin } from '../middleware/role.middleware';
import { requirePasswordChange } from '../middleware/password-change.middleware';
import multer from 'multer';

/**
 * Configuración de Multer para carga de archivos CSV
 */
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  }
});

/**
 * Router de distribuidores - MULTITENANT
 * Requiere autenticación y rol de tenant admin
 */
export function createDistribuidorRouter(): Router {
  const router = Router();
  const controller = new DistribuidorController();

  // Middlewares para todas las rutas (en orden: auth → role → password change)
  const tenantMiddlewares = [
    authMiddleware,
    requireTenantAdmin,
    requirePasswordChange
  ];

  /**
   * @route   POST /api/validate/single
   * @desc    Validar un número individual
   * @body    { telefono: string, verificarEn?: ('QA' | 'PROD')[] }
   * @access  Private (Tenant Admin o SuperAdmin)
   */
  router.post('/validate/single', ...tenantMiddlewares, (req, res) => controller.validarIndividual(req, res));

  /**
   * @route   POST /api/validate/bulk
   * @desc    Validar múltiples números desde CSV
   * @form    { file: CSV, verificarEn?: ('QA' | 'PROD')[], maxConcurrent?: number }
   * @access  Private (Tenant Admin o SuperAdmin)
   */
  router.post('/validate/bulk', ...tenantMiddlewares, upload.single('file'), (req, res) => controller.validarMasiva(req, res));

  /**
   * @route   POST /api/validate/batch
   * @desc    Validar lote de números desde JSON
   * @body    { telefonos: string[], verificarEn?: ('QA' | 'PROD')[], maxConcurrent?: number }
   * @access  Private (Tenant Admin o SuperAdmin)
   */
  router.post('/validate/batch', ...tenantMiddlewares, (req, res) => controller.validarLote(req, res));

  return router;
}
