import { Campana, CrearCampanaRequest, ResultadoCampana } from '../types/campana.types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Servicio de campañas
 * Almacena campañas de validación con persistencia en JSON
 */

// Ruta del archivo de persistencia
const CAMPAÑAS_FILE = path.join(process.cwd(), 'data', 'campanas.json');

// Almacenamiento en memoria de campañas
let campanas: Campana[] = [];
let inicializado = false;

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

    const campana: Campana = {
      id: this.generarId(),
      nombre: datos.nombre,
      fecha: new Date(),
      tipo: datos.resultados.length > 1 ? 'multiple' : 'individual',
      entorno: datos.entorno as any,
      estadisticas: datos.estadisticas,
      resultados: datos.resultados,
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
      fecha: new Date(c.fecha)
    }));
  }

  /**
   * Obtener campaña por ID
   */
  static async obtenerPorId(id: string): Promise<Campana | null> {
    await this.inicializar();
    const campana = campanas.find(c => c.id === id);
    return campana ? { ...campana, fecha: new Date(campana.fecha) } : null;
  }

  /**
   * Obtener campañas por usuario
   */
  static async obtenerPorUsuario(email: string): Promise<Campana[]> {
    await this.inicializar();
    return campanas
      .filter(c => c.creadoPor === email)
      .map(c => ({ ...c, fecha: new Date(c.fecha) }));
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
}
