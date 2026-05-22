const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Conectar a postgres por defecto para crear bd_superadmin
const pool = new Pool({
  connectionString: 'postgres://postgres:61f6QKfYWBs4p82B48MvJzIhVmDwd3VzlyzAF5jAzmLuSsyxhe5jw8QGXXpgR6sD@w44gso8so0ko0skg00swscso:5432/postgres'
});

async function setup() {
  try {
    console.log('🔍 Paso 1: Conectando a postgres...');
    const client = await pool.connect();
    console.log('✅ Conectado\n');

    // Crear base de datos bd_superadmin
    console.log('📋 Paso 2: Creando base de datos bd_superadmin...');
    try {
      await client.query('CREATE DATABASE bd_superadmin');
      console.log('✅ Base de datos creada\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⚠️  La base de datos ya existe\n');
      } else {
        throw err;
      }
    }

    client.release();

    // Conectar a bd_superadmin
    console.log('🔍 Paso 3: Conectando a bd_superadmin...');
    const poolAdmin = new Pool({
      connectionString: 'postgres://postgres:61f6QKfYWBs4p82B48MvJzIhVmDwd3VzlyzAF5jAzmLuSsyxhe5jw8QGXXpgR6sD@w44gso8so0ko0skg00swscso:5432/bd_superadmin'
    });
    const adminClient = await poolAdmin.connect();
    console.log('✅ Conectado a bd_superadmin\n');

    // Crear tabla tenants
    console.log('📋 Paso 4: Creando tabla tenants...');
    await adminClient.query(`CREATE TABLE IF NOT EXISTS tenants (
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
    )`);
    console.log('✅ Tabla tenants creada\n');

    // Crear tabla audit_logs
    console.log('📋 Paso 5: Creando tabla audit_logs...');
    await adminClient.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      user_email VARCHAR(255) NOT NULL,
      action VARCHAR(100) NOT NULL,
      details JSONB,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    console.log('✅ Tabla audit_logs creada\n');

    // Verificar si existe superadmin
    console.log('🔍 Paso 6: Verificando SuperAdmin...');
    const existing = await adminClient.query(
      "SELECT id FROM tenants WHERE email = 'admin@liinkmobile.com'"
    );

    if (existing.rows.length > 0) {
      console.log('⚠️  El SuperAdmin ya existe\n');
      adminClient.release();
      await poolAdmin.end();
      await pool.end();
      return;
    }

    // Crear SuperAdmin
    console.log('🔐 Paso 7: Creando SuperAdmin...');
    const password = 'LiinkMobile2026!';
    const hash = await bcrypt.hash(password, 10);

    const result = await adminClient.query(
      `INSERT INTO tenants (nombre, email, password_hash, bd_name, role, must_change_password, tenant_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role`,
      ['SuperAdmin', 'admin@liinkmobile.com', hash, 'bd_superadmin', 'superadmin', false, 'activo']
    );

    console.log('\n=================================');
    console.log('✅ SUPERADMIN CREADO EXITOSAMENTE');
    console.log('=================================\n');
    console.log(`📧 Email:    admin@liinkmobile.com`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Rol:      superadmin`);
    console.log(`🆔 ID:       ${result.rows[0].id}`);
    console.log('\n🌐 Login en: https://liinkmobile.com/login.html');
    console.log('=================================\n');

    adminClient.release();
    await poolAdmin.end();
    await pool.end();

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.stack) console.error(err.stack);
    await pool.end();
  }
}

setup();
