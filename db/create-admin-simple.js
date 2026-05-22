const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'bd_superadmin'
});

async function create() {
  try {
    console.log('Conectando...');
    const client = await pool.connect();
    console.log('✅ Conectado\n');

    await client.query(`CREATE TABLE IF NOT EXISTS tenants (
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

    const existing = await client.query("SELECT id FROM tenants WHERE email = 'admin@liinkmobile.com'");
    if (existing.rows.length > 0) {
      console.log('⚠️  El SuperAdmin ya existe');
      client.release();
      return;
    }

    const hash = await bcrypt.hash('LiinkMobile2026!', 10);
    await client.query(
      `INSERT INTO tenants (nombre, email, password_hash, bd_name, role, must_change_password, tenant_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['SuperAdmin', 'admin@liinkmobile.com', hash, 'bd_superadmin', 'superadmin', false, 'activo']
    );

    console.log('✅ SuperAdmin creado');
    console.log('📧 admin@liinkmobile.com');
    console.log('🔑 LiinkMobile2026!');

    client.release();
  } catch (err) {
    console.error('❌ Error completo:', err);
    console.error('Mensaje:', err?.message || 'Sin mensaje');
    console.error('Código:', err?.code);
    if (err?.stack) console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

create();
