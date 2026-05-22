const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function createSuperAdmin() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa\n');

    console.log('🔍 Verificando tablas...');

    // Crear tabla tenants si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        bd_name VARCHAR(100) UNIQUE NOT NULL,
        api_key_encrypted TEXT,
        api_status VARCHAR(20) DEFAULT 'pendiente',
        tenant_status VARCHAR(20) DEFAULT 'activo',
        role VARCHAR(20) DEFAULT 'tenant_admin',
        must_change_password BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla tenants verificada/creada');

    // Crear tabla audit_logs si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        user_email VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla audit_logs verificada/creada\n');

    // Verificar si ya existe superadmin
    const existing = await pool.query(
      "SELECT id, email FROM tenants WHERE email = $1",
      [process.env.SUPERADMIN_EMAIL || 'admin@liinkmobile.com']
    );

    if (existing.rows.length > 0) {
      console.log('⚠️  El SuperAdmin ya existe:');
      console.log(`   Email: ${existing.rows[0].email}`);
      console.log(`   ID: ${existing.rows[0].id}`);
      console.log('\nSi quieres cambiar la contraseña, elimínalo primero:\n');
      console.log(`   DELETE FROM tenants WHERE email = '${existing.rows[0].email}';\n`);
      return;
    }

    // Crear hash de contraseña
    const password = process.env.SUPERADMIN_PASSWORD || 'LiinkMobile2026!';
    console.log('🔐 Creando hash de contraseña...');
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('✅ Hash creado\n');

    // Insertar SuperAdmin
    console.log('💾 Insertando SuperAdmin...');
    const result = await pool.query(
      `INSERT INTO tenants (nombre, email, password_hash, bd_name, role, must_change_password, tenant_status, api_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, role, tenant_status, created_at`,
      [
        'SuperAdmin',
        process.env.SUPERADMIN_EMAIL || 'admin@liinkmobile.com',
        passwordHash,
        'bd_superadmin',
        'superadmin',
        false,
        'activo',
        null
      ]
    );

    const admin = result.rows[0];

    console.log('\n=================================');
    console.log('✅ SUPERADMIN CREADO EXITOSAMENTE');
    console.log('=================================\n');
    console.log(`📧 Email:    ${admin.email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Rol:      ${admin.role}`);
    console.log(`🆔 ID:       ${admin.id}`);
    console.log(`📅 Creado:   ${admin.created_at.toISOString()}`);
    console.log('\n🌐 Login en: https://liinkmobile.com/login.html');
    console.log('=================================\n');

  } catch (error) {
    console.error('\n❌ Error durante la creación:');
    console.error(error.message);
    console.error('\nDetalles del error:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('📝 Conexión cerrada\n');
  }
}

createSuperAdmin();
