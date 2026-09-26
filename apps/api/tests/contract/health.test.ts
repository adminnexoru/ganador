import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestContext } from '../helpers/app';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

describe('GET /health', () => {
  it('200 cuando la base de datos y Traccar responden', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok', traccar: 'ok' });
  });

  it('503 si Traccar no responde', async () => {
    ctx.traccar.healthy = false;
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    ctx.traccar.healthy = true;
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', traccar: 'down' });
  });
});
