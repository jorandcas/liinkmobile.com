/**
 * Tipos para el sistema de autenticación
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  exito: boolean;
  token?: string;
  usuario?: {
    email: string;
    nombre: string;
  };
  mensaje?: string;
  errores?: string[];
}

export interface User {
  email: string;
  password: string; // En producción esto debería estar hasheado
  nombre: string;
}

export interface JwtPayload {
  email: string;
  nombre: string;
  iat?: number;
  exp?: number;
}
