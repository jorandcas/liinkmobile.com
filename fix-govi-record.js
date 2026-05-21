/**
 * Script para corregir el registro de Govi (intercambiar role y tenant_status)
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yodoit2026',
  database: 'bd_superadmin',
});

async function fixGovi() {
  const client = await pool.connect();

  try {
    console.log('\n=== CORRIGIENDO REGISTRO DE GOVI ===\n');

    // Verificar estado actual
    const current = await client.query(
      "SELECT id, nombre, email, role, tenant_status FROM tenants WHERE nombre = 'Govi'"
    );

    if (current.rows.length === 0) {
      console.log('⚠️  No se encontró tenant Govi');
      return;
    }

    console.log('Estado actual:');
    console.log(`  role: ${current.rows[0].role}`);
    console.log(`  tenant_status: ${current.rows[0].tenant_status}`);

    // Corregir
    console.log('\nCorrigiendo...');
    await client.query(
      `UPDATE tenants
       SET role = 'tenant_admin',
           tenant_status = 'activo',
           updated_at = NOW()
       WHERE nombre = 'Govi'`
    );

    // Verificar corrección
    const fixed = await client.query(
      "SELECT id, nombre, email, role, tenant_status FROM tenants WHERE nombre = 'Govi'"
    );

    console.log('\nEstado corregido:');
    console.log(`  role: ${fixed.rows[0].role}`);
    console.log(`  tenant_status: ${fixed.rows[0].tenant_status}`);
    console.log('\n✅ Registro corregido exitosamente\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixGovi();
