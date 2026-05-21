/**
 * Verificar estado completo de Govi
 */

const { Pool } = require('pg');

async function checkGovi() {
  // Verificar en bd_superadmin
  const superAdminPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'yodoit2026',
    database: 'bd_superadmin',
  });

  try {
    console.log('\n=== ESTADO COMPLETO DE TENANT GOVI ===\n');

    const result = await superAdminPool.query(
      `SELECT id, nombre, email, bd_name, api_status, tenant_status, role, created_at
       FROM tenants WHERE nombre = 'Govi'`
    );

    if (result.rows.length > 0) {
      const tenant = result.rows[0];
      console.log('✅ Tenant encontrado en bd_superadmin:');
      console.log(`  ID: ${tenant.id}`);
      console.log(`  Nombre: ${tenant.nombre}`);
      console.log(`  Email: ${tenant.email}`);
      console.log(`  BD Name: ${tenant.bd_name}`);
      console.log(`  API Status: ${tenant.api_status}`);
      console.log(`  Tenant Status: ${tenant.tenant_status}`);
      console.log(`  Role: ${tenant.role}`);
      console.log(`  Creado: ${tenant.created_at}`);

      // Verificar si la BD existe
      const dbCheck = await superAdminPool.query(
        `SELECT datname FROM pg_database WHERE datname = $1`,
        [tenant.bd_name]
      );

      console.log(`\n📊 Base de datos ${tenant.bd_name}:`);
      if (dbCheck.rows.length > 0) {
        console.log(`  ✅ Existe`);

        // Contar validaciones
        const tenantPool = new Pool({
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          password: 'yodoit2026',
          database: tenant.bd_name,
        });

        try {
          const countResult = await tenantPool.query('SELECT COUNT(*) as count FROM validaciones');
          console.log(`  📋 Validaciones registradas: ${countResult.rows[0].count}`);
          await tenantPool.end();
        } catch (error) {
          console.log(`  ⚠️  No se pudo consultar validaciones`);
        }
      } else {
        console.log(`  ❌ No existe`);
      }
    } else {
      console.log('⚠️  No se encontró tenant Govi');
    }

    console.log('\n====================================\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await superAdminPool.end();
  }
}

checkGovi();
