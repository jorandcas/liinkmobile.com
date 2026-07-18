#!/usr/bin/env ts-node
/**
 * ============================================
 * MIGRACIÓN DE CAMPAÑAS (JSON → POSTGRESQL)
 * ============================================
 *
 * Este script migra las campañas del archivo data/campanas.json
 * a las bases de datos independientes de cada tenant.
 *
 * Uso:
 *   npm run migrate:campanas
 *   o
 *   ts-node db/migrate-campanas-to-db.ts
 *
 * IMPORTANT: Ejecutar DESPUÉS de crear las BDs de tenants
 * y haber ejecutado init-tenant-db.sql en cada una.
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import path from 'path';

// ============================================
// INTERFACES
// ============================================

interface CampanaJSON {
  id: string;
  nombre: string;
  fecha: Date;
  ultima_actualizacion: Date;
  tipo: 'individual' | 'multiple';
  entorno: 'QA' | 'PROD' | 'AMBOS';
  estadisticas: {
    total_telefonos: number;
    validados: number;
    vinculados: number;
    no_vinculados: number;
    errores: number;
    porcentaje_vinculacion: number;
  };
  resultados: Array<{
    telefono: string;
    estado: 'vinculado' | 'no_vinculado' | 'error';
    mensaje?: string;
    validado_at?: Date;
  }>;
  creadoPor: string;
  estado?: string;
  finalizacion_at?: Date;
  archivo_original?: string;
}

interface Tenant {
  id: number;
  nombre: string;
  email: string;
  bd_name: string;
}

// ============================================
// CONFIGURACIÓN
// ============================================

const SUPERADMIN_DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bd_superadmin'
};

const CAMPAÑAS_FILE = path.join(__dirname, '..', 'data', 'campanas.json');

// ============================================
// FUNCIONES
// ============================================

/**
 * Conectarse a la base de datos de superadmin
 */
async function connectToSuperAdmin(): Promise<Pool> {
  console.log('🔌 Conectando a bd_superadmin...');
  const pool = new Pool(SUPERADMIN_DB);
  await pool.connect();
  console.log('✅ Conectado a bd_superadmin');
  return pool;
}

/**
 * Conectarse a una base de datos de tenant
 */
async function connectToTenantDB(bdName: string): Promise<Pool> {
  console.log(`🔌 Conectando a ${bdName}...`);
  const config = {
    ...SUPERADMIN_DB,
    database: bdName
  };
  const pool = new Pool(config);
  await pool.connect();
  console.log(`✅ Conectado a ${bdName}`);
  return pool;
}

/**
 * Obtener todos los tenants
 */
async function getAllTenants(superAdminPool: Pool): Promise<Tenant[]> {
  const result = await superAdminPool.query(
    'SELECT id, nombre, email, bd_name FROM tenants WHERE role = $1',
    ['tenant_admin']
  );
  return result.rows;
}

/**
 * Encontrar tenant por email
 */
function findTenantByEmail(email: string, tenants: Tenant[]): Tenant | null {
  // Normalizar email para comparación
  const normalizedEmail = email.toLowerCase().trim();

  // Buscar match exacto primero
  let tenant = tenants.find(t => t.email.toLowerCase() === normalizedEmail);
  if (tenant) return tenant;

  // Si no hay match, devolver null
  console.warn(`⚠️  No se encontró tenant para email: ${email}`);
  return null;
}

/**
 * Leer campañas del archivo JSON
 */
function readCampanasJSON(): CampanaJSON[] {
  console.log('📖 Leyendo archivo campanas.json...');

  if (!fs.existsSync(CAMPAÑAS_FILE)) {
    console.warn('⚠️  No existe el archivo campanas.json');
    return [];
  }

  const content = fs.readFileSync(CAMPAÑAS_FILE, 'utf-8');
  const campanas = JSON.parse(content) as CampanaJSON[];

  console.log(`✅ Leídas ${campanas.length} campañas`);
  return campanas;
}

/**
 * Migrar una campaña a la BD del tenant
 */
async function migrateCampana(
  campana: CampanaJSON,
  tenant: Tenant,
  tenantPool: Pool
): Promise<void> {
  try {
    await tenantPool.query('BEGIN');

    // Insertar campaña
    const insertCampana = `
      INSERT INTO campanas (
        codigo, nombre, fecha, ultima_actualizacion,
        tipo, entorno, creado_por,
        total_telefonos, validados, vinculados, no_vinculados, errores, porcentaje_vinculacion,
        estado, archivo_original, finalizacion_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING id
    `;

    const values = [
      campana.id,  // Usar el ID existente como código
      campana.nombre,
      campana.fecha,
      campana.ultima_actualizacion,
      campana.tipo,
      campana.entorno,
      campana.creadoPor,
      campana.estadisticas.total_telefonos,
      campana.estadisticas.validados,
      campana.estadisticas.vinculados,
      campana.estadisticas.no_vinculados,
      campana.estadisticas.errores,
      campana.estadisticas.porcentaje_vinculacion,
      campana.estado || 'completada',
      campana.archivo_original || null,
      campana.finalizacion_at || null
    ];

    const result = await tenantPool.query(insertCampana, values);
    const campanaId = result.rows[0].id;

    console.log(`  ✅ Campaña "${campana.nombre}" insertada con ID ${campanaId}`);

    // Insertar resultados
    if (campana.resultados && campana.resultados.length > 0) {
      for (const resultado of campana.resultados) {
        await tenantPool.query(
          `INSERT INTO resultados_campana (campana_id, telefono, estado, mensaje, validado_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            campanaId,
            resultado.telefono,
            resultado.estado,
            resultado.mensaje || null,
            resultado.validado_at || new Date()
          ]
        );
      }
      console.log(`  ✅ Insertados ${campana.resultados.length} resultados`);
    }

    await tenantPool.query('COMMIT');
  } catch (error) {
    await tenantPool.query('ROLLBACK');
    throw error;
  }
}

/**
 * Verificar que la BD del tenant tiene la tabla campanas
 */
async function verifyTenantDB(tenantPool: Pool, bdName: string): Promise<boolean> {
  try {
    await tenantPool.query('SELECT 1 FROM campanas LIMIT 1');
    console.log(`✅ La BD ${bdName} tiene la tabla campanas`);
    return true;
  } catch (error) {
    console.error(`❌ La BD ${bdName} NO tiene la tabla campanas. Ejecuta init-tenant-db.sql primero.`);
    return false;
  }
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

async function main(): Promise<void> {
  console.log('🚀 Iniciando migración de campañas...');
  console.log('=======================================\n');

  try {
    // 1. Conectar a superadmin
    const superAdminPool = await connectToSuperAdmin();

    // 2. Obtener todos los tenants
    console.log('\n📋 Obteniendo tenants...');
    const tenants = await getAllTenants(superAdminPool);
    console.log(`✅ Encontrados ${tenants.length} tenants`);

    // 3. Leer campañas del JSON
    const campanas = readCampanasJSON();

    if (campanas.length === 0) {
      console.log('\n⚠️  No hay campañas para migrar. Finalizando.');
      await superAdminPool.end();
      return;
    }

    // 4. Procesar cada campaña
    console.log('\n📦 Migrando campañas...\n');

    let migradas = 0;
    let errores = 0;
    const tenantsMigrados = new Set<number>();

    for (const campana of campanas) {
      try {
        // Buscar tenant por email
        const tenant = findTenantByEmail(campana.creadoPor, tenants);

        if (!tenant) {
          console.warn(`⚠️  Saltando campaña "${campana.nombre}" - no se encontró tenant para email ${campana.creadoPor}`);
          errores++;
          continue;
        }

        // Conectar a BD del tenant (si no está conectado)
        let tenantPool: Pool;

        if (tenantsMigrados.has(tenant.id)) {
          // Ya tenemos conexión, reutilizamos
          tenantPool = await connectToTenantDB(tenant.bd_name);
        } else {
          // Nueva conexión
          tenantPool = await connectToTenantDB(tenant.bd_name);

          // Verificar que tiene la tabla
          const hasTable = await verifyTenantDB(tenantPool, tenant.bd_name);
          if (!hasTable) {
            await tenantPool.end();
            errores++;
            continue;
          }

          tenantsMigrados.add(tenant.id);
        }

        // Migrar campaña
        await migrateCampana(campana, tenant, tenantPool);
        migradas++;

        // Cerrar conexión al tenant
        await tenantPool.end();

      } catch (error) {
        console.error(`❌ Error migrando campaña "${campana.nombre}":`, error);
        errores++;
      }
    }

    // 5. Cerrar conexión a superadmin
    await superAdminPool.end();

    // 6. Resumen
    console.log('\n=======================================');
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('=======================================');
    console.log(`✅ Campañas migradas: ${migradas}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📁 Tenants afectados: ${tenantsMigrados.size}`);
    console.log('\n🎉 Migración completada.');

    // 7. Backup del archivo JSON
    if (migradas > 0) {
      const backupFile = CAMPAÑAS_FILE + '.backup';
      fs.copyFileSync(CAMPAÑAS_FILE, backupFile);
      console.log(`\n💾 Backup guardado en: ${backupFile}`);
    }

  } catch (error) {
    console.error('\n❌ Error fatal en migración:', error);
    process.exit(1);
  }
}

// ============================================
// EJECUTAR
// ============================================

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { main as migrateCampanas };
