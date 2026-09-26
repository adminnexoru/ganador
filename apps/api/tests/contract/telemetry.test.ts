import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { telemetryTimings } from '../../src/db/schema';
import { percentileFromHistogram } from '../../src/services/timings';
import { createTestApp, type TestContext } from '../helpers/app';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp({ captureLogs: true });
});
afterAll(() => ctx.close());

const send = (payload: unknown, ip = '203.0.113.50', contentType = 'application/json') =>
  ctx.app.inject({
    method: 'POST',
    url: '/v1/telemetry/timings',
    remoteAddress: ip,
    headers: { 'content-type': contentType },
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });

describe('POST /v1/telemetry/timings (research R17)', () => {
  it('guarda un conteo por rango sin identificadores', async () => {
    expect((await send({ metric: 'owner_map_visible', ms: 1800, platform: 'android' })).statusCode).toBe(204);
    expect((await send({ metric: 'owner_map_visible', ms: 1900, platform: 'android' })).statusCode).toBe(204);
    const rows = await ctx.db.select().from(telemetryTimings);
    expect(rows).toEqual([
      { day: '2026-09-26', metric: 'owner_map_visible', platform: 'android', bucketMs: 2000, count: 2 },
    ]);
  });

  it('acepta texto plano (sendBeacon) desde la página pública', async () => {
    const res = await send(JSON.stringify({ metric: 'public_contact_visible', ms: 900, platform: 'web' }), '203.0.113.51', 'text/plain');
    expect(res.statusCode).toBe(204);
  });

  it('rechaza métricas o valores inválidos', async () => {
    expect((await send({ metric: 'otra', ms: 1, platform: 'web' })).statusCode).toBe(400);
    expect((await send({ metric: 'owner_map_visible', ms: -1, platform: 'web' })).statusCode).toBe(400);
    expect((await send({ metric: 'owner_map_visible', ms: 10, platform: 'web', userId: 'x' })).statusCode).toBe(204);
  });

  it('límite de 60 por minuto por origen y sin IP en registros ni datos', async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await send({ metric: 'owner_map_visible', ms: 100, platform: 'ios' }, '192.0.2.99')).statusCode;
    expect(last).toBe(429);
    const all = JSON.stringify(await ctx.db.select().from(telemetryTimings));
    expect(all).not.toContain('192.0.2.99');
    expect(ctx.logs.join('\n')).not.toContain('192.0.2.99');
  });

  it('calcula el percentil 95 del histograma', () => {
    const rows = [
      { bucketMs: 1000, count: 90 },
      { bucketMs: 2000, count: 6 },
      { bucketMs: 5000, count: 4 },
    ];
    expect(percentileFromHistogram(rows, 0.95)).toBe(2000);
    expect(percentileFromHistogram([], 0.95)).toBeNull();
  });
});
