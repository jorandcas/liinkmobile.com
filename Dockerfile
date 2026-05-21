# ============================================
# DOCKERFILE PARA DN VERIFICATION
# Multi-stage build para optimizar tamaño
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files primero para mejor caché
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm ci

# Copiar resto del código
COPY . .

# Compilar TypeScript
RUN npm run build

# Compilar CSS Tailwind
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

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Cambiar permisos de directorios
RUN chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Variables de entorno
ENV NODE_ENV=production \
    PORT=3000

# Start command
CMD ["node", "dist/index.js"]
