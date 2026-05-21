/**
 * Script para verificar si el tenant "Govi" se creó correctamente
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yodoit2026',
  database: 'bd_superadmin',
});

async function checkTenant() {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, api_status, tenant_status, bd_name, created_at
       FROM tenants
       WHERE role = 'tenant_admin'
       ORDER BY created_at DESC`
    );

    console.log('\n=== TENANTS CREADOS ===\n');
    console.log(`Total: ${result.rows.length}`);

    if (result.rows.length === 0) {
      console.log('⚠️  No hay tenants creados');
    } else {
      result.rows.forEach((tenant, index) => {
        console.log(`\n${index + 1}. ${tenant.nombre}`);
        console.log(`   ID: ${tenant.id}`);
        console.log(`   Email: ${tenant.email}`);
        console.log(`   API Status: ${tenant.api_status}`);
        console.log(`   Tenant Status: ${tenant.tenant_status}`);
        console.log(`   BD Name: ${tenant.bd_name}`);
        console.log(`   Creado: ${tenant.created_at}`);
      });
    }

    console.log('\n======================\n');

    // Verificar bases de datos
    const dbResult = await pool.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' ORDER BY datname`
    );

    console.log('\n=== BASES DE DATOS DE TENANTS ===\n');
    console.log(`Total: ${dbResult.rows.length}`);
    dbResult.rows.forEach((db, index) => {
      console.log(`${index + 1}. ${db.datname}`);
    });
    console.log('\n=================================\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTenant();
