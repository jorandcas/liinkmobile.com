# GUÍA DE TESTING - MVP MULTITENANT DN VERIFICATION

## 📋 Resumen de Implementación

Sistema multitenant completo para validación de distribuidores DN con:
- ✅ BDs separadas por tenant (máximo aislamiento)
- ✅ Login universal con JWT
- ✅ Roles: SuperAdmin y Tenant Admin
- ✅ Cifrado AES-256-GCM para API Keys
- ✅ Auditoría de acciones críticas
- ✅ Cambio obligatorio de contraseña
- ✅ Bloqueo de cuentas por intentos fallidos
- ✅ SuperAdmin UI para gestionar tenants
- ✅ Validación de API Keys al crear tenant

---

## 🚀 PASOS PARA TESTING

### 1. CONFIGURACIÓN INICIAL

#### 1.1 Configurar PostgreSQL
```sql
-- Crear base de datos principal
CREATE DATABASE bd_superadmin;

-- Conectar a bd_superadmin y ejecutar:
psql -U postgres -d bd_superadmin -f db/init.sql
```

#### 1.2 Configurar Variables de Entorno

Editar `.env` con tus valores:

```env
# Generar ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

ENCRYPTION_KEY=PON_LA_CLAVE_GENERADA_AQUI
JWT_SECRET=tu_jwt_secreto_muy_largo_y_seguro

SUPERADMIN_EMAIL=admin@tudominio.com
SUPERADMIN_PASSWORD=SuperPassword123!

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password_postgres
DB_NAME=bd_superadmin

VALIDATION_TEST_PHONE=9233250673
```

#### 1.3 Ejecutar Seed del SuperAdmin

```bash
npm run seed:superadmin
```

**IMPORTANTE:** Después de ejecutar, elimina `SUPERADMIN_PASSWORD` del `.env`

---

### 2. INICIAR SERVIDOR

```bash
npm run dev
```

El servidor iniciará en: `http://localhost:3000`

---

### 3. TESTING - SUPERADMIN

#### 3.1 Login como SuperAdmin
1. Ir a: `http://localhost:3000/login.html`
2. Email: `admin@tudominio.com`
3. Password: `SuperPassword123!`
4. Debería redirigir a: `http://localhost:3000/superadmin.html`

#### 3.2 Crear un Tenant (Prueba: "Govi")
1. En SuperAdmin UI, hacer clic en **"+ Crear Tenant"**
2. Llenar formulario:
   - Nombre: `Govi`
   - Email: `govi@gmail.com`
   - Password: `Govi12345678`
   - API Key: `sk-govi-bc62debea3abf9272efc2c91402f5d2abaffb53df26abd6c`
3. Clic en **"Crear"**
4. Debería aparecer en la lista con:
   - API Status: ✅ Válida
   - Estado: Activo
   - Último Login: Nunca

#### 3.3 Ver Auditoría
1. Cambiar a tab **"Auditoría"**
2. Deberías ver logs de:
   - `login_success` (tu login)
   - `tenant_created` (creación de Govi)

---

### 4. TESTING - TENANT GOVI

#### 4.1 Login como Tenant Govi
1. Cerrar sesión del SuperAdmin
2. Ir a: `http://localhost:3000/login.html`
3. Email: `govi@gmail.com`
4. Password: `Govi12345678`
5. **IMPORTANTE:** Debería pedir cambiar contraseña

#### 4.2 Cambiar Contraseña (Primer Login)
1. Deberías ver un modal o aviso: "Debe cambiar su contraseña"
2. Ir a: `http://localhost:3000/cambiar-password.html` (o usar el endpoint)
3. Endpoint: `POST /api/auth/change-password`
   ```json
   {
     "currentPassword": "Govi12345678",
     "newPassword": "NuevaPassword123!"
   }
   ```
4. Después de cambiar, redirige al dashboard

#### 4.3 Validar Números (Usar API del Tenant)
1. Ir a: `http://localhost:3000/dashboard.html`
2. Validar un número:
   ```bash
   curl -X POST http://localhost:3000/api/validate/single \
     -H "Authorization: Bearer TOKEN_JWT" \
     -H "Content-Type: application/json" \
     -d '{"telefono":"9233250673"}'
   ```
3. Debería:
   - Usar la API Key de Govi
   - Guardar en BD `tenant_govi`
   - Retornar resultado

---

### 5. VERIFICAR AISLAMIENTO

#### 5.1 Crear Segundo Tenant
1. Como SuperAdmin, crear "Empresa2":
   - Email: `admin@empresa2.com`
   - Password: `Empresa212345678`
   - API Key: `sk-mundoelite-369bbaa6565353726b05a67ee25b7cafb447902285ce94be`

#### 5.2 Verificar BDs Separadas
```sql
-- Conectar a PostgreSQL
psql -U postgres

-- Listar BDs
\l

-- Deberías ver:
-- - bd_superadmin
-- - tenant_govi
-- - tenant_empresa2
```

#### 5.3 Verificar Validaciones en Cada BD
```sql
-- Conectar a BD de Govi
psql -U postgres -d tenant_govi
SELECT COUNT(*) FROM validaciones;

-- Conectar a BD de Empresa2
psql -U postgres -d tenant_empresa2
SELECT COUNT(*) FROM validaciones;

-- Deberían ser independientes
```

---

### 6. TESTING DE SEGURIDAD

#### 6.1 Intentos Fallidos de Login
1. Intentar login con contraseña incorrecta 5 veces
2. Al 6to intento, debe mostrar: "Cuenta bloqueada temporalmente"

#### 6.2 Suspender Tenant
1. Como SuperAdmin, suspender tenant "Govi"
2. Intentar login como Govi
3. Debería mostrar: "Cuenta inactiva"

#### 6.3 Reactivar Tenant
1. Como SuperAdmin, activar "Govi"
2. Login como Govi debe funcionar

#### 6.4 API Key Inválida
1. Como SuperAdmin, intentar crear tenant con API Key inválida
2. Debería mostrar: "API Key inválida"

---

### 7. ENDPOINTS TESTING

#### Autenticación
```bash
# Login
POST /api/auth/login
{
  "email": "govi@gmail.com",
  "password": "Password123!"
}

# Obtener usuario actual
GET /api/auth/me
Header: Authorization: Bearer TOKEN

# Cambiar contraseña
POST /api/auth/change-password
{
  "currentPassword": "Password123!",
  "newPassword": "NuevaPassword456!"
}
```

#### SuperAdmin
```bash
# Crear tenant
POST /api/superadmin/tenants
{
  "nombre": "Empresa3",
  "email": "admin@empresa3.com",
  "password": "Password123!",
  "apiKey": "sk-..."
}

# Listar tenants
GET /api/superadmin/tenants

# Suspender tenant
PATCH /api/superadmin/tenants/:id/suspend

# Activar tenant
PATCH /api/superadmin/tenants/:id/activate

# Logs de auditoría
GET /api/superadmin/audit-logs?limit=50

# Estadísticas
GET /api/superadmin/audit-stats
```

#### Tenant
```bash
# Validar individual
POST /api/validate/single
{
  "telefono": "9233250673",
  "verificarEn": ["PROD"]
}

# Validar lote
POST /api/validate/batch
{
  "telefonos": ["9233250673", "9233250674"],
  "verificarEn": ["PROD"]
}

# Validar CSV
POST /api/validate/bulk
Content-Type: multipart/form-data
file: telefonos.csv
verificarEn: ["PROD"]
```

---

## ✅ CHECKLIST DE TESTING

- [ ] Login SuperAdmin funciona
- [ ] Crear tenant funciona
- [ ] Validación de API Key funciona
- [ ] Login tenant funciona
- [ ] Cambio de contraseña obligatorio funciona
- [ ] Validación de números usa API Key del tenant
- [ ] Validaciones se guardan en BD del tenant
- [ ] BDs de tenants están aisladas
- [ ] Suspender/activar tenant funciona
- [ ] Logs de auditoría se registran
- [ ] Intentos fallidos bloquean cuenta
- [ ] SuperAdmin no puede acceder a rutas de tenant sin autenticación
- [ ] Tenant no puede acceder a rutas de superadmin

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: "JWT_SECRET not configured"
**Solución:** Agregar `JWT_SECRET` en `.env`

### Error: "ENCRYPTION_KEY must be 32 bytes"
**Solución:** Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### Error: "Database does not exist"
**Solución:** Ejecutar `db/init.sql` en PostgreSQL

### Error: "API Key inválida"
**Solución:** Verificar que la API Key sea válida para el endpoint de DN

---

## 📊 ESTADÍSTICAS FINALES

**Archivos creados:** 25 archivos
**Líneas de código:** ~3,200 líneas
**Tiempo estimado:** 12-15 horas

**Componentes implementados:**
- ✅ Base de datos multitenant
- ✅ Autenticación con JWT
- ✅ Autorización por roles
- ✅ Cifrado AES-256-GCM
- ✅ Auditoría completa
- ✅ UI SuperAdmin
- ✅ UI Login universal
- ✅ Servicios adaptados a multitenant
- ✅ Rutas protegidas

---

## 🎯 PRÓXIMOS PASOS (POST-MVP)

1. **Validación periódica de API Keys** (Cron job cada 8 horas)
2. **Recuperación de contraseña** (Envío de email)
3. **Estadísticas avanzadas** por tenant
4. **Rate limiting** por IP
5. **Dashboard mejorado** para tenants
6. **Reports exportables** (CSV, PDF)
7. **WebSocket** para actualizaciones en tiempo real

---

**¡MVP MULTITENANT COMPLETADO! 🎉**
