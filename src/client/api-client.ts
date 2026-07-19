import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../config/endpoints.config';
import { ApiError } from '../types/distribuidor.types';

/**
 * Cliente HTTP reutilizable con manejo de errores y reintentos
 */
export class ApiClient {
  private client: AxiosInstance;
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.API_KEY || '';

    if (!this.apiKey) {
      throw new Error('API Key no configurada. Setea la variable de entorno API_KEY');
    }

    this.client = axios.create({
      timeout: API_CONFIG.timeouts.response,
      // Los endpoints usan IP directa y no deben heredar proxies HTTP del entorno.
      proxy: false,
      headers: {
        ...API_CONFIG.defaultHeaders,
        'x-api-key': this.apiKey
      }
    });

    this.setupInterceptors();
  }

  /**
   * Configurar interceptores para request/response
   */
  private setupInterceptors(): void {
    // Interceptor de request
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API Client] Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[API Client] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    // Interceptor de response
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API Client] Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Manejo de errores con información detallada
   */
  private handleError(error: AxiosError): never {
    if (error.response) {
      // Error de respuesta del servidor
      const status = error.response.status;
      const message = error.response.data as any;

      console.error('[API Client] Response error:', {
        status,
        data: message,
        url: error.config?.url
      });

      throw new ApiError(
        status,
        message.mensaje || 'Error en la respuesta del servidor',
        Array.isArray(message.detalles) ? message.detalles : [message]
      );
    } else if (error.request) {
      // Error sin respuesta (timeout, network error)
      console.error('[API Client] No response:', error.message);
      throw new ApiError(503, 'Servicio no disponible', [error.message]);
    } else {
      // Error de configuración
      console.error('[API Client] Config error:', error.message);
      throw new ApiError(500, 'Error de configuración', [error.message]);
    }
  }

  /**
   * GET request con reintentos automáticos
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.retryWrapper(async () => {
      const response = await this.client.get<T>(url, config);
      return response.data;
    });
  }

  /**
   * POST request con reintentos automáticos
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.retryWrapper(async () => {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    });
  }

  /**
   * Wrapper para reintentos con backoff exponencial
   */
  private async retryWrapper<T>(
    operation: () => Promise<T>,
    maxAttempts: number = API_CONFIG.retries.maxAttempts
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // No reintentar en errores de cliente (4xx)
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Esperar con backoff exponencial antes de reintentar
        if (attempt < maxAttempts) {
          const delay = API_CONFIG.retries.retryDelay * Math.pow(API_CONFIG.retries.backoffMultiplier, attempt - 1);
          console.log(`[API Client] Retry ${attempt}/${maxAttempts} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Helper para pausas
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verificar salud del cliente
   */
  isHealthy(): boolean {
    return !!this.apiKey;
  }
}
