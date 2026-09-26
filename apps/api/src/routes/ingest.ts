import { timingSafeEqual } from 'node:crypto';

import { AdapterError } from '@ganador/domain';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { TraccarAdapter, type TraccarForward } from '../adapters/traccar/adapter';
import { AppError } from '../errors';
import { ingest } from '../services/ingest';

const adapter = new TraccarAdapter();

function checkSecret(app: FastifyInstance, req: FastifyRequest) {
  const given = Buffer.from(String(req.headers['x-ingest-secret'] ?? ''));
  const expected = Buffer.from(app.deps.config.INGEST_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new AppError(401, 'unauthorized');
  }
}

/**
 * Reenvío desde Traccar (contracts/device-ingest.md). Responde 200 también a duplicados y
 * dispositivos desconocidos para que Traccar no reintente; 400 si el cuerpo es inválido.
 */
export async function ingestRoutes(app: FastifyInstance) {
  const handle = async (req: FastifyRequest) => {
    checkSecret(app, req);
    let events;
    let described;
    try {
      events = adapter.parse(req.body as TraccarForward);
      described = (req.body as TraccarForward).position ? adapter.describe(req.body as TraccarForward) : undefined;
    } catch (e) {
      if (e instanceof AdapterError) throw new AppError(400, 'validation_error');
      throw e;
    }
    await ingest(app.deps, events, described);
    return { ok: true };
  };
  app.post('/traccar/positions', handle);
  app.post('/traccar/events', handle);
}
