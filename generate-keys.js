#!/usr/bin/env node

/**
 * Script para generar claves seguras para producción
 * Uso: node generate-keys.js
 */

const crypto = require('crypto');

console.log('=====================================\n');
console.log('🔑 GENERADOR DE CLAVES PARA PRODUCCIÓN\n');
console.log('=====================================\n');

// Generar ENCRYPTION_KEY (32 bytes = 256 bits)
console.log('📋 ENCRYPTION_KEY (para encriptar API Keys):');
console.log('Generando 32 bytes aleatorios...\n');
const encryptionKey = crypto.randomBytes(32).toString('base64');
console.log('ENCRYPTION_KEY=' + encryptionKey);
console.log('\nCaracterísticas:');
console.log('  - Longitud: 32 bytes (256 bits)');
console.log('  - Codificación: Base64');
console.log('  - Uso: AES-256-GCM para cifrar API Keys de tenants\n');

console.log('=====================================\n');

// Generar JWT_SECRET (64 bytes = 512 bits)
console.log('📋 JWT_SECRET (para firmar tokens JWT):');
console.log('Generando 64 bytes aleatorios...\n');
const jwtSecret = crypto.randomBytes(64).toString('base64');
console.log('JWT_SECRET=' + jwtSecret);
console.log('\nCaracterísticas:');
console.log('  - Longitud: 64 bytes (512 bits)');
console.log('  - Codificación: Base64');
console.log('  - Uso: Firmar tokens JWT de autenticación\n');

console.log('=====================================\n');

// Generar contraseña segura para SuperAdmin (opcional)
console.log('📋 Contraseña sugerida para SuperAdmin (opcional):');
console.log('Generando contraseña segura...\n');
const password = crypto.randomBytes(16).toString('base64').substring(0, 20);
console.log('SUPERADMIN_PASSWORD=' + password);
console.log('\nCaracterísticas:');
console.log('  - Longitud: 20 caracteres');
console.log('  - Incluye: Letras (mayúsculas y minúsculas) y números');
console.log('  - Puedes agregar caracteres especiales manualmente\n');

console.log('=====================================\n');

console.log('✅ ¡LISTO! Copia estas claves a tus variables de entorno en Coolify\n');
console.log('Pasos siguientes:');
console.log('1. Ve a tu aplicación en Coolify');
console.log('2. Settings → Environment Variables');
console.log('3. Agrega las variables generadas arriba');
console.log('4. Guarda y redeploy la aplicación\n');
console.log('=====================================\n');
