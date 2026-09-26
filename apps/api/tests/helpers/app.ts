import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app';
import type { Config } from '../../src/config';
import type { Db } from '../../src/db/client';
import * as schema from '../../src/db/schema';
import { InlineQueue } from '../../src/jobs/queue';
import { FakeMessaging } from '../../src/messaging/fake';
import { FakePush } from '../../src/services/push';
import { MemoryStorage } from '../../src/storage';
import { FakeTraccarApi } from '../../src/adapters/traccar/api-client';

export const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: 'pglite://memory',
  JWT_SECRET: 'test-secret-que-es-suficientemente-largo',
  INGEST_SECRET: 'ingest-secret',
  PUBLIC_WEB_URL: 'https://ganador.nexoru.ai',
  PRIVACY_NOTICE_VERSION: 'v1',
  TRACCAR_URL: 'http://traccar.test',
  TRACCAR_USER: '',
  TRACCAR_PASSWORD: '',
  MESSAGING_PROVIDER: 'fake',
  WHATSAPP_TOKEN: '',
  WHATSAPP_PHONE_ID: '',
  WHATSAPP_TEMPLATE_OTP: 'codigo_acceso',
  WHATSAPP_TEMPLATE_ZONE_EXIT: 'alerta_salida_zona',
  SMS_ACCOUNT_SID: '',
  SMS_AUTH_TOKEN: '',
  SMS_FROM: '',
  S3_ENDPOINT: '',
  S3_BUCKET: '',
  S3_ACCESS_KEY: '',
  S3_SECRET_KEY: '',
  S3_REGION: 'auto',
  LOCAL_STORAGE_DIR: '',
};

/** Reloj controlable para pruebas de tiempo (códigos, umbrales, retención). */
export class TestClock {
  current = new Date('2026-09-26T18:00:00Z');
  now = () => new Date(this.current);
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export type TestContext = Awaited<ReturnType<typeof createTestApp>>;

export async function createTestApp() {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: 'snake_case' }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
  const messaging = new FakeMessaging();
  const push = new FakePush();
  const queue = new InlineQueue();
  const storage = new MemoryStorage();
  const traccar = new FakeTraccarApi();
  const clock = new TestClock();
  const app: FastifyInstance = await buildApp({
    config: testConfig,
    deps: { db, messaging, push, queue, storage, traccar, now: clock.now },
  });
  await app.ready();

  async function login(phone = '+525512345678', { consent = true } = {}) {
    await app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone } });
    const code = messaging.lastCode(phone)!;
    const res = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone, code } });
    const body = res.json();
    const headers = { authorization: `Bearer ${body.accessToken}` };
    if (consent) {
      await app.inject({
        method: 'POST',
        url: '/v1/me/consent',
        headers,
        payload: { noticeVersion: 'v1' },
      });
    }
    return { ...body, headers } as {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
      headers: { authorization: string };
    };
  }

  return {
    app,
    db,
    client,
    messaging,
    push,
    queue,
    storage,
    traccar,
    clock,
    login,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
}
