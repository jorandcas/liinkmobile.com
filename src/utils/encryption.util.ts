import crypto from 'crypto';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Utilidades para cifrado de API Keys usando AES-256-GCM
 * Formato: iv:authTag:encrypted
 */

// Validar y obtener la clave de cifrado desde la variable de entorno
const getEncryptionKey = (): Buffer => {
  const keyBase64 = process.env.ENCRYPTION_KEY;

  if (!keyBase64) {
    throw new Error('ENCRYPTION_KEY no está configurada en variables de entorno');
  }

  // Decodificar desde base64
  const key = Buffer.from(keyBase64, 'base64');

  // Validar que tenga exactamente 32 bytes (256 bits)
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY debe ser de 32 bytes. ` +
      `Actual: ${key.length} bytes. ` +
      `Genera una con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }

  return key;
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 12; // GCM usa IV de 12 bytes
const ALGORITHM = 'aes-256-gcm';

/**
 * Cifrar una API Key usando AES-256-GCM
 * @param apiKey - La API Key a cifrar
 * @returns String cifrado en formato iv:authTag:encrypted
 */
export const encryptApiKey = (apiKey: string): string => {
  try {
    // Generar IV único para cada cifrado
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    // Cifrar el dato
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Obtener el tag de autenticación
    const authTag = cipher.getAuthTag();

    // Formato: iv:authTag:encrypted (sin salt, no se usa)
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted
    ].join(':');
  } catch (error) {
    throw new Error(`Error cifrando API Key: ${error instanceof Error ? error.message : error}`);
  }
};

/**
 * Descifrar una API Key
 * @param encryptedApiKey - String cifrado en formato iv:authTag:encrypted
 * @returns La API Key descifrada
 */
export const decryptApiKey = (encryptedApiKey: string): string => {
  try {
    const parts = encryptedApiKey.split(':');

    if (parts.length !== 3) {
      throw new Error('Formato de API Key cifrada inválido');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Error descifrando API Key: ${error instanceof Error ? error.message : error}`);
  }
};

/**
 * Ocultar parte de la API Key para mostrar en UI
 * @param apiKey - La API Key completa
 * @returns API Key parcialmente oculta (ej: sk_live_...***abcd)
 */
export const maskApiKey = (apiKey: string): string => {
  if (apiKey.length <= 8) return '***';
  return `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
};

/**
 * Generar una clave de cifrado válida de 32 bytes en base64
 * Útil para generar la ENCRYPTION_KEY del .env
 * @returns Clave en base64 de 44 caracteres
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString('base64');
};
