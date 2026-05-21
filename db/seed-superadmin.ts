import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para crear el SuperAdmin inicial del sistema
 * Ejecutar: npm run seed:superadmin
 * Después de ejecutar, eliminar SUPERADMIN_PASSWORD del .env
 */
async function seedSuperAdmin() {
  console.log('🌱 Iniciando seed de SuperAdmin...\n');

  // Validar variables de entorno
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD son requeridos en .env');
    console.error('   Agrega estas variables en tu archivo .env:\n');
    console.error('   SUPERADMIN_EMAIL=admin@tudominio.com');
    console.error('   SUPERADMIN_PASSWORD=SuperPassword123!\n');
    process.exit(1);
  }

  // Configurar conexión a la base de datos
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bd_superadmin',
  });

  try {
    console.log('📊 Conectando a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa\n');

    // Verificar si ya existe el superadmin
    console.log('🔍 Verificando si el SuperAdmin ya existe...');
    const existingAdmin = await pool.query(
      'SELECT id, email FROM tenants WHERE email = $1',
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('⚠️  El SuperAdmin ya existe:');
      console.log(`   Email: ${existingAdmin.rows[0].email}`);
      console.log('   Si quieres recrearlo, elimínalo manualmente de la base de datos.\n');
      process.exit(0);
    }

    // Hash de la contraseña
    console.log('🔐 Hasheando contraseña...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('✅ Contraseña hasheada\n');

    // Insertar superadmin
    console.log('💾 Insertando SuperAdmin en la base de datos...');
    const result = await pool.query(
      `INSERT INTO tenants
        (nombre, email, password_hash, bd_name, role, must_change_password, tenant_status, api_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, email, role, created_at`,
      [
        'SuperAdmin',
        email,
        passwordHash,
        'bd_superadmin',
        'superadmin',
        false, // SuperAdmin no necesita cambiar contraseña
        'activo',
        null   // SuperAdmin no tiene API Key
      ]
    );

    const admin = result.rows[0];

    console.log('\n=================================');
    console.log('✅ SUPERADMIN CREADO EXITOSAMENTE');
    console.log('=================================\n');
    console.log(`📧 Email:          ${admin.email}`);
    console.log(`👤 Nombre:         ${admin.nombre}`);
    console.log(`🔑 Rol:            ${admin.role}`);
    console.log(`📅 Creado:         ${admin.created_at.toISOString()}\n`);

    console.log('⚠️  IMPORTANTE - Pasos siguientes:\n');
    console.log('   1. Elimina SUPERADMIN_PASSWORD del archivo .env');
    console.log('   2. Guarda estas credenciales en un lugar seguro');
    console.log('   3. Inicia el servidor: npm run dev');
    console.log('   4. Accede a http://localhost:3000/login\n');

    console.log('🔒 La contraseña está hasheada con bcrypt (salt rounds: 10)');
    console.log('=================================\n');

  } catch (error) {
    console.error('\n❌ Error durante el seed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('📝 Conexión a BD cerrada\n');
  }
}

// Ejecutar seed
seedSuperAdmin().catch((error) => {
  console.error('Error no manejado:', error);
  process.exit(1);
});
