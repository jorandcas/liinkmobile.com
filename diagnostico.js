#!/usr/bin/env node

/**
 * Script de diagnóstico para problemas de conexión con la API
 */

const http = require('http');
const https = require('https');

// Configuración
const API_KEY = 'sk-govi-bc62debea3abf9272efc2c91402f5d2abaffb53df26abd6c';
const TELEFONO_TEST = '9233250673';

const ENDPOINTS = {
  QA: {
    url: 'http://94.74.74.161:8002/api/v1/distribuidores/enrolamiento',
    environment: 'QA'
  },
  PROD: {
    url: 'http://94.74.77.50:8010/api/v1/distribuidores/enrolamiento',
    environment: 'PROD'
  }
};

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const fullUrl = `${endpoint.url}/${TELEFONO_TEST}`;
    const url = new URL(fullUrl);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Probando: ${endpoint.environment}`);
    console.log(`URL: ${fullUrl}`);
    console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
    console.log(`${'='.repeat(60)}`);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        'ConsumerName': 'Movistar',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ Conexión exitosa`);
        console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`Headers:`);
        Object.entries(res.headers).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        console.log(`Response: ${data}`);
        resolve({
          success: true,
          status: res.statusCode,
          endpoint: endpoint.environment,
          response: data
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error de conexión`);
      console.log(`Error: ${error.message}`);
      console.log(`Código: ${error.code}`);

      let causa = 'DESCONOCIDO';
      if (error.code === 'ECONNREFUSED') {
        causa = 'Servidor caído o puerto bloqueado';
      } else if (error.code === 'ETIMEDOUT') {
        causa = 'Timeout - posible firewall';
      } else if (error.code === 'ENOTFOUND') {
        causa = 'DNS no resuelve - dominio incorrecto';
      }

      console.log(`Causa probable: ${causa}`);
      resolve({
        success: false,
        error: error.message,
        code: error.code,
        endpoint: endpoint.environment
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log(`❌ Timeout después de 10 segundos`);
      resolve({
        success: false,
        error: 'Timeout',
        code: 'ETIMEDOUT',
        endpoint: endpoint.environment
      });
    });

    req.end();
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     DIAGNÓSTICO DE CONEXIÓN API DN VERIFICATION       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Obtener IP pública
  console.log('\n📡 Obteniendo IP pública...');
  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    console.log(`🌐 Tu IP pública: ${ipData.ip}`);
  } catch (error) {
    console.log('⚠️  No se pudo obtener la IP pública');
  }

  // Probar cada endpoint
  for (const [name, endpoint] of Object.entries(ENDPOINTS)) {
    await testEndpoint(endpoint);
    // Esperar 2 segundos entre pruebas
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNÓSTICO COMPLETADO');
  console.log('='.repeat(60) + '\n');

  console.log('📋 Resumen para el equipo de soporte:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`API Key: ${API_KEY}`);
  console.log(`Teléfono test: ${TELEFONO_TEST}`);
  console.log('\nEndpoint QA: http://94.74.74.161:8002/api/v1/distribuidores/enrolamiento');
  console.log('Endpoint PROD: http://94.74.77.50:8010/api/v1/distribuidores/enrolamiento');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
