# MIGRACIÓN A DOCKER-COMPOSE EN COOLIFY

## PASOS A SEGUIR EN COOLIFY

### 1. ELIMINAR SERVICIOS ACTUALES

En Coolify:
1. Ve al proyecto "Liinkmobile > production"
2. **Elimina la base de datos** `postgresql-database-g0c48g088sggswwwsgssk8gw`
   - ⚠️ Esto borrará todos los datos - asegúrate de tener backup si es necesario
3. **Elimina la aplicación** `jorandcas/liinkmobile.com:main-w0w4408048gkk8ckw808c8w4`

### 2. COMMITEAR CAMBIOS AL REPOSITORIO

En tu terminal local:
```bash
git add docker-compose.yml
git add .env.example
git commit -m "Add docker-compose for Coolify deployment"
git push
```

### 3. VOLVER A CREAR EL PROYECTO EN COOLIFY

**Opción A: Usar Docker-Compose (RECOMENDADO)**

1. En Coolify, crea un **nuevo proyecto**
2. Selecciona "From Docker Compose"
3. Conecta tu repositorio Git
4. Coolify detectará automáticamente el `docker-compose.yml`
5. Configura las variables de entorno:

**Variables requeridas en Coolify:**
```env
DB_PASSWORD=dUCq4eymvTJDxtQHdqrJXCOqnYl5bUyJFuEXqDV7tyUHz70hUoUiaZTD1Rj4tx5v
ENCRYPTION_KEY=JJsSthsbTusQr9fYlLU6n8/hd7vPDRAmGBd5JWhSrf4=
JWT_SECRET=dn_verification_jwt_secret_2026_muy_seguro_para_produccion
VALIDATION_TEST_PHONE=9233250673
```

**Opción B: Crear desde código fuente**

1. Crea un nuevo recurso "Application"
2. Conecta tu repositorio Git
3. En "Build Settings", selecciona "Docker Compose"
4. Coolify detectará automáticamente el archivo `docker-compose.yml`

### 4. VERIFICAR DESPLIEGUE

Una vez desplegado:

1. Verifica que ambos contenedores estén corriendo
2. La aplicación debería estar en: `https://liinkmobile.com`
3. La base de datos estará conectada internamente como `postgres`

### 5. VERIFICAR CONEXIÓN A BD

En el terminal de la aplicación en Coolify:
```bash
# Debería funcionar sin problemas
node -e "const { Client } = require('pg'); const client = new Client({ host: 'postgres', user: 'postgres', password: 'dUCq4eymvTJDxtQHdqrJXCOqnYl5bUyJFuEXqDV7tyUHz70hUoUiaZTD1Rj4tx5v', database: 'bd_superadmin' }); client.connect().then(() => console.log('✅ Conexión OK')).catch(err => console.error('❌ Error:', err.message)).finally(() => client.end());"
```

## BENEFICIOS DE ESTA CONFIGURACIÓN

✅ **Resolución DNS automática:** `app` conecta a `postgres` por nombre
✅ **Health checks:** La app espera a que postgres esté listo
✅ **Volúmenes persistentes:** Datos de BD guardados permanentemente
✅ **Redes aisladas:** Solo los servicios del proyecto se comunican
✅ **Escalabilidad:** Fácil agregar más servicios en el futuro

## VARIABLES DE ENTORNO

### Locales (development)
```
DB_HOST=localhost
```

### Coolify con Compose (production)
```
DB_HOST=postgres
```

## TROUBLESHOOTING

### Si falla la conexión:
1. Verifica que ambos contenedores estén en la misma red: `dn-verification-network`
2. Verifica las variables de entorno en Coolify
3. Revisa los logs: `docker-compose logs`
