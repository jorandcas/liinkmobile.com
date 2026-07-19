import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

interface Tenant { email: string; bd_name: string; role: string; }
interface LegacyResult {
  telefono: string;
  estado?: 'vinculado' | 'no_vinculado' | 'error';
  exito?: boolean;
  vinculado?: boolean;
  mensaje?: string;
  validado_at?: string;
  ultima_consulta?: string;
}
interface LegacyCampaign {
  id: string;
  nombre: string;
  fecha?: string;
  ultima_actualizacion?: string;
  tipo?: 'individual' | 'multiple';
  entorno?: 'QA' | 'PROD' | 'AMBOS';
  creadoPor: string;
  estado?: 'pendiente' | 'en_proceso' | 'completada' | 'fallida';
  resultados?: LegacyResult[];
  estadisticas?: {
    totalProcesados?: number; total_telefonos?: number; validados?: number;
    vinculados?: number; no_vinculados?: number; errores?: number;
    porcentaje_vinculacion?: number;
  };
}

const connectionBase = () => ({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

function resultStatus(result: LegacyResult): 'vinculado' | 'no_vinculado' | 'error' {
  if (result.estado) return result.estado;
  if (result.vinculado) return 'vinculado';
  return result.exito === false && !result.mensaje ? 'error' : 'no_vinculado';
}

async function migrateLegacyCampaigns(tenants: Tenant[]): Promise<number> {
  const legacyPath = path.join(process.cwd(), 'data', 'campanas.json');
  if (!fs.existsSync(legacyPath)) return 0;
  const campaigns = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as LegacyCampaign[];
  const pools = new Map<string, Pool>();
  let migrated = 0;

  try {
    for (const campaign of campaigns) {
      const creator = campaign.creadoPor.toLowerCase().trim();
      const tenant = tenants.find((item) => item.email.toLowerCase() === creator)
        || (creator === 'admin@movistar.com'
          ? tenants.find((item) => item.role === 'superadmin')
          : undefined);
      if (!tenant) {
        console.warn(`[Database] Campaña histórica omitida; no existe tenant para ${campaign.creadoPor}`);
        continue;
      }

      let pool = pools.get(tenant.bd_name);
      if (!pool) {
        pool = new Pool({ ...connectionBase(), database: tenant.bd_name });
        pools.set(tenant.bd_name, pool);
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const results = campaign.resultados || [];
        const statuses = results.map(resultStatus);
        const total = campaign.estadisticas?.total_telefonos
          ?? campaign.estadisticas?.totalProcesados ?? results.length;
        const linked = campaign.estadisticas?.vinculados
          ?? statuses.filter((status) => status === 'vinculado').length;
        const errors = campaign.estadisticas?.errores
          ?? statuses.filter((status) => status === 'error').length;
        const notLinked = campaign.estadisticas?.no_vinculados
          ?? Math.max(0, total - linked - errors);
        const validated = campaign.estadisticas?.validados ?? total;
        const percentage = campaign.estadisticas?.porcentaje_vinculacion
          ?? (total ? linked * 100 / total : 0);
        const inserted = await client.query(
          `INSERT INTO campanas (
            codigo, nombre, fecha, ultima_actualizacion, tipo, entorno, creado_por,
            total_telefonos, validados, vinculados, no_vinculados, errores,
            porcentaje_vinculacion, estado
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (codigo) DO NOTHING RETURNING id`,
          [campaign.id, campaign.nombre, campaign.fecha || new Date(),
            campaign.ultima_actualizacion || campaign.fecha || new Date(),
            campaign.tipo || (results.length > 1 ? 'multiple' : 'individual'),
            campaign.entorno || 'PROD', tenant.email, total, validated, linked,
            notLinked, errors, percentage, campaign.estado || 'completada']
        );
        if (inserted.rowCount === 1) {
          const campaignId = inserted.rows[0].id as number;
          for (let index = 0; index < results.length; index += 1) {
            const result = results[index];
            await client.query(
              `INSERT INTO resultados_campana
                (campana_id, telefono, estado, mensaje, validado_at)
               VALUES ($1,$2,$3,$4,$5)`,
              [campaignId, result.telefono, statuses[index], result.mensaje || null,
                result.validado_at || result.ultima_consulta || campaign.fecha || new Date()]
            );
          }
          migrated += 1;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await Promise.all([...pools.values()].map((pool) => pool.end()));
  }
  return migrated;
}

export async function bootstrapDatabases(): Promise<void> {
  const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'init-tenant-db.sql'), 'utf8');
  const admin = new Pool({ ...connectionBase(), database: process.env.DB_NAME || 'bd_superadmin' });
  try {
    const tenants = (await admin.query(
      'SELECT email, bd_name, role FROM tenants WHERE bd_name IS NOT NULL ORDER BY id'
    )).rows as Tenant[];
    for (const tenant of tenants) {
      const pool = new Pool({ ...connectionBase(), database: tenant.bd_name });
      try { await pool.query(schema); } finally { await pool.end(); }
    }
    const migrated = await migrateLegacyCampaigns(tenants);
    console.log(`[Database] Esquema verificado en ${tenants.length} bases; campañas históricas migradas: ${migrated}`);
  } finally {
    await admin.end();
  }
}
