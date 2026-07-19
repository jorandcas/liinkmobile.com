# 🚀 GUÍA DE DESPLIEGUE EN NUEVO SERVIDOR COOLIFY

## 📋 PASO 1: CONFIGURAR PROYECTO EN COOLIFY

### 1.1 Crear Nuevo Proyecto
1. En Coolify, ve a **"New Project"**
2. Selecciona **"From Docker Compose"**
3. Selecciona tu repositorio: `jorandcas/liinkmobile.com`
4. Selecciona la rama: `main`

### 1.2 Configurar Variables de Entorno
En Coolify, agrega estas variables de entorno:

```env
DB_PASSWORD=SuperPassword2026!
ENCRYPTION_KEY=JJsSthsbTusQr9fYlLU6n8/hd7vPDRAmGBd5JWhSrf4=
JWT_SECRET=dn_verification_jwt_secret_2026_muy_seguro_para_produccion
VALIDATION_TEST_PHONE=9233250673
```

**IMPORTANTE:** Cambia `DB_PASSWORD` si quieres una diferente.

---

## 📋 PASO 2: VERIFICAR ARCHIVOS

Asegúrate de que estos archivos existan en tu repositorio:

1. ✅ `/docker-compose.yml` - Ya existe
2. ✅ `/Dockerfile` - Debe existir
3. ✅ `/db/init.sql` - Ya existe (estructura de tablas)
4. ✅ `/db/seed-superadmin.ts` - Ya existe (script para crear admin)

---

## 📋 PASO 3: DESPLEGAR APLICACIÓN

### 3.1 Build y Deploy
1. En Coolify, haz clic en **"Deploy"**
2. Espera a que termine el build
3. Verifica que ambos contenedores estén corriendo:
   - `app` (healthy)
   - `postgres` (healthy)

### 3.2 Verificar Health Check
```bash
curl https://<tu-dominio>/api/health
```

Debería mostrar:
```json
{
  "exito": true,
  "mensaje": "API DN Verification funcionando correctamente"
}
```

---

## 📋 PASO 4: INICIALIZAR BASE DE DATOS

### 4.1 Acceder al Servidor por SSH
Conéctate al nuevo servidor donde está Coolify:
```bash
ssh tu-usuario@<ip-del-servidor>
```

### 4.2 Encontrar el Contenedor de PostgreSQL
```bash
docker ps | grep postgres
```

Deberías ver algo como:
```
dn-verification-db   Up 2 minutes   postgres:16-alpine
```

### 4.3 Copiar init.sql al Contenedor
```bash
# Copiar el archivo SQL al contenedor
docker cp /ruta/a/tu/repo/db/init.sql dn-verification-db:/tmp/init.sql
```

**O clona el repo primero:**
```bash
cd /tmp
git clone https://github.com/jorandcas/liinkmobile.com.git
docker cp liinkmobile.com/db/init.sql dn-verification-db:/tmp/init.sql
```

### 4.4 Ejecutar init.sql
```bash
docker exec -it dn-verification-db psql -U postgres -d bd_superadmin -f /tmp/init.sql
```

Debería mostrar:
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
```

### 4.5 Verificar Tablas Creadas
```bash
docker exec -it dn-verification-db psql -U postgres -d bd_superadmin -c "\dt"
```

Debería mostrar:
```
List of relations
 Schema |    Name    | Type  |  Owner
--------+------------+-------+----------
 public | audit_logs | table | postgres
 public | tenants    | table | postgres
(2 rows)
```

---

## 📋 PASO 5: CREAR USUARIO SUPERADMIN

### 5.1 Crear Superadmin con SQL

**Opción A: Usando SQL directo (recomendado)**

Desde el servidor SSH:
```bash
docker exec -it dn-verification-db psql -U postgres -d bd_superadmin -c "INSERT INTO tenants (nombre, email, password_hash, bd_name, role, must_change_password, tenant_status, api_status) VALUES ('SuperAdmin', 'admin@liinkmobile.com', '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL50lhW', 'bd_superadmin', 'superadmin', false, 'activo', NULL);"
```

El hash anterior corresponde a la contraseña: `Admin123!`

### 5.2 Verificar Superadmin Creado
```bash
docker exec -it dn-verification-db psql -U postgres -d bd_superadmin -c "SELECT id, email, role FROM tenants;"
```

Debería mostrar:
```
 id |         email         |    role
----+-----------------------+------------
  1 | admin@liinkmobile.com | superadmin
(1 row)
```

---

## 📋 PASO 6: PROBAR LOGIN

### 6.1 Acceder a la Aplicación
Ve a: `https://<tu-dominio>/login`

### 6.2 Credenciales de Acceso
- **Email:** `admin@liinkmobile.com`
- **Password:** `Admin123!`

### 6.3 Verificar Login
1. Ingresa las credenciales
2. Deberías ser redirigido al dashboard
3. Verifica que veas el panel de administración

---

## 📋 PASO 7: CAMBIAR CONTRASEÑA (OPCIONAL)

Si quieres cambiar la contraseña del superadmin:

### 7.1 Generar Nuevo Hash
```bash
docker exec -it dn-verification-db node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('TuNuevaPassword123!', 10).then(hash => console.log(hash));
"
```

### 7.2 Actualizar Contraseña
```bash
docker exec -it dn-verification-db psql -U postgres -d bd_superadmin -c "UPDATE tenants SET password_hash = '<nuevo_hash>' WHERE email = 'admin@liinkmobile.com';"
```

---

## 🎯 VERIFICACIÓN FINAL

### ✅ Checklist de Verificación

- [ ] Aplicación desplegada en Coolify
- [ ] Ambos contenedores (app + postgres) están healthy
- [ ] Health check responde correctamente
- [ ] Tablas `tenants` y `audit_logs` creadas
- [ ] Superadmin creado y verificado en BD
- [ ] Login funcional con credenciales
- [ ] Dashboard accesible
- [ ] Dominio configurado con HTTPS

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### Problema: "password authentication failed"
**Causa:** La contraseña en variables de entorno no coincide con la BD.
**Solución:** Verifica que `DB_PASSWORD` sea la misma en Coolify y en el docker-compose.

### Problema: "relation tenants does not exist"
**Causa:** No ejecutaste init.sql
**Solución:** Ejecuta el PASO 4 completo

### Problema: Contenedor postgres no inicia
**Causa:** Volumen corrupto
**Solución:** Elimina el volumen y recrea:
```bash
docker-compose down
docker volume rm dn-verification-postgres-data
docker-compose up -d
```

---

## 🎉 ¡LISTO!

Tu sistema está listo para usar. Ahora puedes:
- Crear tenants
- Configurar sus bases de datos
- Gestionar usuarios
- Verificar DN de distribuidores

**Credenciales por defecto:**
- Email: `admin@liinkmobile.com`
- Password: `Admin123!`

⚠️ **IMPORTANTE:** Cambia la contraseña después del primer login.
