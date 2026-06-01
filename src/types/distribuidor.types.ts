/**
 * Respuesta del endpoint de distribuidores (API de Movistar)
 * Formato real: { success: true, data: { dn: "...", enrolado: true|false } }
 */
export interface DistribuidorResponse {
  success: boolean;
  data: {
    dn: string;
    enrolado: boolean;
  };
  metadata?: {
    timestamp: string;
    origen: 'QA' | 'PROD';
  };
}

/**
 * Configuración de endpoints
 */
export interface EndpointConfig {
  name: string;
  url: string;
  environment: 'QA' | 'PROD';
  apiKey?: string;
}

/**
 * Request de validación individual
 */
export interface ValidacionIndividualRequest {
  telefono: string;
  verificarEn?: ('QA' | 'PROD')[];
}

/**
 * Request de validación masiva desde CSV
 */
export interface ValidacionMasivaRequest {
  archivo: Express.Multer.File;
  concurrentRequests?: number;
  verificarEn?: ('QA' | 'PROD')[];
}

/**
 * Resultado de validación individual
 */
export interface ResultadoValidacion {
  telefono: string;
  exitoso: boolean;
  datos?: DistribuidorResponse;
  error?: string;
  origen: 'QA' | 'PROD';
}

/**
 * Resultado de validación masiva
 */
export interface ResultadoValidacionMasiva {
  totalProcesados: number;
  exitosos: number; // Por compatibilidad, = vinculados
  fallidos: number; // Por compatibilidad, = noVinculados + erroresCount
  vinculados?: number; // DN con enrolado: true
  noVinculados?: number; // DN con enrolado: false (API funcionó)
  erroresCount?: number; // DN con error de API
  resultados: ResultadoValidacion[];
  errores: string[];
}

/**
 * Response estándar de la API
 */
export interface ApiResponse<T> {
  exito: boolean;
  datos?: T;
  mensaje?: string;
  errores?: string[];
}

/**
 * Error personalizado
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public mensaje: string,
    public detalles?: string[]
  ) {
    super(mensaje);
    this.name = 'ApiError';
  }
}
