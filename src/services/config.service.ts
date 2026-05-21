/**
 * Servicio de Configuración
 * Maneja la configuración del sistema y extracción de información del distribuidor
 */

export interface ConfigInfo {
  distribuidor: string;
  ambiente: string;
  hasApiKeyQA: boolean;
  hasApiKeyPROD: boolean;
}

/**
 * Extraer el nombre del distribuidor de una API key
 * Formato: sk-{distribuidor}-{codigo}
 */
function extraerDistribuidor(apiKey: string | undefined): string {
  if (!apiKey) {
    return 'No configurado';
  }

  // El formato es: sk-nombredeldistribuidor-codigo
  const partes = apiKey.split('-');

  if (partes.length >= 2 && partes[0] === 'sk') {
    // Retornar el nombre del distribuidor (segunda parte)
    return partes[1];
  }

  return 'Desconocido';
}

/**
 * Obtener la configuración del sistema
 */
export function obtenerConfiguracion(): ConfigInfo {
  const apiKeyQA = process.env.API_KEY_QA;
  const apiKeyPROD = process.env.API_KEY_PROD;

  // Extraer distribuidor de las API keys (prioridad PROD, luego QA)
  let distribuidor = 'No configurado';

  if (apiKeyPROD) {
    distribuidor = extraerDistribuidor(apiKeyPROD);
  } else if (apiKeyQA) {
    distribuidor = extraerDistribuidor(apiKeyQA);
  }

  // Capitalizar primera letra
  const distribuidorFormateado =
    distribuidor.charAt(0).toUpperCase() + distribuidor.slice(1);

  return {
    distribuidor: distribuidorFormateado,
    ambiente: process.env.NODE_ENV || 'development',
    hasApiKeyQA: !!apiKeyQA,
    hasApiKeyPROD: !!apiKeyPROD
  };
}
