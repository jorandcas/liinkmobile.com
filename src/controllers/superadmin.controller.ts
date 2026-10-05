import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createTenant,
  getAllTenants,
  suspendTenant,
  activateTenant,
  getTenantApiKey,
  getTenantForAdminAccess,
  updateTenant
} from '../services/tenant.service';
import { getAllAuditLogs, getAuditStats, logAction } from '../services/audit.service';
import { maskApiKey } from '../utils/encryption.util';
import jwt from 'jsonwebtoken';
import { checkTenantApiStatus, getApiStatusSchedule } from '../services/api-status.service';

/**
 * Schema de validación para crear tenant
 */
const createTenantSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre debe tener máximo 100 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  apiKey: z.string().min(1, 'La API Key es requerida')
});

const updateTenantSchema = z.object({
  nombre: z.string().min(1).max(100),
  email: z.string().email(),
  apiKey: z.string().optional()
});

/**
 * Controlador para SuperAdmin
 */
export class SuperAdminController {
  static getApiStatusSchedule(_req: Request, res: Response): void {
    res.json({ exito: true, schedule: getApiStatusSchedule() });
  }

  static async updateTenant(req: Request, res: Response): Promise<void> {
    const tenantId = Number(req.params.id);
    if (!req.user || !Number.isInteger(tenantId) || tenantId < 1) {
      res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
      return;
    }
    try {
      const body = updateTenantSchema.parse(req.body);
      const result = await updateTenant(
        tenantId,
        body.nombre,
        body.email,
        body.apiKey || undefined,
        req.user.id,
        req.user.email,
        req.ip
      );
      if (!result.success) {
        res.status(400).json({ exito: false, mensaje: result.error || 'No se pudo actualizar el cliente' });
        return;
      }
      res.json({ exito: true, tenant: result.tenant, mensaje: 'Cliente actualizado' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ exito: false, mensaje: error.errors[0]?.message || 'Datos inválidos' });
        return;
      }
      console.error('[SuperAdminController] Error actualizando cliente:', error);
      res.status(500).json({ exito: false, mensaje: 'No se pudo actualizar el cliente' });
    }
  }

  static async checkTenantApi(req: Request, res: Response): Promise<void> {
    const tenantId = Number(req.params.id);
    if (!Number.isInteger(tenantId) || tenantId < 1) {
      res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
      return;
    }
    try {
      const result = await checkTenantApiStatus(tenantId);
      await logAction(req.user!.id, req.user!.email, 'tenant_api_status_checked', {
        tenantId,
        status: result.api_status
      }, req.ip);
      res.json({ exito: true, api: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo revisar la API del cliente';
      const statusCode = message.includes('No se encontró una API key') ? 404 : 500;
      res.status(statusCode).json({
        exito: false,
        mensaje: message
      });
    }
  }

  static async createTenantAccess(req: Request, res: Response): Promise<void> {
    const tenantId = Number(req.params.id);
    if (!req.user || !Number.isInteger(tenantId) || tenantId < 1) {
      res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ exito: false, mensaje: 'JWT_SECRET no configurado' });
      return;
    }

    try {
      const tenant = await getTenantForAdminAccess(tenantId);
      if (!tenant) {
        res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado o inactivo' });
        return;
      }

      const token = jwt.sign({
        userId: tenant.id,
        email: tenant.email,
        nombre: tenant.nombre,
        role: 'tenant_admin',
        adminAccess: true,
        adminUserId: req.user.id
      }, jwtSecret, { expiresIn: 15 * 60 });

      await logAction(req.user.id, req.user.email, 'superadmin_tenant_access', {
        tenantId: tenant.id,
        tenantName: tenant.nombre,
        expiresInMinutes: 15
      }, req.ip);

      res.json({
        exito: true,
        token,
        tenant: { id: tenant.id, nombre: tenant.nombre },
        expiresInSeconds: 900
      });
    } catch (error) {
      console.error('[SuperAdminController] Error creando acceso al perfil:', error);
      res.status(500).json({ exito: false, mensaje: 'No se pudo abrir el perfil del cliente' });
    }
  }

  /**
   * Crear un nuevo tenant
   */
  static async createTenant(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado'
      });
      return;
    }

    try {
      const validatedData = createTenantSchema.parse(req.body);

      const result = await createTenant(
        req.user.id,
        req.user.email,
        validatedData.nombre,
        validatedData.email,
        validatedData.password,
        validatedData.apiKey,
        req.ip
      );

      if (!result.success) {
        res.status(400).json({
          exito: false,
          mensaje: result.error,
          errores: [result.error || 'Error al crear tenant']
        });
        return;
      }

      res.status(201).json({
        exito: true,
        tenant: result.tenant,
        mensaje: 'Tenant creado exitosamente'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          exito: false,
          mensaje: 'Datos de entrada inválidos',
          errores: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
        return;
      }

      console.error('[SuperAdminController] Error creando tenant:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al crear tenant',
        errores: ['Error interno del servidor']
      });
    }
  }

  /**
   * Listar todos los tenants
   */
  static async listTenants(_req: Request, res: Response): Promise<void> {
    try {
      const result = await getAllTenants();

      if (!result.success) {
        res.status(500).json({
          exito: false,
          mensaje: result.error
        });
        return;
      }

      res.json({
        exito: true,
        tenants: result.tenants
      });

    } catch (error) {
      console.error('[SuperAdminController] Error listando tenants:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener tenants'
      });
    }
  }

  /**
   * Suspender un tenant
   */
  static async suspendTenant(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado'
      });
      return;
    }

    try {
      const tenantId = parseInt(req.params.id);

      if (isNaN(tenantId)) {
        res.status(400).json({
          exito: false,
          mensaje: 'ID de tenant inválido'
        });
        return;
      }

      const result = await suspendTenant(
        req.user.id,
        req.user.email,
        tenantId,
        req.ip
      );

      if (!result.success) {
        res.status(400).json({
          exito: false,
          mensaje: result.error,
          errores: [result.error || 'Error al suspender tenant']
        });
        return;
      }

      res.json({
        exito: true,
        tenant: result.tenant,
        mensaje: 'Tenant suspendido exitosamente'
      });

    } catch (error) {
      console.error('[SuperAdminController] Error suspendiendo tenant:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al suspender tenant'
      });
    }
  }

  /**
   * Activar un tenant
   */
  static async activateTenant(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado'
      });
      return;
    }

    try {
      const tenantId = parseInt(req.params.id);

      if (isNaN(tenantId)) {
        res.status(400).json({
          exito: false,
          mensaje: 'ID de tenant inválido'
        });
        return;
      }

      const result = await activateTenant(
        req.user.id,
        req.user.email,
        tenantId,
        req.ip
      );

      if (!result.success) {
        res.status(400).json({
          exito: false,
          mensaje: result.error,
          errores: [result.error || 'Error al activar tenant']
        });
        return;
      }

      res.json({
        exito: true,
        tenant: result.tenant,
        mensaje: 'Tenant activado exitosamente'
      });

    } catch (error) {
      console.error('[SuperAdminController] Error activando tenant:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al activar tenant'
      });
    }
  }

  /**
   * Obtener logs de auditoría
   */
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const actionFilter = req.query.action as string;

      const result = await getAllAuditLogs(limit, offset, actionFilter);

      if (!result.success) {
        res.status(500).json({
          exito: false,
          mensaje: result.error
        });
        return;
      }

      res.json({
        exito: true,
        logs: result.logs
      });

    } catch (error) {
      console.error('[SuperAdminController] Error obteniendo logs:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener logs de auditoría'
      });
    }
  }

  /**
   * Obtener estadísticas de auditoría
   */
  static async getAuditStats(_req: Request, res: Response): Promise<void> {
    try {
      const result = await getAuditStats();

      if (!result.success) {
        res.status(500).json({
          exito: false,
          mensaje: result.error
        });
        return;
      }

      res.json({
        exito: true,
        stats: result.stats
      });

    } catch (error) {
      console.error('[SuperAdminController] Error obteniendo estadísticas:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener estadísticas'
      });
    }
  }

  /**
   * Verificar API Key de un tenant (para mostrar si es válida)
   */
  static async checkTenantApiKey(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = parseInt(req.params.id);

      if (isNaN(tenantId)) {
        res.status(400).json({
          exito: false,
          mensaje: 'ID de tenant inválido'
        });
        return;
      }

      const result = await getTenantApiKey(tenantId);

      if (!result.success) {
        res.status(404).json({
          exito: false,
          mensaje: result.error
        });
        return;
      }

      // Retornar API Key parcialmente oculta
      res.json({
        exito: true,
        apiKey: maskApiKey(result.apiKey!)
      });

    } catch (error) {
      console.error('[SuperAdminController] Error verificando API Key:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al verificar API Key'
      });
    }
  }
}
