/**
 * Script para limpiar la base de datos huérfana tenant_govi
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yodoit2026',
  database: 'postgres', // Conectar a postgres para poder DROP
});

async function cleanup() {
  const client = await pool.connect();

  try {
    console.log('\n⚠️  Eliminando base de datos huérfana: tenant_govi');

    await client.query('DROP DATABASE IF EXISTS tenant_govi');

    console.log('✅ Base de datos eliminada exitosamente\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
