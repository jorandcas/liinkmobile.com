/**
 * Eliminar el tenant Govi (para poder recrearlo)
 */

const { Pool } = require('pg');

async function deleteGovi() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'yodoit2026',
    database: 'bd_superadmin',
  });

  try {
    console.log('\n⚠️  Eliminando tenant Govi...\n');

    await pool.query("DELETE FROM tenants WHERE nombre = 'Govi'");

    console.log('✅ Tenant Govi eliminado. Ahora puedes crearlo nuevamente.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

deleteGovi();
