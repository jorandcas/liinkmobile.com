const { Pool } = require('pg');

console.log('Probando diferentes hosts...\n');

const hosts = [
  '10.0.1.1',
  '10.0.1.15',
  'postgresql-database-w44gso8so0ko0skg00swscso',
  'postgres',
  'db'
];

async function testHost(host) {
  const pool = new Pool({
    host: host,
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'bd_superadmin',
    connectionTimeoutMillis: 3000
  });

  try {
    await pool.query('SELECT NOW()');
    console.log(`✅ ${host} - CONECTADO`);
    await pool.end();
    return host;
  } catch (err) {
    console.log(`❌ ${host} - ${err.code}`);
    await pool.end();
    return null;
  }
}

async function testAll() {
  for (const host of hosts) {
    const working = await testHost(host);
    if (working) {
      console.log(`\n🎯 Host que funciona: ${working}`);
      process.exit(0);
    }
  }
  console.log('\n❌ Ningún host funcionó');
  process.exit(1);
}

testAll();
