import { ApiClient } from '../client/api-client';
import { getEndpointByEnvironment } from '../config/endpoints.config';
import { Pool } from 'pg';
import {
  ResultadoValidacion,
  ResultadoValidacionMasiva,
  ValidacionIndividualRequest
} from '../types/distribuidor.types';
import csv from 'csv-parser';

/**
 * Servicio para validación de distribuidores - MULTITENANT
 * Cada tenant usa su propia base de datos y su propia API Key
 */
export class DistribuidorService {
  private tenantId: number;
  private tenantPool: Pool;
  private apiKey: string;

  constructor(tenantId: number, dbConfig: any, apiKey: string) {
    this.tenantId = tenantId;
    this.apiKey = apiKey;
    this.tenantPool = new Pool(dbConfig);
  }

  /**
   * Guardar validación en la BD del tenant
   */
  private async guardarValidacion(telefono: string, resultado: any, origen: string, exitoso: boolean): Promise<void> {
    try {
      await this.tenantPool.query(
        `INSERT INTO validaciones (telefono, resultado, origen, exitoso)
         VALUES ($1, $2, $3, $4)`,
        [telefono, JSON.stringify(resultado), origen, exitoso]
      );
    } catch (error) {
      console.error('[DistribuidorService] Error guardando validación:', error);
      // No lanzar error para no interrumpir el flujo
    }
  }

  /**
   * Validar un número de teléfono en un ambiente específico
   */
  async validarEnAmbiente(
    telefono: string,
    ambiente: 'QA' | 'PROD'
  ): Promise<ResultadoValidacion> {
    try {
      const endpoint = getEndpointByEnvironment(ambiente);
      const url = `${endpoint.url}/${telefono}`;

      // Usar la API Key del tenant
      const client = new ApiClient(this.apiKey);
      const datos = await client.get<any>(url);

      const resultado = {
        telefono,
        exitoso: true,
        datos: {
          ...datos,
          metadata: {
            timestamp: new Date().toISOString(),
            origen: ambiente
          }
        },
        origen: ambiente
      };

      // Guardar en BD del tenant
      await this.guardarValidacion(telefono, resultado, ambiente, true);

      return resultado;
    } catch (error) {
      const resultadoError = {
        telefono,
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        origen: ambiente
      };

      // Guardar el error también
      await this.guardarValidacion(telefono, resultadoError, ambiente, false);

      return resultadoError;
    }
  }

  /**
   * Validar un número de teléfono en múltiples ambientes (secuencialmente)
   */
  async validarMultipleAmbientes(
    telefono: string,
    ambientes: ('QA' | 'PROD')[]
  ): Promise<ResultadoValidacion[]> {
    const resultados: ResultadoValidacion[] = [];

    // Ejecutar las validaciones de forma secuencial (una por una)
    for (const ambiente of ambientes) {
      const resultado = await this.validarEnAmbiente(telefono, ambiente);
      resultados.push(resultado);

      // Pausa entre requests para no sobrecargar la API
      if (ambientes.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos entre requests
      }
    }

    return resultados;
  }

  /**
   * Validar un número individual (wrapper conveniente)
   */
  async validarIndividual(
    request: ValidacionIndividualRequest
  ): Promise<ResultadoValidacion[]> {
    const ambientes = request.verificarEn || ['PROD'];
    return this.validarMultipleAmbientes(request.telefono, ambientes);
  }

  /**
   * Validar múltiples números en lotes (secuencialmente, uno por uno)
   */
  async validarLote(
    telefonos: string[],
    ambientes: ('QA' | 'PROD')[],
    _maxConcurrent?: number,
    onProgress?: (procesados: number, total: number) => void
  ): Promise<ResultadoValidacion[]> {
    // Ignoramos maxConcurrent y hacemos todo secuencialmente
    const resultados: ResultadoValidacion[] = [];

    console.log(`[Tenant ${this.tenantId}] Procesando ${telefonos.length} teléfonos de forma secuencial`);

    // Procesar cada teléfono uno por uno
    for (let i = 0; i < telefonos.length; i++) {
      const telefono = telefonos[i];
      console.log(`[Tenant ${this.tenantId}] Procesando teléfono ${i + 1}/${telefonos.length}: ${telefono}`);

      // Para cada teléfono, validar en cada ambiente (secuencialmente)
      for (const ambiente of ambientes) {
        const resultado = await this.validarEnAmbiente(telefono, ambiente);
        resultados.push(resultado);
      }

      // Notificar progreso
      if (onProgress) {
        onProgress(i + 1, telefonos.length);
      }

      // Pausa entre teléfonos para no sobrecargar la API (5 segundos)
      if (i < telefonos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos entre teléfonos
      }
    }

    return resultados;
  }

  /**
   * Leer archivo CSV y extraer números de teléfono
   */
  async leerTelefonosCSV(rutaArchivo: string): Promise<string[]> {
    const telefonos: string[] = [];

    return new Promise((resolve, reject) => {
      require('fs').createReadStream(rutaArchivo)
        .pipe(csv())
        .on('data', (row: any) => {
          // Buscar columnas comunes de teléfono
          const telefono =
            row.telefono ||
            row.phone ||
            row.celular ||
            row.movil ||
            row.numero ||
            row.telefonoContacto;

          if (telefono) {
            // Limpiar formato: solo dígitos
            const telefonoLimpio = telefono.toString().replace(/\D/g, '');
            if (telefonoLimpio.length >= 10) {
              telefonos.push(telefonoLimpio);
            }
          }
        })
        .on('end', () => {
          console.log(`[Tenant ${this.tenantId}] Leídos ${telefonos.length} teléfonos del CSV`);
          resolve(telefonos);
        })
        .on('error', (error: Error) => {
          console.error('[DistribuidorService] Error leyendo CSV:', error);
          reject(error);
        });
    });
  }

  /**
   * Validación masiva desde archivo CSV
   */
  async validarMasivaCSV(
    rutaArchivo: string,
    ambientes: ('QA' | 'PROD')[],
    maxConcurrent?: number,
    onProgress?: (procesados: number, total: number) => void
  ): Promise<ResultadoValidacionMasiva> {
    const telefonos = await this.leerTelefonosCSV(rutaArchivo);

    if (telefonos.length === 0) {
      return {
        totalProcesados: 0,
        exitosos: 0,
        fallidos: 0,
        resultados: [],
        errores: ['No se encontraron números válidos en el CSV']
      };
    }

    const resultados = await this.validarLote(telefonos, ambientes, maxConcurrent, onProgress);

    // Estadísticas
    console.log(`[Tenant ${this.tenantId}] Resultados recibidos: ${resultados.length}`);
    resultados.forEach((r, i) => {
      console.log(`[Tenant ${this.tenantId}] Resultado ${i}: exitoso=${r.exitoso}, telefono=${r.telefono}`);
    });

    const exitosos = resultados.filter(r => r.exitoso).length;
    const fallidos = resultados.filter(r => !r.exitoso).length;
    const errores = resultados
      .filter(r => !r.exitoso)
      .map(r => `${r.telefono} (${r.origen}): ${r.error}`);

    console.log(`[Tenant ${this.tenantId}] Estadísticas: exitosos=${exitosos}, fallidos=${fallidos}`);

    return {
      totalProcesados: resultados.length,
      exitosos,
      fallidos,
      resultados,
      errores
    };
  }

  /**
   * Comparar resultados entre ambientes
   */
  compararAmbientes(resultados: ResultadoValidacion[]): Map<string, ResultadoValidacion[]> {
    const agrupados = new Map<string, ResultadoValidacion[]>();

    for (const resultado of resultados) {
      if (!agrupados.has(resultado.telefono)) {
        agrupados.set(resultado.telefono, []);
      }
      agrupados.get(resultado.telefono)!.push(resultado);
    }

    return agrupados;
  }

  /**
   * Obtener estadísticas de validación
   */
  obtenerEstadisticas(resultados: ResultadoValidacion[]): {
    total: number;
    exitosos: number;
    fallidos: number;
    porcentajeExito: number;
    porcentajeFallo: number;
    porAmbiente: Map<'QA' | 'PROD', { exitosos: number; fallidos: number }>;
  } {
    const exitosos = resultados.filter(r => r.exitoso).length;
    const fallidos = resultados.filter(r => !r.exitoso).length;

    const porAmbiente = new Map<'QA' | 'PROD', { exitosos: number; fallidos: number }>();

    for (const ambiente of ['QA', 'PROD'] as const) {
      const resultadosAmbiente = resultados.filter(r => r.origen === ambiente);
      porAmbiente.set(ambiente, {
        exitosos: resultadosAmbiente.filter(r => r.exitoso).length,
        fallidos: resultadosAmbiente.filter(r => !r.exitoso).length
      });
    }

    return {
      total: resultados.length,
      exitosos,
      fallidos,
      porcentajeExito: (exitosos / resultados.length) * 100,
      porcentajeFallo: (fallidos / resultados.length) * 100,
      porAmbiente
    };
  }

  /**
   * Cerrar conexión a la BD del tenant
   */
  async close(): Promise<void> {
    await this.tenantPool.end();
  }
}
