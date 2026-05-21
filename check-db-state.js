/**
 * Script para verificar el estado de la base de datos y conexiones
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'yodoit2026',
  database: 'bd_superadmin',
});

async function checkState() {
  const client = await pool.connect();

  try {
    console.log('\n=== VERIFICANDO ESTADO DE BASE DE DATOS ===\n');

    // Verificar tabla tenants
    console.log('1. Consultando todos los registros en tenants:');
    const result = await client.query('SELECT * FROM tenants');
    console.log(`   Total de filas: ${result.rows.length}`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ID: ${row.id}, Nombre: ${row.nombre}, Email: ${row.email}`);
    });

    // Verificar si existe "Govi" específicamente
    console.log('\n2. Buscando "Govi" específicamente:');
    const goviResult = await client.query(
      "SELECT * FROM tenants WHERE LOWER(nombre) = LOWER($1)",
      ['Govi']
    );
    console.log(`   Filas encontradas: ${goviResult.rows.length}`);
    if (goviResult.rows.length > 0) {
      console.log('   REGISTRO ENCONTRADO:', goviResult.rows[0]);
    }

    // Verificar si existe el email
    console.log('\n3. Buscando email "govi@gmail.com":');
    const emailResult = await client.query(
      "SELECT * FROM tenants WHERE LOWER(email) = LOWER($1)",
      ['govi@gmail.com']
    );
    console.log(`   Filas encontradas: ${emailResult.rows.length}`);
    if (emailResult.rows.length > 0) {
      console.log('   REGISTRO ENCONTRADO:', emailResult.rows[0]);
    }

    // Verificar locks
    console.log('\n4. Verificando locks en la base de datos:');
    const lockResult = await client.query(`
      SELECT rel::regclass as table_name, mode, pid
      FROM pg_locks l
      JOIN pg_class c ON l.relation = c.oid
      WHERE rel::regclass::text LIKE '%tenant%'
    `);
    console.log(`   Locks encontrados: ${lockResult.rows.length}`);
    lockResult.rows.forEach(lock => {
      console.log(`   - Tabla: ${lock.table_name}, Mode: ${lock.mode}, PID: ${lock.pid}`);
    });

    console.log('\n=========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkState();
