import { Campana, CrearCampanaRequest, ResultadoCampana } from '../types/campana.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DistribuidorService } from './distribuidor.service';
import { getTenantApiKey, getTenantDatabaseConfig } from './tenant.service';

/**
 * Servicio de campañas
 * Almacena campañas de validación con persistencia en JSON
 */

// Ruta del archivo de persistencia
const CAMPAÑAS_FILE = path.join(process.cwd(), 'data', 'campanas.json');

// Almacenamiento en memoria de campañas
let campanas: Campana[] = [];
let inicializado = false;

// Sistema de bloqueo: solo una campaña se puede actualizar a la vez
let campaignUpdating: string | null = null; // ID de campaña actualizándose

export class CampanaService {
  /**
   * Inicializar el servicio cargando campañas desde el archivo
   */
  private static async inicializar(): Promise<void> {
    if (inicializado) return;

    try {
      const data = await fs.readFile(CAMPAÑAS_FILE, 'utf-8');
      const campanasLeidas = JSON.parse(data);

      // Convertir fechas de string a Date
      campanas = campanasLeidas.map((c: any) => ({
        ...c,
        fecha: new Date(c.fecha)
      }));

      console.log(`[CampanaService] Cargadas ${campanas.length} campañas desde disco`);
    } catch (error) {
      // Si el archivo no existe o hay error, iniciar con array vacío
      console.log('[CampanaService] Iniciando con almacenamiento vacío');
      campanas = [];
    }

    inicializado = true;
  }

  /**
   * Guardar campañas a disco
   */
  private static async guardarArchivo(): Promise<void> {
    try {
      // Asegurar que el directorio existe
      const dir = path.dirname(CAMPAÑAS_FILE);
      await fs.mkdir(dir, { recursive: true });

      // Guardar campañas
      await fs.writeFile(CAMPAÑAS_FILE, JSON.stringify(campanas, null, 2), 'utf-8');
    } catch (error) {
      console.error('[CampanaService] Error al guardar campañas:', error);
    }
  }

  /**
   * Obtener siguiente número de campaña
   */
  static async obtenerSiguienteNumero(): Promise<number> {
    await this.inicializar();
    return campanas.length + 1;
  }
  /**
   * Crear una nueva campaña
   */
  static async crear(datos: CrearCampanaRequest, usuarioEmail: string): Promise<Campana> {
    await this.inicializar();

    const ahora = new Date();
    const campana: Campana = {
      id: this.generarId(),
      nombre: datos.nombre,
      fecha: ahora,
      ultima_actualizacion: ahora, // Inicialmente igual a fecha de creación
      tipo: datos.resultados.length > 1 ? 'multiple' : 'individual',
      entorno: datos.entorno as any,
      estadisticas: datos.estadisticas,
      resultados: datos.resultados.map(r => ({
        ...r,
        ultima_consulta: ahora // Marcar cuándo se consultó cada teléfono
      })),
      creadoPor: usuarioEmail
    };

    campanas.unshift(campana); // Agregar al inicio
    await this.guardarArchivo(); // Guardar a disco
    return campana;
  }

  /**
   * Obtener todas las campañas
   */
  static async obtenerTodas(): Promise<Campana[]> {
    await this.inicializar();
    return campanas.map(c => ({
      ...c,
      fecha: new Date(c.fecha),
      ultima_actualizacion: new Date(c.ultima_actualizacion),
      resultados: c.resultados.map(r => ({
        ...r,
        ultima_consulta: r.ultima_consulta ? new Date(r.ultima_consulta) : undefined
      }))
    }));
  }

  /**
   * Obtener campaña por ID
   */
  static async obtenerPorId(id: string): Promise<Campana | null> {
    await this.inicializar();
    const campana = campanas.find(c => c.id === id);
    if (!campana) return null;

    return {
      ...campana,
      fecha: new Date(campana.fecha),
      ultima_actualizacion: new Date(campana.ultima_actualizacion),
      resultados: campana.resultados.map(r => ({
        ...r,
        ultima_consulta: r.ultima_consulta ? new Date(r.ultima_consulta) : undefined
      }))
    };
  }

  /**
   * Obtener campañas por usuario
   */
  static async obtenerPorUsuario(email: string): Promise<Campana[]> {
    await this.inicializar();
    return campanas
      .filter(c => c.creadoPor === email)
      .map(c => ({
        ...c,
        fecha: new Date(c.fecha),
        ultima_actualizacion: new Date(c.ultima_actualizacion),
        resultados: c.resultados.map(r => ({
          ...r,
          ultima_consulta: r.ultima_consulta ? new Date(r.ultima_consulta) : undefined
        }))
      }));
  }

  /**
   * Eliminar campaña
   */
  static async eliminar(id: string): Promise<boolean> {
    await this.inicializar();
    const index = campanas.findIndex(c => c.id === id);
    if (index !== -1) {
      campanas.splice(index, 1);
      await this.guardarArchivo(); // Guardar a disco
      return true;
    }
    return false;
  }

  /**
   * Generar ID único
   */
  private static generarId(): string {
    return `CMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Crear campaña de prueba
   */
  static async crearCampanaPrueba(): Promise<Campana> {
    await this.inicializar();

    // Generar nombre secuencial
    const numeroCampana = campanas.length + 1;

    const resultadosPrueba: ResultadoCampana[] = [
      {
        telefono: '1234567890',
        entorno: 'PROD',
        exito: true,
        vinculado: true,
        mensaje: 'Número válido y activo'
      },
      {
        telefono: '0987654321',
        entorno: 'PROD',
        exito: false,
        vinculado: false,
        mensaje: 'Número no encontrado en base de datos'
      },
      {
        telefono: '5555555555',
        entorno: 'PROD',
        exito: true,
        vinculado: true,
        mensaje: 'Distribuidor verificado'
      },
      {
        telefono: '4444444444',
        entorno: 'PROD',
        exito: true,
        vinculado: true,
        mensaje: 'Vigencia activa'
      },
      {
        telefono: '3333333333',
        entorno: 'PROD',
        exito: false,
        vinculado: false,
        mensaje: 'Número dado de baja'
      }
    ];

    const campana: Campana = {
      id: this.generarId(),
      nombre: `Campaña ${numeroCampana}`,
      fecha: new Date(),
      ultima_actualizacion: new Date(),
      tipo: 'multiple',
      entorno: 'PROD',
      estadisticas: {
        totalProcesados: 5,
        exitosos: 3,
        fallidos: 2,
        tiempoTotal: 2.5
      },
      resultados: resultadosPrueba,
      creadoPor: 'admin@movistar.com'
    };

    campanas.unshift(campana);
    await this.guardarArchivo(); // Guardar a disco
    return campana;
  }

  /**
   * Verificar si hay una campaña actualizándose
   */
  static getCampaignUpdating(): string | null {
    return campaignUpdating;
  }

  /**
   * Reconsultar solo los DN fallidos de una campaña
   * @param campaignId ID de la campaña
   * @param tenantId ID del tenant para obtener API Key
   * @param onProgress Callback para reportar progreso (procesados, total)
   * @returns Campaña actualizada
   */
  static async reconsultarFallidos(
    campaignId: string,
    tenantId: number,
    onProgress?: (procesados: number, total: number) => void
  ): Promise<Campana> {
    await this.inicializar();

    // Verificar sistema de bloqueo
    if (campaignUpdating) {
      throw new Error(
        `Ya hay una campaña actualizándose: ${campaignUpdating}. ` +
        'Por favor espera a que termine antes de actualizar otra.'
      );
    }

    try {
      // Buscar campaña
      const campanaIndex = campanas.findIndex(c => c.id === campaignId);
      if (campanaIndex === -1) {
        throw new Error('Campaña no encontrada');
      }

      const campana = campanas[campanaIndex];

      // Bloquear sistema
      campaignUpdating = campaignId;

      // Filtrar solo DN fallidos
      const fallidos = campana.resultados.filter(r => !r.exito || !r.vinculado);

      if (fallidos.length === 0) {
        throw new Error('No hay DN fallidos para reconsultar');
      }

      console.log(`[CampanaService] Reconsultando ${fallidos.length} DN fallidos de campaña ${campaignId}`);

      // Obtener API Key y configuración de BD del tenant
      const apiKeyResult = await getTenantApiKey(tenantId);
      if (!apiKeyResult.success || !apiKeyResult.apiKey) {
        throw new Error('No se pudo obtener API Key del tenant');
      }

      const dbConfigResult = await getTenantDatabaseConfig(tenantId);
      if (!dbConfigResult.success || !dbConfigResult.config) {
        throw new Error('No se pudo obtener configuración de base de datos del tenant');
      }

      // Crear servicio de distribuidor con parámetros correctos
      const distribuidorService = new DistribuidorService(
        tenantId,
        dbConfigResult.config,
        apiKeyResult.apiKey
      );

      // Reconsultar cada DN fallido
      let actualizados = 0;
      for (let i = 0; i < fallidos.length; i++) {
        const resultado = fallidos[i];

        try {
          // Validar en PROD (o el entorno de la campaña)
          const ambientes: ('QA' | 'PROD')[] = campana.entorno === 'AMBOS'
            ? ['PROD']
            : [campana.entorno];

          const resultados = await distribuidorService.validarMultipleAmbientes(
            resultado.telefono,
            ambientes
          );

          // Buscar el resultado original y actualizarlo
          const indiceOriginal = campana.resultados.findIndex(
            r => r.telefono === resultado.telefono
          );

          if (indiceOriginal !== -1 && resultados[0]) {
            const nuevoResultado = resultados[0];

            // Extraer estado de vinculación desde la respuesta de la API
            // La API devuelve: { success: true, data: { dn: "...", enrolado: true/false } }
            const enrolado = nuevoResultado.datos?.data?.enrolado ?? false;

            // Actualizar resultado
            campana.resultados[indiceOriginal] = {
              ...campana.resultados[indiceOriginal],
              exito: nuevoResultado.exitoso && enrolado,
              vinculado: enrolado,
              mensaje: enrolado
                ? 'DN validado correctamente y está vinculado'
                : 'DN no encontrado o no vinculado',
              ultima_consulta: new Date(),
              actualizado_en_revision: true // Marcar como actualizado en esta revisión
            };

            actualizados++;

            // Reportar progreso
            if (onProgress) {
              onProgress(i + 1, fallidos.length);
            }
          }

          // Delay de 5 segundos entre requests
          if (i < fallidos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(`[CampanaService] Error al reconsultar ${resultado.telefono}:`, error);
        }
      }

      // Actualizar estadísticas
      const exitosos = campana.resultados.filter(r => r.exito && r.vinculado).length;
      const fallidosCount = campana.resultados.length - exitosos;

      campana.estadisticas = {
        totalProcesados: campana.resultados.length,
        exitosos,
        fallidos: fallidosCount,
        tiempoTotal: campana.estadisticas.tiempoTotal // Mantener tiempo original
      };

      // Actualizar fecha de última actualización
      campana.ultima_actualizacion = new Date();

      // Guardar a disco
      await this.guardarArchivo();

      console.log(`[CampanaService] Reconsulta completada: ${actualizados} DN actualizados`);

      return campana;
    } finally {
      // Liberar bloqueo
      campaignUpdating = null;
    }
  }
}
