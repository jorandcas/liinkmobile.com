/**
 * Corregir must_change_password a false para Govi
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yodoit2026',
  database: 'bd_superadmin',
});

async function fixStatus() {
  try {
    console.log('\n⚠️  Corrigiendo must_change_password para Govi...');

    await pool.query(
      `UPDATE tenants
       SET must_change_password = false,
           updated_at = NOW()
       WHERE nombre = 'Govi'`
    );

    console.log('✅ Govi ahora debe cambiar contraseña: false');
    console.log('✅ Ya puedes ingresar al dashboard normalmente\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixStatus();
