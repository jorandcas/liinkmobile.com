# 🚀 GUÍA COMPLETA DE IMPLEMENTACIÓN

## 📋 RESUMEN DE LA SOLUCIÓN

**Problemas resueltos:**
1. ✅ **IDs de campañas compartidos** → Ahora cada tenant tiene su secuencia independiente
2. ✅ **Archivos se pierden en redeploy** → Volúmenes persistentes en docker-compose
3. ✅ **Campañas en JSON compartido** → Migradas a PostgreSQL con aislamiento por tenant

**Arquitectura final:**
- Tenant A → `bd_tenant_a` → Campañas: CMP-0001, CMP-0002, CMP-0003...
- Tenant B → `bd_tenant_b` → Campañas: CMP-0001, CMP-0002, CMP-0003...
- Tenant C → `bd_tenant_c` → Campañas: CMP-0001, CMP-0002, CMP-0003...

---

## 📁 ARCHIVOS CREADOS/MODIFICADOS

### Nuevos archivos:
```
db/init-tenant-db.sql                 # Estructura de BD para cada tenant
db/migrate-campanas-to-db.ts          # Script de migración JSON → PostgreSQL
src/services/campana.service.db.ts    # Servicio de campañas con PostgreSQL
docker-compose.yml                    # Configuración de contenedores
COOLIFY_MIGRATION_COMPOSE.md          # Guía para Coolify
```

### Archivos modificados:
```
src/controllers/campana.controller.ts  # Ahora usa CampanaServiceDB
package.json                            # Scripts de migración agregados
.env.example                            # Documentación de DB_HOST
```

---

## 🔧 PASOS PARA IMPLEMENTAR

### PASO 1: INICIALIZAR BASE DE DATOS DE TENANTS

Para cada tenant existente, ejecutar:

```bash
# Ejemplo para tenant 1
npm run init:tenant-db bd_tenant_1

# Ejemplo para tenant 2
npm run init:tenant-db bd_tenant_2
```

**O manualmente:**
```bash
psql -U postgres -d bd_tenant_1 -f db/init-tenant-db.sql
psql -U postgres -d bd_tenant_2 -f db/init-tenant-db.sql
psql -U postgres -d bd_tenant_3 -f db/init-tenant-db.sql
```

Esto creará las tablas `campanas` y `resultados_campana` en cada BD.

---

### PASO 2: MIGRAR DATOS DE JSON A POSTGRESQL

```bash
# Asegúrate de tener las variables de entorno configuradas
npm run migrate:campanas
```

**Qué hace este script:**
1. Lee `data/campanas.json`
2. Por cada campaña, identifica el tenant por email
3. Migra la campaña y resultados a la BD del tenant
4. Crea backup del JSON como `data/campanas.json.backup`

**Verificación:**
```bash
# Ver campañas migradas en tenant 1
psql -U postgres -d bd_tenant_1 -c "SELECT codigo, nombre, estado FROM campanas;"

# Ver resultados
psql -U postgres -d bd_tenant_1 -c "SELECT COUNT(*) FROM resultados_campana;"
```

---

### PASO 3: DESPLEGAR EN COOLIFY

**Opción A: Empezar desde cero (SIN datos de producción)**

1. **Elimina servicios actuales en Coolify:**
   - Eliminar aplicación `jorandcas/liinkmobile.com:main-w0w4408048gkk8ckw808c8w4`
   - Eliminar base de datos `postgresql-database-g0c48g088sggswwwsgssk8gw`

2. **Haz push de los cambios:**
   ```bash
   git push
   ```

3. **Crea proyecto en Coolify con Docker Compose:**
   - New Project → From Docker Compose
   - Selecciona tu repositorio
   - Coolify detectará `docker-compose.yml` automáticamente

4. **Configura variables de entorno en Coolify:**
   ```env
   DB_PASSWORD=dUCq4eymvTJDxtQHdqrJXCOqnYl5bUyJFuEXqDV7tyUHz70hUoUiaZTD1Rj4tx5v
   ENCRYPTION_KEY=JJsSthsbTusQr9fYlLU6n8/hd7vPDRAmGBd5JWhSrf4=
   JWT_SECRET=dn_verification_jwt_secret_2026_muy_seguro_para_produccion
   VALIDATION_TEST_PHONE=9233250673
   ```

5. **Despliega**

**Opción B: Migrar con datos existentes (CON producción)**

Sigue los pasos del Paso 1 y 2 ANTES de desplegar en Coolify.

---

### PASO 4: VERIFICACIÓN POST-DESPLIEGUE

**1. Ver contenedores:**
```bash
# En Coolify, verifica que ambos contenedores estén corriendo:
# - dn-verification-app
# - dn-verification-db
```

**2. Ver conexión a BD:**
```bash
# Terminal de la aplicación en Coolify
node -e "const { Client } = require('pg'); const client = new Client({ host: 'postgres', user: 'postgres', password: 'dUCq4eymvTJDxtQHdqrJXCOqnYl5bUyJFuEXqDV7tyUHz70hUoUiaZTD1Rj4tx5v', database: 'bd_superadmin' }); client.connect().then(() => console.log('✅ Conexión OK')).catch(err => console.error('❌ Error:', err.message)).finally(() => client.end());"
```

**3. Ver API:**
```bash
# Probar endpoint de health
curl https://liinkmobile.com/api/health

# Probar login
curl -X POST https://liinkmobile.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tudominio.com","password":"SuperPassword123!"}'
```

**4. Ver campañas:**
```bash
# Crear campaña (requiere JWT token)
curl -X POST https://liinkmobile.com/api/campanas \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Campaña Test",
    "resultados": [{"telefono":"1234567890","entorno":"PROD","exito":true,"vinculado":true}],
    "entorno": "PROD",
    "estadisticas": {"totalProcesados":1,"exitosos":1,"fallidos":0,"tiempoTotal":1}
  }'
```

---

## 🔍 VERIFICACIÓN DE AISLAMIENTO DE TENANTS

**Test de aislamiento:**

1. **Crea campañas en Tenant A:**
   - Campaña 1 → Debe ser `CMP-0001`
   - Campaña 2 → Debe ser `CMP-0002`

2. **Crea campañas en Tenant B:**
   - Campaña 1 → Debe ser `CMP-0001` (iniciando desde 1)
   - Campaña 2 → Debe ser `CMP-0002`

3. **Verifica en BD:**
```bash
# Tenant A
psql -U postgres -d bd_tenant_a -c "SELECT codigo FROM campanas ORDER BY id;"
# Output esperado: CMP-0001, CMP-0002

# Tenant B
psql -U postgres -d bd_tenant_b -c "SELECT codigo FROM campanas ORDER BY id;"
# Output esperado: CMP-0001, CMP-0002 (no debe continuar de Tenant A)
```

---

## 📊 VOLÚMENES PERSISTENTES

**Archivos que ahora persisten entre redeploy:**

```yaml
volumes:
  app-logs:      # /app/logs    → Logs de la aplicación
  app-uploads:   # /app/uploads → CSVs subidos por usuarios
  app-data:      # /app/data    → Archivos JSON de backup
  postgres-data: # /var/lib/postgresql/data → Base de datos
```

**Verificación:**
```bash
# Lista de volúmenes en Coolify/server
docker volume list | grep dn-verification

# Inspeccionar volumen de uploads
docker volume inspect dn-verification-uploads
```

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### Problema: "La conexión a BD falla"

**Causa:** Contenedores no están en la misma red
**Solución:**
- Verifica que ambos servicios estén en el mismo proyecto docker-compose
- Verifica que el nombre del contenedor de BD sea `postgres`

### Problema: "Error: relation 'campanas' does not exist"

**Causa:** No ejecutaste `init-tenant-db.sql`
**Solución:**
```bash
psql -U postgres -d <bd_tenant> -f db/init-tenant-db.sql
```

### Problema: "Campañas no migran"

**Causa:** Script no encuentra tenant por email
**Solución:**
- Verifica que el email en `campanas.json` coincida con el email en `tenants`
- Revisa logs del script de migración

### Problema: "Archivos CSV se pierden"

**Causa:** Volúmenes no configurados correctamente
**Solución:**
- Verifica que `docker-compose.yml` tenga los volúmenes configurados
- Recrea los contenedores después de actualizar el compose

---

## 🎯 BENEFICIOS DE ESTA SOLUCIÓN

### Antes:
- ❌ IDs de campañas compartidos globalmente
- ❌ Archivos perdidos en redeploy
- ❌ JSON como almacenamiento (no escalable)
- ❌ Sin aislamiento real de datos

### Después:
- ✅ Cada tenant con su secuencia de campañas (CMP-0001 a CMP-9999)
- ✅ Volúmenes persistentes (uploads, logs, data)
- ✅ PostgreSQL como BD (escalable y robusto)
- ✅ Total aislamiento de datos por tenant
- ✅ Queries SQL optimizadas
- ✅ Health checks automáticos
- ✅ Ready para producción

---

## 📝 CHECKLIST FINAL

- [ ] Ejecutar `init-tenant-db.sql` en cada BD de tenant
- [ ] Migrar campañas con `npm run migrate:campanas`
- [ ] Commit y push de cambios
- [ ] Eliminar servicios actuales en Coolify
- [ ] Crear proyecto con docker-compose en Coolify
- [ ] Configurar variables de entorno
- [ ] Verificar despliegue
- [ ] Probar aislamiento de tenants
- [ ] Probar persistencia de archivos
- [ ] Verificar que cada tenant inicie en CMP-0001

---

## 🎉 ¡LISTO!

Tu sistema ahora tiene:
- **Aislamiento completo** de datos por tenant
- **Secuencias independientes** de campañas
- **Persistencia de archivos** entre redeploy
- **Escalabilidad** para agregar más tenants
- **Robustez** de PostgreSQL

Si tienes problemas, revisa los logs en Coolify y verifica que cada paso se haya completado correctamente.
