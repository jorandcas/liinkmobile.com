import { EndpointConfig } from '../types/distribuidor.types';

/**
 * Configuración de endpoints desde la colección de Postman
 */
export const ENDPOINTS: EndpointConfig[] = [
  {
    name: 'Validacion QA',
    url: 'http://94.74.74.161:8002/api/v1/distribuidores/enrolamiento',
    environment: 'QA',
    apiKey: process.env.API_KEY_QA || process.env.API_KEY || ''
  },
  {
    name: 'Validacion PROD',
    url: 'http://94.74.77.50:8010/api/v1/distribuidores/enrolamiento',
    environment: 'PROD',
    apiKey: process.env.API_KEY_PROD || process.env.API_KEY || ''
  }
];

/**
 * Configuración de la API
 */
export const API_CONFIG = {
  // Headers por defecto
  defaultHeaders: {
    'ConsumerName': 'Movistar',
    'Content-Type': 'application/json'
  },

  // Configuración de timeouts
  timeouts: {
    connection: 10000, // 10 segundos
    response: 30000    // 30 segundos
  },

  // Configuración de reintentos
  retries: {
    maxAttempts: 3,
    retryDelay: 1000, // 1 segundo
    backoffMultiplier: 2
  },

  // Configuración de peticiones (SECUENCIALES - una a la vez)
  // Movistar solo permite una validación a la vez
  concurrency: {
    maxConcurrent: 1, // Solo 1 petición a la vez (secuencial)
    batchSize: 1,     // Procesar uno por uno
    delayBetweenRequests: 3000 // 3 segundos entre requests
  }
} as const;

/**
 * Obtener endpoint por ambiente
 */
export function getEndpointByEnvironment(environment: 'QA' | 'PROD'): EndpointConfig {
  const endpoint = ENDPOINTS.find(ep => ep.environment === environment);
  if (!endpoint) {
    throw new Error(`No se encontró endpoint para el ambiente: ${environment}`);
  }
  return endpoint;
}

/**
 * Obtener API key por ambiente
 */
export function getApiKey(environment: 'QA' | 'PROD'): string {
  // Leer directamente de process.env para obtener los valores actualizados
  const envKey = environment === 'QA' ? 'API_KEY_QA' : 'API_KEY_PROD';
  const apiKey = process.env[envKey] || process.env.API_KEY || '';

  if (!apiKey) {
    throw new Error(`API Key no configurada para el ambiente: ${environment}. ` +
      `Setea la variable de entorno ${envKey}`);
  }

  return apiKey;
}

/**
 * Obtener todos los endpoints
 */
export function getAllEndpoints(): EndpointConfig[] {
  return [...ENDPOINTS];
}
