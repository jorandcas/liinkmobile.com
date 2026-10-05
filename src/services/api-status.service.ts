import axios from 'axios';
import { Pool } from 'pg';
import { getEndpointByEnvironment } from '../config/endpoints.config';
import { decryptApiKey } from '../utils/encryption.util';
import { TenantApiStatus } from '../types/distribuidor.types';

let apiStatusIntervalMs = 60 * 60 * 1000;
let nextApiStatusCheckAt: number | null = null;
let apiStatusCheckRunning = false;

export function getApiStatusSchedule(): {
  nextCheckAt: string | null;
  checking: boolean;
  intervalMs: number;
  serverNow: string;
} {
  return {
    nextCheckAt: nextApiStatusCheckAt ? new Date(nextApiStatusCheckAt).toISOString() : null,
    checking: apiStatusCheckRunning,
    intervalMs: apiStatusIntervalMs,
    serverNow: new Date().toISOString()
  };
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bd_superadmin',
});

export interface ApiStatusCheckResult {
  tenantId: number;
  nombre?: string;
  api_status: TenantApiStatus;
  api_status_checked_at: string;
  api_status_error: string | null;
}

function classifyApiError(error: unknown): { status: TenantApiStatus; message: string } {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    if (statusCode === 401 || statusCode === 403) {
      return { status: 'invalida', message: `Movistar rechazó la API key (HTTP ${statusCode}).` };
    }
    if (statusCode) {
      return { status: 'no_disponible', message: `La API de Movistar respondió con HTTP ${statusCode}.` };
    }
    const code = error.code || 'ERROR_RED';
    return { status: 'no_disponible', message: `No se pudo conectar con la API de Movistar (${code}).` };
  }
  return {
    status: 'no_disponible',
    message: error instanceof Error ? error.message : 'Error inesperado al revisar la API.'
  };
}

export async function checkTenantApiStatus(tenantId: number): Promise<ApiStatusCheckResult> {
  const tenantResult = await pool.query(
    `SELECT id, nombre, api_key_encrypted
     FROM tenants
     WHERE id = $1 AND role = 'tenant_admin'`,
    [tenantId]
  );

  if (!tenantResult.rowCount) throw new Error('No se encontró el cliente solicitado.');

  const tenant = tenantResult.rows[0];
  let status: TenantApiStatus;
  let message: string | null = null;

  if (!tenant.api_key_encrypted) {
    status = 'invalida';
    message = 'Este cliente no tiene una API key configurada.';
  } else {
    try {
      const apiKey = decryptApiKey(tenant.api_key_encrypted);
      const endpoint = getEndpointByEnvironment('PROD');
      const testPhone = process.env.VALIDATION_TEST_PHONE || '7773354612';
      const response = await axios.get(`${endpoint.url}/${testPhone}`, {
        headers: {
          'x-api-key': apiKey,
          ConsumerName: 'Movistar',
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        proxy: false
      });

      if (response.data?.success === true && response.data?.data?.dn) {
        status = 'valida';
      } else {
        status = 'no_disponible';
        message = 'Movistar respondió, pero el formato de respuesta no fue el esperado.';
      }
    } catch (error) {
      const classified = classifyApiError(error);
      status = classified.status;
      message = classified.message;
    }
  }

  const checkedAt = new Date();
  await pool.query(
    `UPDATE tenants
     SET api_status = $2, api_status_checked_at = $3, api_status_error = $4
     WHERE id = $1`,
    [tenantId, status, checkedAt, message]
  );

  return {
    tenantId: tenant.id,
    nombre: tenant.nombre,
    api_status: status,
    api_status_checked_at: checkedAt.toISOString(),
    api_status_error: message
  };
}

export async function checkAllTenantApiStatuses(): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM tenants
     WHERE role = 'tenant_admin' AND tenant_status = 'activo'
     ORDER BY id`
  );

  for (let index = 0; index < result.rows.length; index += 1) {
    const tenantId = Number(result.rows[index].id);
    try {
      const status = await checkTenantApiStatus(tenantId);
      console.log(`[ApiStatus] Tenant ${tenantId}: ${status.api_status}${status.api_status_error ? ` - ${status.api_status_error}` : ''}`);
    } catch (error) {
      console.error(`[ApiStatus] No se pudo revisar tenant ${tenantId}:`, error instanceof Error ? error.message : error);
    }
    if (index < result.rows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

export function startApiStatusMonitor(): void {
  const configuredInterval = Number(process.env.API_STATUS_CHECK_INTERVAL_MS);
  const interval = Number.isFinite(configuredInterval) && configuredInterval >= 60000
    ? configuredInterval
    : 60 * 60 * 1000;
  apiStatusIntervalMs = interval;

  const run = async () => {
    if (apiStatusCheckRunning) return;
    apiStatusCheckRunning = true;
    nextApiStatusCheckAt = null;
    try {
      await checkAllTenantApiStatuses();
    } catch (error) {
      console.error('[ApiStatus] Falló el ciclo de revisión:', error);
    } finally {
      apiStatusCheckRunning = false;
      nextApiStatusCheckAt = Date.now() + interval;
      const timer = setTimeout(() => void run(), interval);
      timer.unref();
    }
  };

  void run();
  console.log(`[ApiStatus] Revisión automática cada ${Math.round(interval / 60000)} minutos`);
}
