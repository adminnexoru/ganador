import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';

import { TraccarApiClient } from './adapters/traccar/api-client';
import type { Config } from './config';
import { createDb } from './db/client';
import type { Deps } from './deps';
import { registerJobs } from './jobs';
import { PgBossQueue } from './jobs/queue';
import { createMessaging } from './messaging';
import { registerErrorHandler } from './plugins/errors';
import { loggerOptions } from './plugins/logging';
import { registerRoutes } from './routes';
import { MAX_UPLOAD_BYTES } from './services/photos';
import { ExpoPushSender } from './services/push';
import { createStorage } from './storage';

export async function buildApp({
  config,
  deps: overrides = {},
}: {
  config: Config;
  deps?: Partial<Omit<Deps, 'config'>>;
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : loggerOptions(config.NODE_ENV === 'production' ? 'info' : 'debug'),
    // Detrás de Caddy. La IP solo se usa en memoria para el límite por origen (research R16);
    // nunca se registra ni se guarda.
    trustProxy: true,
  });

  let closeDb: (() => Promise<void>) | undefined;
  let db = overrides.db;
  if (!db) {
    const created = createDb(config.DATABASE_URL);
    db = created.db;
    closeDb = created.close;
  }

  const deps: Deps = {
    config,
    db,
    messaging: overrides.messaging ?? createMessaging(config, app.log),
    push: overrides.push ?? new ExpoPushSender(),
    queue: overrides.queue ?? new PgBossQueue(config.DATABASE_URL),
    storage: overrides.storage ?? createStorage(config),
    traccar:
      overrides.traccar ?? new TraccarApiClient(config.TRACCAR_URL, config.TRACCAR_USER, config.TRACCAR_PASSWORD),
    now: overrides.now ?? (() => new Date()),
    log: app.log,
  };
  app.decorate('deps', deps);

  registerErrorHandler(app);
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await registerRoutes(app);

  await deps.queue.start();
  await registerJobs(app);

  app.addHook('onClose', async () => {
    await deps.queue.stop();
    await closeDb?.();
  });
  return app;
}
