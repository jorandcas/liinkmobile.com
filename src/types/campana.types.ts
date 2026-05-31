/**
 * Tipos para el sistema de campañas
 */

export interface Campana {
  id: string;
  nombre: string;
  fecha: Date;
  ultima_actualizacion: Date; // Fecha de última actualización (creación o re-consulta)
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
  ultima_consulta?: Date; // Cuándo se consultó este teléfono por última vez
  actualizado_en_revision?: boolean; // Si se actualizó en la última re-consulta
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
