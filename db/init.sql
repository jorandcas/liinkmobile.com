-- ============================================
-- MVP MULTITENANT - ESTRUCTURA DE BASE DE DATOS
-- ============================================

-- Tabla principal de tenants (incluye superadmin)
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  bd_name VARCHAR(100) UNIQUE NOT NULL,
  api_key_encrypted TEXT,                    -- NULL para superadmin
  api_status VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente' | 'valida' | 'invalida'
  tenant_status VARCHAR(20) DEFAULT 'activo',  -- 'activo' | 'suspendido'
  role VARCHAR(20) DEFAULT 'tenant_admin',     -- 'superadmin' | 'tenant_admin'
  must_change_password BOOLEAN DEFAULT true,   -- Cambio obligatorio al primer login
  last_login_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de auditoría mínima (MVP)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  user_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,              -- 'tenant_created', 'tenant_suspended', 'login_success', etc.
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(tenant_status);
CREATE INDEX IF NOT EXISTS idx_tenants_role ON tenants(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- Función para actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at en tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE tenants IS 'Tabla de tenants y superadmin';
COMMENT ON COLUMN tenants.api_key_encrypted IS 'API Key cifrada con AES-256-GCM (NULL para superadmin)';
COMMENT ON COLUMN tenants.api_status IS 'Estado de validación de la API Key: pendiente | valida | invalida';
COMMENT ON COLUMN tenants.tenant_status IS 'Estado del tenant: activo | suspendido';
COMMENT ON COLUMN tenants.role IS 'Rol del usuario: superadmin | tenant_admin';
COMMENT ON COLUMN tenants.must_change_password IS 'Indica si el usuario debe cambiar su contraseña al primer login';
COMMENT ON COLUMN tenants.failed_login_attempts IS 'Contador de intentos fallidos de login';
COMMENT ON COLUMN tenants.locked_until IS 'Timestamp hasta el cual la cuenta está bloqueada';

COMMENT ON TABLE audit_logs IS 'Auditoría de acciones críticas del sistema';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de acción: tenant_created, tenant_suspended, login_success, login_failed, etc.';
COMMENT ON COLUMN audit_logs.details IS 'Detalles adicionales en formato JSONB';
