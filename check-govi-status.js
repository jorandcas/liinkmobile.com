/**
 * Verificar estado de must_change_password de Govi
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yodoit2026',
  database: 'bd_superadmin',
});

async function checkStatus() {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, must_change_password, tenant_status FROM tenants WHERE nombre = 'Govi'`
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n=== ESTADO DE GOVI ===');
      console.log(`ID: ${user.id}`);
      console.log(`Nombre: ${user.nombre}`);
      console.log(`Email: ${user.email}`);
      console.log(`must_change_password: ${user.must_change_password}`);
      console.log(`tenant_status: ${user.tenant_status}`);
      console.log('=====================\n');
    } else {
      console.log('No se encontró Govi');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStatus();
