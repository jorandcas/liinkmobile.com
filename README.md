# API de Verificación de Distribuidores DN

Sistema multitenant para validación de distribuidores con gestión de campañas, soporte para múltiples ambientes (QA/PROD) y distinción clara entre DN vinculados, no vinculados y errores de API.

## 🌟 Características Principales

- ✅ **Validación individual** de números de teléfono
- 📊 **Validación por lotes** desde JSON
- 📁 **Validación masiva** desde archivos CSV con progreso en tiempo real (SSE)
- 🔀 **Consultas multi-ambiente** en QA y PROD
- 📈 **Sistema de campañas** con estadísticas y re-consulta de fallidos
- 🔄 **Re-consulta de DN fallidos** en campañas existentes
- 🔐 **Multitenant** con base de datos dedicada por tenant
- 🎯 **Distinción clara** entre DN vinculado, no vinculado y error de API
- ⚡ **Control de concurrencia** con procesamiento secuencial (5 segundos entre requests)
- 🛡️ **Type safety** con TypeScript y Zod

## 📁 Estructura del Proyecto

```
src/
├── config/
│   └── endpoints.config.ts        # Configuración de endpoints QA/PROD
├── client/
│   └── api-client.ts              # Cliente HTTP con reintentos automáticos
├── controllers/
│   ├── auth.controller.ts         # Autenticación y gestión de usuarios
│   ├── campana.controller.ts      # Gestión de campañas
│   └── distribuidor.controller.ts # Validación de DN
├── routes/
│   ├── auth.routes.ts             # Rutas de autenticación
│   ├── campana.routes.ts          # Rutas de campañas (SSE)
│   └── distribuidor.routes.ts     # Rutas de validación
├── services/
│   ├── audit.service.ts           # Auditoría de acciones
│   ├── campana.service.ts         # Lógica de campañas
│   ├── distribuidor.service.ts    # Lógica de validación de DN
│   └── tenant.service.ts          # Gestión de tenants y BD
├── middleware/
│   └── auth.middleware.ts         # Middleware de autenticación JWT
├── types/
│   ├── campana.types.ts           # Tipos de campañas
│   └── distribuidor.types.ts      # Tipos de validación
├── utils/
│   └── encryption.util.ts         # Cifrado de API Keys
└── index.ts                        # Punto de entrada
```

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus configuraciones
```

## ⚙️ Configuración

Variables de entorno (`.env`):

```env
# ============================================
# SERVIDOR
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# BASE DE DATOS PRINCIPAL (SuperAdmin)
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=bd_superadmin

# ============================================
# CIFRADO DE API KEYS
# ============================================
# Clave de 32 bytes (44 caracteres en base64)
ENCRYPTION_KEY=tu_clave_de_32_bytes_base64

# ============================================
# JWT
# ============================================
JWT_SECRET=tu_jwt_secret
JWT_EXPIRATION=24h

# ============================================
# API KEYS DE MOVISTAR
# ============================================
API_KEY_QA=tu_api_key_qa
API_KEY_PROD=tu_api_key_prod

# ============================================
# VALIDACIÓN
# ============================================
VALIDATION_TEST_PHONE=9233250673
```

## 🏃 Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t dn-verification .
docker run -p 3000:3000 --env-file .env dn-verification
```

## 📡 Endpoints

### Autenticación

#### 1. Login
**POST** `/api/auth/login`

```json
{
  "email": "admin@tudominio.com",
  "password": "tu_password"
}
```

**Response:**
```json
{
  "exito": true,
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "email": "admin@tudominio.com",
    "role": "superadmin"
  }
}
```

### Validación de DN

#### 1. Validar número individual
**POST** `/api/validate/single`

```json
{
  "telefono": "2218169631",
  "verificarEn": ["PROD"]
}
```

**Response:**
```json
{
  "exito": true,
  "datos": [
    {
      "telefono": "2218169631",
      "exitoso": true,
      "datos": {
        "success": true,
        "data": {
          "dn": "2218169631",
          "enrolado": true
        }
      },
      "origen": "PROD"
    }
  ],
  "mensaje": "Validación completada para 2218169631"
}
```

#### 2. Validar lote (JSON)
**POST** `/api/validate/batch`

```json
{
  "telefonos": ["2218169631", "9619441187"],
  "verificarEn": ["PROD"],
  "maxConcurrent": 10
}
```

**Response:**
```json
{
  "exito": true,
  "datos": {
    "resultados": [
      {
        "telefono": "2218169631",
        "exitoso": true,
        "datos": {
          "success": true,
          "data": {
            "dn": "2218169631",
            "enrolado": true
          }
        },
        "origen": "PROD"
      },
      {
        "telefono": "9619441187",
        "exitoso": true,
        "datos": {
          "success": true,
          "data": {
            "dn": "9619441187",
            "enrolado": false
          }
        },
        "origen": "PROD"
      }
    ],
    "estadisticas": {
      "total": 2,
      "vinculados": 1,
      "noVinculados": 1,
      "erroresCount": 0,
      "porcentajeExito": 50
    }
  }
}
```

#### 3. Validación masiva (CSV) con SSE
**POST** `/api/validate/bulk`

**Content-Type:** `multipart/form-data`

```bash
curl -X POST http://localhost:3000/api/validate/bulk \
  -F "file=@telefonos.csv" \
  -F "verificarEn=[\"PROD\"]" \
  -F "maxConcurrent=10"
```

**Formato del CSV:**
```csv
telefono
2218169631
9619441187
9233250673
```

**Eventos SSE:**
- `type: start` - Inicio del procesamiento
- `type: progress` - Progreso actual (procesados/total)
- `type: completo` - Resultados finales

### Campañas

#### 1. Obtener campañas
**GET** `/api/campanas`

**Response:**
```json
{
  "exito": true,
  "campanas": [
    {
      "id": "camp_123",
      "nombre": "Campaña Enero",
      "fecha": "2026-01-15T10:30:00Z",
      "ultima_actualizacion": "2026-01-15T12:00:00Z",
      "estadisticas": {
        "totalProcesados": 100,
        "exitosos": 85,
        "fallidos": 15
      },
      "resultados": [...]
    }
  ]
}
```

#### 2. Crear campaña
**POST** `/api/campanas`

```json
{
  "nombre": "Campaña Febrero",
  "resultados": [...],
  "entorno": "PROD",
  "estadisticas": {...}
}
```

#### 3. Reconsultar fallidos (SSE)
**GET** `/api/campanas/:id/reconsultar-fallidos?token=jwt_token`

Reconsulta solo los DN fallidos de una campaña con progreso en tiempo real.

**Eventos SSE:**
- `type: start` - Inicio con tiempo estimado
- `type: progress` - Progreso actual
- `type: complete` - Campaña actualizada

## 🎯 Comportamiento de Validación

### Estados de Validación

El sistema distingue entre **3 estados**:

| Estado | API Funcionó | DN Vinculado | Descripción |
|--------|--------------|--------------|-------------|
| ✅ Vinculado | Sí | Sí (`enrolado: true`) | DN enrolado correctamente |
| ❌ No Vinculado | Sí | No (`enrolado: false`) | API respondió pero DN no enrolado |
| ⚠️ Error API | No | - | Timeout, error HTTP, fallo de red |

### Respuesta de la API de Movistar

La API externa devuelve este formato:

```json
{
  "success": true,
  "data": {
    "dn": "2218169631",
    "enrolado": true  // true = vinculado, false = no vinculado
  }
}
```

### Interpretación de Resultados

**Frontend:**
- **Estado API:** `exitoso` → Indica si la API respondió (HTTP 200)
- **Vinculado:** `datos.data.enrolado` → Indica si el DN está vinculado

**Backend:**
- `exitoso: true` - API respondió correctamente
- `exitoso: false` - Error de comunicación con la API
- `datos.data.enrolado` - `true`/`false` según estado del DN

## 📊 Ejemplos de Uso

### cURL

```bash
# Validación individual
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"telefono":"2218169631","verificarEn":["PROD"]}'

# Validación en ambos ambientes
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"telefono":"2218169631","verificarEn":["QA","PROD"]}'
```

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const token = 'your_jwt_token';

// Validación individual
const response = await axios.post(
  'http://localhost:3000/api/validate/single',
  {
    telefono: '2218169631',
    verificarEn: ['PROD']
  },
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

console.log(response.data);
```

## 🔧 Características Técnicas

- **Type Safety**: TypeScript con strict mode
- **Validación**: Zod para validar requests
- **Autenticación**: JWT con middleware
- **Multitenant**: BD dedicada por tenant
- **Concurrencia**: Procesamiento secuencial (5s entre requests)
- **Reintentos**: Backoff exponencial (max 3 intentos)
- **SSE**: Server-Sent Events para progreso en tiempo real
- **Cifrado**: AES-256-GCM para API Keys
- **Logs**: Logging detallado de requests y errores
- **Error Handling**: Manejo centralizado de errores

## 📝 Notas Importantes

### Control de Concurrencia

Movistar solo permite **una validación a la vez**. El sistema procesa las validaciones de forma **secuencial** con:

- 5 segundos de espera entre requests
- Procesamiento uno por uno
- Control automático de timing

### Tiempos de Espera

- **Timeout de respuesta**: 30 segundos
- **Entre requests**: 5 segundos
- **Para 100 números**: ~8.5 minutos

### Gestión de Campañas

- Las campañas se guardan en archivos JSON
- Se pueden reconsultar los DN fallidos
- Se mantiene historial de actualizaciones
- Estadísticas en tiempo real

## 🚨 Errores Comunes

### Error 401: No autorizado
- Falta o es inválido el token JWT
- Solución: Hacer login y obtener nuevo token

### Error 429: Too Many Requests
- Demasiadas peticiones simultáneas
- Solución: El sistema controla esto automáticamente, espera 5 segundos

### Error 503: Servicio no disponible
- Timeout o error de conexión con Movistar
- Solución: El sistema reintenta automáticamente (max 3 veces)

## 📄 Licencia

ISC

## 👥 Soporte

Para reportar issues o sugerencias, por favor crea un ticket en el repositorio de GitHub.
