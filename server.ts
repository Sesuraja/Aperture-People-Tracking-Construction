import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './src/server/services/db.js';
import { authRouter, bootstrapAdminUser } from './src/server/routes/auth.js';
import { adminRouter } from './src/server/routes/admin.js';
import { rfidRouter } from './src/server/routes/rfid.js';
import { aiRouter } from './src/server/routes/ai.js';
import { dataRouter } from './src/server/routes/data.js';
import { eventsRouter } from './src/server/routes/events.js';
import { errorHandler } from './src/server/middleware/errorHandler.js';

export const app = express();

async function startServer() {
  const PORT = 3000;

  // Initialize DB and bootstrap Admin user if specified
  await initDatabase();
  await bootstrapAdminUser();

  // Helmet HTTP security headers (configured for iframe & SPA compatibility)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false
  }));

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS restriction
  const configuredOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS restrictions'));
    },
    credentials: true
  }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/rfid', rfidRouter);
  app.use('/api', rfidRouter); // Register root alias routes like /api/GetTagsInRealtime
  app.use('/api', aiRouter);
  app.use('/api/data', dataRouter);
  app.use('/api/events', eventsRouter);

  // Centralized Error Handler Middleware
  app.use(errorHandler);

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] GAO People Tracking Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal server startup error:', err);
});
