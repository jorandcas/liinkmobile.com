# 🚀 GUÍA DE DESPLIEGUE EN COOLIFY - DN VERIFICATION

**Dominio:** liinkmobile.com
**Fecha:** 2026-05-21
**Versión:** 2.0.0 (MVP Multitenant)

---

## 📋 ÍNDICE

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración del Repositorio](#configuración-del-repositorio)
3. [Configuración de Base de Datos PostgreSQL](#configuración-de-base-de-datos-postgresql)
4. [Despliegue de la Aplicación](#despliegue-de-la-aplicación)
5. [Configuración del Dominio y SSL](#configuración-del-dominio-y-ssl)
6. [Configuración de SuperAdmin](#configuración-de-superadmin)
7. [Verificación y Testing](#verificación-y-testing)
8. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)

---

## 🔧 REQUISITOS PREVIOS

### 1. Cuenta de Coolify
- ✅ Tener una cuenta activa de Coolify
- ✅ Tener acceso a un servidor con Coolify instalado
- ✅ Tener acceso administrativo al servidor

### 2. Servidor Requerimientos
- **CPU:** Mínimo 2 cores
- **RAM:** Mínimo 4GB (recomendado 8GB)
- **Almacenamiento:** Mínimo 20GB SSD
- **Sistema Operativo:** Ubuntu 20.04+ o Debian 11+

### 3. Dominio y DNS
- **Dominio principal:** liinkmobile.com
- **Acceso al panel de administración DNS**
- **Capacidad de crear registros A**

### 4. Base de Datos PostgreSQL
- Coolify puede ejecutar PostgreSQL como un servicio
- Alternativamente, usar un servicio externo (Supabase, ElephantSQL, etc.)

---

## 📦 CONFIGURACIÓN DEL REPOSITORIO

### Opción 1: GitHub (Recomendado)

#### 1.1 Crear Repositorio en GitHub

```bash
# En el directorio del proyecto
cd "D:\2. Proyectos 2026\DN Verification"

# Inicializar git si no está inicializado
git init

# Agregar archivos
git add .

# Commit inicial
git commit -m "Initial commit - DN Verification v2.0.0"

# Crear repositorio en GitHub: dn-verification-api

# Agregar remote
git remote add origin https://github.com/TU_USUARIO/dn-verification-api.git

# Push
git branch -M main
git push -u origin main
```

#### 1.2 Archivos Necesarios en el Repo

Asegúrate de tener estos archivos en tu repositorio:

```
dn-verification-api/
├── .gitignore                     # ✅ IMPORTANTE: No incluir .env
├── .env.example                   # Template de variables
├── package.json                   # ✅ Dependencies
├── tsconfig.json                  # ✅ Config TypeScript
├── tailwind.config.js             # ✅ Config Tailwind
├── postcss.config.js              # ✅ Config PostCSS
├── Dockerfile                     # ✅ PARA COOLIFY (crearemos abajo)
├── .dockerignore                  # ✅ PARA COOLIFY
├── db/
│   ├── init.sql                   # ✅ Schema SQL
│   └── seed-superadmin.ts         # ✅ Seed script
├── src/                           # ✅ Todo el código fuente
├── public/                        # ✅ Archivos estáticos
└── README.md
```

---

## 🐳 CREAR DOCKERFILE

Crea un archivo llamado `Dockerfile` en la raíz del proyecto:

```dockerfile
# ============================================
# DOCKERFILE PARA DN VERIFICATION
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci

# Copiar resto del código
COPY . .

# Compilar TypeScript
RUN npm run build

# Compilar CSS
RUN npm run build:css

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Instalar dependencias de producción solo
COPY package*.json ./
RUN npm ci --only=production

# Copiar archivos compilados desde builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/db ./db

# Copiar archivos de configuración necesarios
COPY tsconfig.json ./
COPY package.json ./

# Crear directorios necesarios
RUN mkdir -p uploads logs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Start command
CMD ["node", "dist/index.js"]
```

---

## 📝 CREAR .DOCKERIGNORE

Crea un archivo llamado `.dockerignore`:

```
node_modules
dist
npm-debug.log
uploads
.env
.env.local
.env.*.local
.git
.gitignore
README.md
.vscode
.idea
*.log
.DS_Store
coverage
.nyc_output
```

---

## 🗄️ CONFIGURACIÓN DE BASE DE DATOS POSTGRESQL

### Opción 1: PostgreSQL en Coolify (Recomendado)

#### 2.1 Crear Base de Datos en Coolify

1. **Ir al panel de Coolify**
2. **Navegar a:** Resources → New Resource → PostgreSQL
3. **Configurar:**
   - **Name:** dn-verification-db
   - **Version:** PostgreSQL 15 (o latest)
   - **Database Name:** dn_verification_db
   - **Username:** dn_verification_user
4. **Click en "Deploy"**

#### 2.2 Obtener Credenciales de BD

Coolify generará automáticamente las credenciales. Ve a:
- Resources → dn-verification-db → Environment Variables

Copia estas credenciales para usarlas luego:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME` (o `POSTGRES_DATABASE`)

### Opción 2: PostgreSQL Externo (Supabase/ElephantSQL)

Si usas un servicio externo, asegúrate de obtener:
- **Connection String:** `postgresql://user:password@host:port/database`
- **Host:** Tu servidor PostgreSQL
- **Port:** 5432
- **Database:** dn_verification_db
- **User:** dn_verification_user
- **Password:** Tu contraseña segura

---

## 🚀 DESPLIEGUE DE LA APLICACIÓN

### 3.1 Crear Nueva Aplicación en Coolify

1. **Ir al panel de Coolify**
2. **Navegar a:** Resources → New Resource → Application
3. **Seleccionar:** Git (GitHub/GitLab/Bitbucket)
4. **Conectar tu cuenta de GitHub** si no está conectada
5. **Seleccionar el repositorio:** `dn-verification-api`
6. **Branch:** `main`

### 3.2 Configurar Build Settings

#### General Configuration
```
Name: DN Verification API
Environment: Production
```

#### Build Configuration
```
Builder: Dockerfile
Dockerfile Path: ./Dockerfile
Context: ./
Docker Compose: (no seleccionar)
```

#### Ports
```
Container Port: 3000
```

### 3.3 Configurar Variables de Entorno

Ve a: Application → Settings → Environment Variables

Agrega las siguientes variables:

```bash
# ============================================
# SERVIDOR
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# BASE DE DATOS (COOLIFY POSTGRESQL)
# ============================================
# Reemplaza con las credenciales de tu BD en Coolify
DB_HOST=dn-verification-db  # Si es BD en Coolify
DB_PORT=5432
DB_USER=dn_verification_user
DB_PASSWORD=TU_PASSWORD_GENERADO_POR_COOLIFY
DB_NAME=dn_verification_db

# O si usas connection string:
# DATABASE_URL=postgresql://dn_verification_user:PASSWORD@dn-verification-db:5432/dn_verification_db

# ============================================
# CIFRADO DE API KEYS - GENERAR NUEVA
# ============================================
# Genera una nueva clave para producción:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=TU_NUEVA_CLAVE_BASE64_44_CARACTERES

# ============================================
# JWT - GENERAR NUEVO SECRETO
# ============================================
# Genera un secreto muy largo y seguro (mínimo 64 caracteres)
JWT_SECRET=TU_NUEVO_JWT_SECRET_MUY_LARGO_Y_SEGURO_MINIMO_64_CARACTERES
JWT_EXPIRATION=24h

# ============================================
# VALIDACIÓN DE API KEYS
# ============================================
VALIDATION_TEST_PHONE=9233250673

# ============================================
# SEGURIDAD DE CONTRASEÑAS
# ============================================
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_TIME=900
PASSWORD_MIN_LENGTH=8

# ============================================
# CORS (OPCIONAL)
# ============================================
# CORS_ORIGIN=https://liinkmobile.com
```

### 3.4 Configurar Persistencia

Ve a: Application → Settings → Volumes

Agrega estos volúmenes:

```
 uploads → /app/uploads     # Para archivos CSV temporales
 logs    → /app/logs        # Para logs de la aplicación
```

### 3.5 Configurar Health Check

Ve a: Application → Settings → Health Check

```
Enabled: Yes
Path: /api/health
Interval: 30s
Timeout: 3s
Start Period: 40s
```

### 3.6 Deploy!

1. **Click en "Deploy"**
2. **Esperar a que termine el build** (puede tomar 3-5 minutos)
3. **Verificar los logs** para asegurar que no haya errores

---

## 🌐 CONFIGURACIÓN DEL DOMINIO Y SSL

### 4.1 Configurar DNS

Ve a tu panel de administración DNS (Cloudflare, GoDaddy, etc.) y agrega:

#### Registro A (Principal)
```
Type: A
Name: @ (o liinkmobile.com)
Value: IP_DE_TU_SERVIDOR_COOLIFY
TTL: 3600 (o 1 hora)
```

#### Registro A (API - opcional)
```
Type: A
Name: api
Value: IP_DE_TU_SERVIDOR_COOLIFY
TTL: 3600
```

### 4.2 Configurar Dominio en Coolify

1. **Ir a:** Application → Settings → Domains
2. **Agregar dominio:**
   - **Domain:** `liinkmobile.com`
   - **Check:** "Enable HTTPS"
   - **Check:** "Force HTTPS" (redirigir HTTP a HTTPS)
3. **Click en "Save"**

Coolify automáticamente:
- ✅ Configurará Nginx como reverse proxy
- ✅ Obtendrá certificado SSL gratuito con Let's Encrypt
- ✅ Configurará renovación automática del certificado

### 4.3 Verificar DNS Propagación

```bash
# Verificar registro A
dig liinkmobile.com A

# O usar
nslookup liinkmobile.com

# Debe apuntar a la IP de tu servidor Coolify
```

**Nota:** La propagación DNS puede tomar 1-24 horas (usualmente 5-30 minutos)

---

## 🔑 CONFIGURACIÓN DE SUPERADMIN

### 5.1 Acceder al Terminal de la Aplicación

1. **Ir a:** Application → Console
2. **Click en "Open Terminal"**

### 5.2 Ejecutar Seed de SuperAdmin

En el terminal de la aplicación:

```bash
# Ejecutar seed de superadmin
npm run seed:superadmin

# Te pedirá:
# - Email: admin@liinkmobile.com
# - Password: SuperPassword123! (usa una más segura en producción)
```

**Nota:** Este script:
1. Hashea la contraseña con bcrypt
2. Inserta el SuperAdmin en la base de datos
3. Configura `must_change_password = false` (para el SuperAdmin)

### 5.3 Verificar SuperAdmin Creado

```bash
# Conectar a PostgreSQL
psql -h dn-verification-db -U dn_verification_user -d dn_verification_db

# Verificar SuperAdmin
SELECT id, nombre, email, role, tenant_status, created_at
FROM tenants
WHERE role = 'superadmin';

# Salir de PostgreSQL
\q
```

---

## ✅ VERIFICACIÓN Y TESTING

### 6.1 Verificar que la Aplicación Está Corriendo

1. **Ir a:** Application → Logs
2. **Buscar estos logs:**
```
🚀 API DN Verification iniciada
📍 Puerto: 3000
🌍 Ambiente: production
📚 Documentación: http://localhost:3000/
💚 Health: http://localhost:3000/api/health
```

### 6.2 Health Check

```bash
# Test health endpoint
curl https://liinkmobile.com/api/health

# Debe retornar:
{
  "exito": true,
  "mensaje": "API DN Verification funcionando correctamente",
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

### 6.3 Login como SuperAdmin

#### vía cURL
```bash
curl -X POST https://liinkmobile.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@liinkmobile.com",
    "password": "SuperPassword123!"
  }'
```

**Respuesta esperada:**
```json
{
  "exito": true,
  "token": "eyJhbGciOiJ...",
  "user": {
    "id": 1,
    "nombre": "SuperAdmin",
    "email": "admin@liinkmobile.com",
    "role": "superadmin",
    "tenant_status": "activo",
    "must_change_password": false
  }
}
```

### 6.4 Probar Frontend

1. **Ir a:** https://liinkmobile.com/login.html
2. **Login:**
   - Email: `admin@liinkmobile.com`
   - Password: `SuperPassword123!`
3. **Debería redirigir a:** https://liinkmobile.com/superadmin.html

### 6.5 Crear Primer Tenant (Prueba)

1. **En SuperAdmin UI, click en "+ Crear Tenant"**
2. **Llenar formulario:**
   - Nombre: `Govi`
   - Email: `govi@liinkmobile.com`
   - Password: `Govi12345678`
   - API Key: `sk-govi-bc62debea3abf9272efc2c91402f5d2abaffb53df26abd6c`
3. **Click en "Crear"**
4. **Verificar en BD:**
```bash
psql -h dn-verification-db -U dn_verification_user -d dn_verification_db

SELECT nombre, email, bd_name, api_status, tenant_status
FROM tenants
WHERE role = 'tenant_admin';
```

### 6.6 Verificar SSL

1. **Ir a:** https://www.ssllabs.com/ssltest/
2. **Ingresar dominio:** liinkmobile.com
3. **Debería obtener:** A+ o A grade

---

## 📊 MONITOREO Y MANTENIMIENTO

### 7.1 Ver Logs en Tiempo Real

**En Coolify:**
- Application → Logs → Live Logs

**Vía SSH:**
```bash
# SSH al servidor
ssh root@tu-servidor

# Ver logs de Coolify
docker logs -f dn-verification-api-1

# O ver todos los logs
docker-compose -f /data/coolify/docker-compose.yml logs -f
```

### 7.2 Monitoreo de Base de Datos

```bash
# Conectar a PostgreSQL
psql -h dn-verification-db -U dn_verification_user -d dn_verification_db

# Ver tamaño de BD
SELECT pg_size_pretty(pg_database_size('dn_verification_db'));

# Ver conexiones activas
SELECT count(*) FROM pg_stat_activity WHERE datname = 'dn_verification_db';

# Ver tablas
\dt

# Salir
\q
```

### 7.3 Backup Automático de BD

**Coolify no hace backup automático por defecto.** Configura un cron job:

```bash
# SSH al servidor
ssh root@tu-servidor

# Editar crontab
crontab -e

# Agregar backup diario a las 3 AM
0 3 * * * docker exec dn-verification-db-1 pg_dump -U dn_verification_user dn_verification_db > /backups/dn-verification-$(date +\%Y\%m\%d).sql
```

### 7.4 Actualizar la Aplicación

**Para hacer cambios y desplegar:**

```bash
# 1. Hacer cambios localmente
cd "D:\2. Proyectos 2026\DN Verification"

# 2. Commit y push
git add .
git commit -m "Descripción de cambios"
git push origin main

# 3. Coolify detectará el cambio y redeployará automáticamente
# O manualmente: Application → Deploy
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

### Error 1: La aplicación no inicia

**Síntoma:** Container reinicia constantemente

**Solución:**
1. **Verificar logs:** Application → Logs
2. **Verificar variables de entorno:** Application → Settings → Environment Variables
3. **Verificar conexión a BD:** Asegúrate que `DB_HOST` sea correcto

**常见错误:**
- `DB_HOST` incorrecto (debe ser el nombre del servicio en Coolify)
- `ENCRYPTION_KEY` inválida (debe ser 32 bytes en base64)
- `JWT_SECRET` no configurado

### Error 2: No puedo conectar a la BD

**Síntoma:** `Connection refused` o `ECONNREFUSED`

**Solución:**
1. **Verificar que la BD esté corriendo:** Resources → dn-verification-db → Status
2. **Verificar credenciales:** Application → Settings → Environment Variables
3. **Verificar redes:** Application → Settings → Networks

**En Coolify, si la BD está en el mismo servidor:**
- Usa el nombre del servicio como `DB_HOST`
- Ejemplo: `DB_HOST=dn-verification-db`

### Error 3: SSL no funciona

**Síntoma:** HTTPS no funciona o certificado inválido

**Solución:**
1. **Verificar DNS:** `dig liinkmobile.com A`
2. **Verificar que DNS apunte a la IP correcta del servidor Coolify
3. **Esperar propagación DNS** (puede tomar hasta 24 horas)
4. **Verificar configuración SSL:** Application → Settings → Domains
5. **Reiniciar Nginx en Coolify:**
```bash
ssh root@tu-servidor
docker restart coolify-nginx
```

### Error 4: El SuperAdmin no se crea

**Síntoma:** El seed script falla

**Solución:**
1. **Verificar que la BD esté inicializada:**
```bash
# En el terminal de la aplicación
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/init.sql
```

2. **Ejecutar seed nuevamente:**
```bash
npm run seed:superadmin
```

3. **Verificar manualmente:**
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

SELECT * FROM tenants WHERE role = 'superadmin';
```

---

## 🎯 CHECKLIST FINAL DE PRODUCCIÓN

- [ ] ✅ Repositorio en GitHub configurado
- [ ] ✅ Dockerfile creado y probado localmente
- [ ] ✅ Base de datos PostgreSQL creada en Coolify
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Nueva `ENCRYPTION_KEY` generada para producción
- [ ] ✅ Nuevo `JWT_SECRET` generado (muy largo y seguro)
- [ ] ✅ Volúmenes configurados (uploads, logs)
- [ ] ✅ Health check configurado
- [ ] ✅ Dominio liinkmobile.com configurado en DNS
- [ ] ✅ Dominio configurado en Coolify
- [ ] ✅ SSL/HTTPS habilitado con Let's Encrypt
- [ ] ✅ Seed de SuperAdmin ejecutado
- [ ] ✅ Login como SuperAdmin probado
- [ ] ✅ Creación de tenant probada
- [ ] ✅ Validación de API Keys funcionando
- [ ] ✅ Logs monitoreando sin errores
- [ ] ✅ Backup automático configurado
- [ ] ✅ Documentación actualizada

---

## 📞 CONTACTO Y SOPORTE

**Si surgen problemas durante el despliegue:**

1. **Revisar logs primero:** Application → Logs
2. **Revisar esta guía:** Sección de solución de problemas
3. **Revisar documentación:**
   - `.contenido_sistema.md` (documentación completa)
   - `TESTING_GUIDE.md` (guía de testing)
   - `README.md` (documentación principal)

---

## 🎉 ¡FELICIDADES!

Si has completado todos los pasos, tu sistema **DN Verification v2.0.0** está ahora en producción en:

- **URL:** https://liinkmobile.com
- **API:** https://liinkmobile.com/api
- **SuperAdmin:** https://liinkmobile.com/superadmin.html
- **Login:** https://liinkmobile.com/login.html

**Credenciales SuperAdmin:**
- Email: admin@liinkmobile.com
- Password: (la que configuraste en el seed)

---

**Fecha de creación:** 2026-05-21
**Versión:** 1.0
**Estado:** Production-Ready

**FIN DE LA GUÍA DE DESPLIEGUE**
