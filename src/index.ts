import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createDistribuidorRouter } from './routes/distribuidor.routes';
import { createAuthRouter } from './routes/auth.routes';
import { createSuperAdminRouter } from './routes/superadmin.routes';
import { createCampanaRouter } from './routes/campana.routes';
import { createConfigRouter } from './routes/config.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { bootstrapDatabases } from './db/bootstrap';

// Cargar variables de entorno
dotenv.config();

/**
 * Inicializar aplicación Express
 */
function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Servir archivos estáticos
  // Usar process.cwd() para compatibilidad con Coolify y entornos de producción
  const publicPath = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'public')
    : path.join(__dirname, '..', 'public');

  app.use(express.static(publicPath));

  // Logging de requests
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_, res) => {
    res.json({
      exito: true,
      mensaje: 'API DN Verification funcionando correctamente',
      timestamp: new Date().toISOString()
    });
  });

  // Rutas
  app.use('/api/auth', createAuthRouter());
  app.use('/api/superadmin', createSuperAdminRouter());
  app.use('/api/campanas', createCampanaRouter());
  app.use('/api/config', authMiddleware, createConfigRouter());
  app.use('/api', createDistribuidorRouter());

  // Ruta de bienvenida - Landing page
  app.get('/', (_, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // Redirigir /login y /dashboard a sus respectivas páginas
  app.get('/login', (_, res) => {
    res.redirect('/login.html');
  });

  app.get('/dashboard', (_, res) => {
    res.redirect('/dashboard.html');
  });

  // Manejo de errores 404
  app.use((req, res) => {
    res.status(404).json({
      exito: false,
      mensaje: 'Endpoint no encontrado',
      errores: [`No existe la ruta: ${req.method} ${req.path}`]
    });
  });

  // Manejo de errores globales
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Error no manejado:', err);
    res.status(err.status || 500).json({
      exito: false,
      mensaje: err.message || 'Error interno del servidor',
      errores: [err.message || 'Error desconocido']
    });
  });

  return app;
}

/**
 * Iniciar servidor
 */
async function startServer(): Promise<void> {
  await bootstrapDatabases();
  const app = createApp();
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log('');
    console.log('=================================');
    console.log('🚀 API DN Verification iniciada');
    console.log('=================================');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📚 Documentación: http://localhost:${PORT}/`);
    console.log(`💚 Health: http://localhost:${PORT}/api/health`);
    console.log('=================================');
    console.log('');

    // Verificar API Key
    if (!process.env.API_KEY) {
      console.warn('⚠️  ADVERTENCIA: API_KEY no configurada en variables de entorno');
      console.warn('⚠️  Las requests fallarán sin la API Key');
      console.log('');
    }
  });
}

// Iniciar si se ejecuta directamente
if (require.main === module) {
  startServer().catch((error) => {
    console.error('[Server] No se pudo preparar la base de datos:', error);
    process.exit(1);
  });
}

export { createApp, startServer };
