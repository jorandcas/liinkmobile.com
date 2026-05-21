/**
 * Tipos para el sistema de campañas
 */

export interface Campana {
  id: string;
  nombre: string;
  fecha: Date;
  tipo: 'individual' | 'multiple';
  entorno: 'QA' | 'PROD' | 'AMBOS';
  estadisticas: {
    totalProcesados: number;
    exitosos: number;
    fallidos: number;
    tiempoTotal: number;
  };
  resultados: ResultadoCampana[];
  creadoPor: string; // email del usuario
}

export interface ResultadoCampana {
  telefono: string;
  entorno: string;
  exito: boolean;
  vinculado: boolean;
  mensaje?: string;
}

export interface CrearCampanaRequest {
  nombre: string;
  resultados: ResultadoCampana[];
  entorno: string;
  estadisticas: {
    totalProcesados: number;
    exitosos: number;
    fallidos: number;
    tiempoTotal: number;
  };
}
