-- ============================================
-- ESTRUCTURA DE BASE DE DATOS DE TENANT
-- ============================================
-- Este script se ejecuta en CADA base de datos de tenant
-- Ejecutar: psql -U postgres -d bd_tenant_X -f init-tenant-db.sql

-- Tabla de validaciones individuales y masivas
CREATE TABLE IF NOT EXISTS validaciones (
  id SERIAL PRIMARY KEY,
  telefono VARCHAR(20) NOT NULL,
  resultado JSONB NOT NULL,
  origen VARCHAR(10) NOT NULL,
  exitoso BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validaciones_telefono ON validaciones(telefono);
CREATE INDEX IF NOT EXISTS idx_validaciones_origen ON validaciones(origen);
CREATE INDEX IF NOT EXISTS idx_validaciones_created ON validaciones(created_at);

-- ============================================
-- TABLA DE CAMPAÑAS
-- ============================================
CREATE TABLE IF NOT EXISTS campanas (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(64) UNIQUE NOT NULL,           -- Códigos actuales e históricos
  nombre VARCHAR(255) NOT NULL,
  fecha TIMESTAMP DEFAULT NOW(),
  ultima_actualizacion TIMESTAMP DEFAULT NOW(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('individual', 'multiple')),
  entorno VARCHAR(20) NOT NULL CHECK (entorno IN ('QA', 'PROD', 'AMBOS')),
  creado_por VARCHAR(255) NOT NULL,             -- Email del usuario

  -- Estadísticas
  total_telefonos INTEGER DEFAULT 0,
  validados INTEGER DEFAULT 0,
  vinculados INTEGER DEFAULT 0,
  no_vinculados INTEGER DEFAULT 0,
  errores INTEGER DEFAULT 0,
  porcentaje_vinculacion DECIMAL(5,2) DEFAULT 0.00,

  -- Estado
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completada', 'fallida')),

  -- Metadata
  archivo_original VARCHAR(500),                -- Nombre del archivo original (si aplica)
  finalizacion_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA DE RESULTADOS DE CAMPAÑA
-- ============================================
CREATE TABLE IF NOT EXISTS resultados_campana (
  id SERIAL PRIMARY KEY,
  campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  telefono VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('vinculado', 'no_vinculado', 'error')),
  mensaje TEXT,
  validado_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SECUENCIA PARA CÓDIGOS DE CAMPAÑA
-- ============================================
-- Esta secuencia genera IDs tipo CMP-0001, CMP-0002, etc.
CREATE SEQUENCE IF NOT EXISTS campana_codigo_seq START 1;

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campanas_codigo ON campanas(codigo);
CREATE INDEX IF NOT EXISTS idx_campanas_estado ON campanas(estado);
CREATE INDEX IF NOT EXISTS idx_campanas_fecha ON campanas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_campanas_creado_por ON campanas(creado_por);
CREATE INDEX IF NOT EXISTS idx_resultados_campana_id ON resultados_campana(campana_id);
CREATE INDEX IF NOT EXISTS idx_resultados_telefono ON resultados_campana(telefono);
CREATE INDEX IF NOT EXISTS idx_resultados_estado ON resultados_campana(estado);

-- ============================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_campana_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_actualizacion = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campana_updated_at ON campanas;
CREATE TRIGGER trigger_update_campana_updated_at
  BEFORE UPDATE ON campanas
  FOR EACH ROW
  EXECUTE FUNCTION update_campana_updated_at();

-- ============================================
-- FUNCIÓN PARA GENERAR SIGUIENTE CÓDIGO DE CAMPAÑA
-- ============================================
CREATE OR REPLACE FUNCTION generar_codigo_campana()
RETURNS VARCHAR(20) AS $$
DECLARE
  siguiente_id INTEGER;
  codigo VARCHAR(20);
BEGIN
  -- Obtener siguiente valor de la secuencia
  siguiente_id := nextval('campana_codigo_seq');

  -- Generar código con formato CMP-0001, CMP-0002, etc.
  codigo := 'CMP-' || LPAD(siguiente_id::TEXT, 4, '0');

  RETURN codigo;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE campanas IS 'Campañas de validación de DN (solo para este tenant)';
COMMENT ON COLUMN campanas.codigo IS 'Código único de campaña: CMP-0001, CMP-0002, etc.';
COMMENT ON COLUMN campanas.tipo IS 'Tipo de campaña: individual | multiple';
COMMENT ON COLUMN campanas.entorno IS 'Entorno de validación: QA | PROD | AMBOS';
COMMENT ON COLUMN campanas.estado IS 'Estado: pendiente | en_proceso | completada | fallida';

COMMENT ON TABLE resultados_campana IS 'Resultados de validación de cada teléfono en una campaña';
COMMENT ON COLUMN resultados_campana.estado IS 'Estado de validación: vinculado | no_vinculado | error';

COMMENT ON FUNCTION generar_codigo_campana() IS 'Genera el siguiente código de campaña: CMP-0001, CMP-0002, etc.';
