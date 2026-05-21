/**
 * Respuesta del endpoint de distribuidores
 */
export interface DistribuidorResponse {
  telefono: string;
  estado: string;
  fechaRegistro?: string;
  distribuidor?: {
    id: string;
    nombre: string;
    codigo: string;
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
  exitosos: number;
  fallidos: number;
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
