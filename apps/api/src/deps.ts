import type { TraccarApi } from './adapters/traccar/api-client';
import type { Config } from './config';
import type { Db } from './db/client';
import type { JobQueue } from './jobs/queue';
import type { MessagingProvider } from './messaging';
import type { PushSender } from './services/push';
import type { Storage } from './storage';

/** Dependencias inyectables: en pruebas se reemplazan por versiones en memoria. */
export type Deps = {
  config: Config;
  db: Db;
  messaging: MessagingProvider;
  push: PushSender;
  queue: JobQueue;
  storage: Storage;
  traccar: TraccarApi;
  now: () => Date;
};

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
  }
}
