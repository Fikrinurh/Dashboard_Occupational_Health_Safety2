import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { env } from './server/config/env';
import { getSystemStatus, initializeDatabaseAdapter } from './server/db/adapter';
import { apiRouter } from './server/routes/api';

async function bootstrap() {
  await initializeDatabaseAdapter();
  const status = getSystemStatus();
  console.log(`[OHS EXPERT] Database mode: ${status.mode} — ${status.message}`);

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRouter);

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[OHS EXPERT] Server listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[OHS EXPERT] Failed to start server:', err);
  process.exit(1);
});
