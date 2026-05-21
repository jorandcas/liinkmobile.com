/**
 * Crear la base de datos faltante para Govi
 */

const { Pool } = require('pg');

async function createGoviDB() {
  // Conectar a postgres para crear la BD
  const postgresPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'yodoit2026',
    database: 'postgres',
  });

  const client = await postgresPool.connect();

  try {
    console.log('\n=== CREANDO BASE DE DATOS TENANT_GOVI ===\n');

    // Crear BD
    await client.query('CREATE DATABASE tenant_govi');
    console.log('✅ Base de datos tenant_govi creada');

    // Conectar a la nueva BD y crear tabla
    const tenantPool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'yodoit2026',
      database: 'tenant_govi',
    });

    const tenantClient = await tenantPool.connect();

    try {
      await tenantClient.query('BEGIN');

      // Crear tabla
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS validaciones (
          id SERIAL PRIMARY KEY,
          telefono VARCHAR(20) NOT NULL,
          resultado JSONB NOT NULL,
          origen VARCHAR(10) NOT NULL,
          exitoso BOOLEAN NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabla validaciones creada');

      // Crear índices
      await tenantClient.query('CREATE INDEX IF NOT EXISTS idx_validaciones_telefono ON validaciones(telefono)');
      await tenantClient.query('CREATE INDEX IF NOT EXISTS idx_validaciones_origen ON validaciones(origen)');
      await tenantClient.query('CREATE INDEX IF NOT EXISTS idx_validaciones_created ON validaciones(created_at)');
      console.log('✅ Índices creados');

      await tenantClient.query('COMMIT');

      console.log('\n✅ Tenant Govi completo y funcional\n');
      console.log('📧 Email: jorgeand.jc@gmail.com');
      console.log('🔑 Password: (la que definiste al crearlo)');

    } catch (error) {
      await tenantClient.query('ROLLBACK');
      throw error;
    } finally {
      tenantClient.release();
      await tenantPool.end();
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    client.release();
    await postgresPool.end();
  }
}

createGoviDB();
