# 📘 Guía de Despliegue en Coolify - DN Verification API

## 📋 Requisitos Previos

- ✅ Tener Coolify instalado en tu servidor
- ✅ Tener una base de datos PostgreSQL (puede ser en Coolify o externa)
- ✅ Acceso al repositorio GitHub: `https://github.com/jorandcas/liinkmobile.com.git`

---

## 🚀 Pasos de Despliegue

### 1. Preparar Repositorio

El repositorio ya está configurado con:
- Dockerfile optimizado
- .dockerignore configurado
- .gitignore actualizado
- Health check en `/api/health`

**Pasos:**

```bash
# 1. Revisar cambios pendientes
git status

# 2. Hacer commit de los cambios (si los hay)
git add .
git commit -m "Preparación para despliegue en Coolify"

# 3. Push a GitHub
git push origin main
```

---

### 2. Configurar Base de Datos en Coolify

#### Opción A: Base de datos en Coolify (Recomendado)

1. En Coolify, ir a **Resources** → **New Resource**
2. Seleccionar **Database** → **PostgreSQL**
3. Configurar:
   - **Name**: `dn-verification-db`
   - **Version**: PostgreSQL 15 o 16
   - **Database Name**: `bd_superadmin`
   - **User**: `postgres` (o crear uno nuevo)
4. Guardar las credenciales que te proporciona Coolify

#### Opción B: Base de datos externa

Si ya tienes PostgreSQL en otro servidor, asegúrate de:
- Tener las credenciales (host, puerto, usuario, password)
- La base de datos debe existir: `bd_superadmin`

---

### 3. Crear Proyecto en Coolify

1. En Coolify, ir a **Projects** → **New Project**
2. **Nombre**: `DN Verification`
3. **Descripción**: `API para verificación de distribuidores DN`
4. Guardar

---

### 4. Desplegar Aplicación

1. En el proyecto, ir a **New Resource** → **Application**
2. **Nombre**: `dn-verification-api`
3. **Repository**: Seleccionar tu repo de GitHub
4. **Branch**: `main`
5. **Build Type**: Dockerfile (ya detectará automáticamente)
6. **Port**: `3000`

---

### 5. Configurar Variables de Entorno

Ir a **Environment Variables** y agregar:

#### Variables Generales:
```
NODE_ENV=production
PORT=3000
```

#### Base de Datos (usar credenciales de Coolify):
```
DB_HOST=<tu_db_host_de_coolify>
DB_PORT=<tu_db_port_de_coolify>
DB_USER=<tu_db_user_de_coolify>
DB_PASSWORD=<tu_db_password_de_coolify>
DB_NAME=bd_superadmin
```

#### Seguridad:
```
ENCRYPTION_KEY=<generar_32_caracteres_aleatorios>
JWT_SECRET=<generar_64_caracteres_aleatorios>
JWT_EXPIRATION=24h
```

#### Políticas de Seguridad:
```
PASSWORD_MIN_LENGTH=8
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_TIME=900
```

#### CORS:
```
CORS_ORIGIN=https://liinkmobile.com,https://www.liinkmobile.com
```

#### Validación (Opcional):
```
VALIDATION_TEST_PHONE=7773354612
```

#### Generación de claves seguras:

```bash
# Para ENCRYPTION_KEY (32+ caracteres)
openssl rand -base64 32

# Para JWT_SECRET (64+ caracteres)
openssl rand -base64 64
```

---

### 6. Configurar Dominio

1. Ir a **Domains** en tu aplicación
2. Agregar dominio: `api.tu-dominio.com` (o usar dominio de Coolify)
3. Coolify generará SSL automáticamente con Let's Encrypt

---

### 7. Seed de SuperAdmin

Una vez desplegada la aplicación:

1. Ir a **Console** en Coolify (terminal del contenedor)
2. Ejecutar:
```bash
npm run seed:superadmin
```

3. Esto creará el superadmin:
- **Usuario**: `superadmin@dnverification.com`
- **Contraseña**: `DN2025Admin!`
- **IMPORTANTE**: Cambiar la contraseña en el primer login

---

## 🔧 Troubleshooting

### Error de conexión a base de datos:
- Verificar que las credenciales de DB sean correctas
- Asegurar que la DB acepte conexiones remotas (si es externa)
- Verificar el puerto de la DB

### Error de health check:
- Revisar logs en Coolify: **Logs** → **Real-time**
- Verificar que el puerto 3000 esté disponible
- Asegurar que NODE_ENV=production

### Error de compilación:
- Verificar que `package.json` tenga todos los scripts
- Revisar logs de build para errores específicos

### Archivos estáticos no cargan:
- Verificar que la carpeta `public/` esté en el repositorio
- Revisar permisos de archivos

---

## 📊 Monitoreo

### Health Check:
- URL: `https://api.tu-dominio.com/api/health`
- Debe retornar: `{"exito": true, "mensaje": "API DN Verification funcionando correctamente"...}`

### Logs:
- En Coolify: **Application** → **Logs**
- Logs en tiempo real para debugging

### Métricas:
- Coolify proporciona métricas de CPU, memoria, disco
- Configurar alertas si es necesario

---

## 🔄 Actualizaciones

### Para actualizar la aplicación:

1. **Hacer cambios localmente:**
```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
```

2. **En Coolify:**
- Ir a la aplicación
- Click en **Deploy** → **Redeploy**
- O configurar **Auto-deploy** en el webhook

---

## 🔒 Consideraciones de Seguridad

1. **Nunca commitear `.env`**
2. **Cambiar contraseña del superadmin** inmediatamente
3. **Usar SSL siempre** (Coolify lo hace auto)
4. **Rotar JWT_SECRET periódicamente**
5. **Configurar firewall** si DB es externa
6. **Backups automáticos** de la DB (Coolify lo puede hacer)

---

## 📁 Estructura de Archivos Relevantes

```
DN Verification/
├── Dockerfile              ✅ Multi-stage build optimizado
├── .dockerignore          ✅ Excluye archivos innecesarios
├── .gitignore             ✅ Configurado para producción
├── .env.example           ✅ Plantilla de variables
├── package.json           ✅ Scripts configurados
├── tsconfig.json          ✅ TypeScript configurado
├── src/
│   └── index.ts           ✅ Health check configurado
└── db/
    └── seed-superadmin.ts ✅ Seed inicial
```

---

## 🎯 Checklist Pre-Despliegue

- [ ] Push últimos cambios a GitHub
- [ ] Base de datos PostgreSQL creada/lista
- [ ] Variables de entorno configuradas
- [ ] ENCRYPTION_KEY generado (32+ caracteres)
- [ ] JWT_SECRET generado (64+ caracteres)
- [ ] Dominio configurado
- [ ] Health check funcionando
- [ ] Seed de superadmin ejecutado
- [ ] Contraseña de superadmin cambiada
- [ ] SSL activo (Let's Encrypt)

---

## 📞 Soporte

Si encuentras problemas:
1. Revisar logs en tiempo real en Coolify
2. Verificar variables de entorno
3. Validar conexión a base de datos
4. Revisar health check endpoint

---

## 🌐 URLs Post-Despliegue

- **API**: `https://api.tu-dominio.com`
- **Health Check**: `https://api.tu-dominio.com/api/health`
- **Dashboard**: `https://api.tu-dominio.com/dashboard.html`
- **Login**: `https://api.tu-dominio.com/login.html`

---

**¡Buena suerte con el despliegue! 🚀**
