# API de Verificación de Distribuidores DN

Backend TypeScript/Express para validación de distribuidores con soporte para consultas simultáneas en múltiples ambientes.

## Características

- Validación individual de números de teléfono
- Validación por lotes desde JSON
- Validación masiva desde archivos CSV
- Consultas simultáneas en QA y PROD
- Control de concurrencia para optimizar rendimiento
- Manejo robusto de errores con reintentos automáticos
- Type safety con TypeScript
- Validación de requests con Zod

## Estructura del Proyecto

```
src/
├── config/
│   └── endpoints.config.ts      # Configuración de endpoints
├── client/
│   └── api-client.ts            # Cliente HTTP reutilizable
├── controllers/
│   └── distribuidor.controller.ts # Controladores de la API
├── routes/
│   └── distribuidor.routes.ts   # Rutas de Express
├── services/
│   └── distribuidor.service.ts  # Lógica de negocio
├── types/
│   └── distribuidor.types.ts    # Definiciones de tipos
└── index.ts                     # Punto de entrada
```

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env y configura tu API_KEY
```

## Uso

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## Endpoints

### 1. Validar un número individual

**POST** `/api/validate/single`

```json
{
  "telefono": "9233250673",
  "verificarEn": ["PROD"]
}
```

**Response:**
```json
{
  "exito": true,
  "datos": [
    {
      "telefono": "9233250673",
      "exitoso": true,
      "datos": { /* respuesta del API */ },
      "origen": "PROD"
    }
  ],
  "mensaje": "Validación completada para 9233250673"
}
```

### 2. Validar lote de números (JSON)

**POST** `/api/validate/batch`

```json
{
  "telefonos": ["9233250673", "9233250674", "9233250675"],
  "verificarEn": ["PROD"],
  "maxConcurrent": 10
}
```

**Response:**
```json
{
  "exito": true,
  "datos": {
    "resultados": [ /* resultados */ ],
    "estadisticas": {
      "total": 3,
      "exitosos": 2,
      "fallidos": 1,
      "porcentajeExito": 66.67,
      "porcentajeFallo": 33.33
    }
  }
}
```

### 3. Validación masiva (CSV)

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
9233250673
9233250674
9233250675
```

## Ejemplos de Uso

### cURL

```bash
# Validación individual
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" \
  -d '{"telefono":"9233250673"}'

# Validación en ambos ambientes simultáneamente
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" \
  -d '{"telefono":"9233250673","verificarEn":["QA","PROD"]}'
```

### JavaScript/TypeScript

```typescript
import axios from 'axios';

// Validación individual
const response = await axios.post('http://localhost:3000/api/validate/single', {
  telefono: '9233250673',
  verificarEn: ['PROD']
});

console.log(response.data);
```

## Configuración

Variables de entorno (`.env`):

```env
API_KEY=tu_api_key_aqui      # API Key para autenticación
PORT=3000                     # Puerto del servidor
NODE_ENV=development          # Ambiente: development|production
```

## Características Técnicas

- **Type Safety**: TypeScript con strict mode
- **Validación**: Zod para validar requests
- **Concurrencia**: Control automático de peticiones simultáneas
- **Reintentos**: Backoff exponencial para fallos
- **Logs**: Logging detallado de requests y errores
- **Error Handling**: Manejo centralizado de errores

## Licencia

ISC
