import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { deviceEvents } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { addFamily, linkDevice, ownerWithPet } from '../helpers/fixtures';
import osmand from '../fixtures/traccar/osmand-position.json';

let ctx: TestContext;
let petId: string;
let t = 0;
const CENTER = { lat: 19.4194, lng: -99.1614 };
const T0 = new Date('2026-09-26T18:00:00Z').getTime();

/** Envía por la ruta de ingesta una posición a `d` metros al norte de la zona. */
async function report(d: number, extra: { battery?: number } = {}) {
  const time = new Date(T0 + ++t * 60_000).toISOString();
  ctx.clock.current = new Date(T0 + t * 60_000 + 2_000);
  const raw = JSON.parse(JSON.stringify(osmand)) as typeof osmand;
  raw.device.uniqueId = 'zona-imei';
  raw.position = {
    ...raw.position,
    fixTime: time,
    deviceTime: time,
    latitude: CENTER.lat + d / 111_195,
    longitude: CENTER.lng,
    speed: 2,
    accuracy: 10,
    attributes: { ...raw.position.attributes, batteryLevel: extra.battery ?? 80 },
  };
  const started = Date.now();
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/ingest/traccar/positions',
    headers: { 'x-ingest-secret': 'ingest-secret' },
    payload: raw,
  });
  expect(res.statusCode).toBe(200);
  return Date.now() - started;
}

const events = (type: string) =>
  ctx.db.select().from(deviceEvents).where(eq(deviceEvents.petId, petId)).then((r) => r.filter((e) => e.type === type));

beforeAll(async () => {
  ctx = await createTestApp();
  const owner = await ownerWithPet(ctx, '+525590000001', { whatsapp: true, petName: 'Firulais' });
  petId = owner.petId;
  await addFamily(ctx, petId, '+525590000002', false);
  await linkDevice(ctx, petId, 'zona-imei', 60);
  await ctx.app.inject({
    method: 'POST',
    url: `/v1/pets/${petId}/zones`,
    headers: owner.headers,
    payload: { name: 'Casa', centerLat: CENTER.lat, centerLng: CENTER.lng, radiusM: 100 },
  });
});
afterAll(() => ctx.close());
beforeEach(() => {
  ctx.push.sent.length = 0;
  ctx.messaging.sent.length = 0;
});

describe('flujo de salida de zona (SC-002, FR-013a)', () => {
  it('una salida genera un solo zone_exit, push a dueño y familiar y WhatsApp a quien lo aceptó', async () => {
    await report(0);
    await report(20);
    await report(160);
    expect(await events('zone_exit')).toHaveLength(0);
    const ms = await report(180);
    expect(ms).toBeLessThan(5000);
    expect(await events('zone_exit')).toHaveLength(1);
    const pushes = ctx.push.sent.filter((m) => m.data.type === 'zone_exit');
    expect(pushes.map((m) => m.to).sort()).toEqual([
      'ExponentPushToken[+525590000001]',
      'ExponentPushToken[+525590000002]',
    ]);
    expect(pushes[0]!.title).toBe('Firulais salió de Casa');
    const wa = ctx.messaging.sent.filter((m) => m.kind === 'zone_exit');
    expect(wa.map((m) => m.to)).toEqual(['+525590000001']);

    await report(300);
    expect(await events('zone_exit')).toHaveLength(1);
  });

  it('al regresar genera zone_enter', async () => {
    await report(10);
    await report(0);
    expect(await events('zone_enter')).toHaveLength(1);
  });

  it('oscilaciones de ±20 m en el borde no generan alertas', async () => {
    for (const d of [80, 120, 80, 120, 80, 120]) await report(d);
    expect(await events('zone_exit')).toHaveLength(1);
    expect(await events('zone_enter')).toHaveLength(1);
  });

  it('si WhatsApp falla, el push se envía igual', async () => {
    ctx.messaging.failing.add('whatsapp');
    await report(0);
    await report(400);
    ctx.messaging.failing.clear();
    expect(await events('zone_exit')).toHaveLength(2);
    expect(ctx.push.sent.filter((m) => m.data.type === 'zone_exit')).toHaveLength(2);
  });

  it('batería baja: una alerta al llegar a ≤ 20 %', async () => {
    await report(400, { battery: 25 });
    await report(400, { battery: 19 });
    await report(400, { battery: 18 });
    expect(await events('battery_low')).toHaveLength(1);
    expect(ctx.push.sent.find((m) => m.data.type === 'battery_low')?.body).toContain('19 %');
  });

  it('pérdida de señal: una alerta por episodio y el reposo no alerta', async () => {
    ctx.clock.advance(7 * 60_000);
    await ctx.queue.run('activity-sweep');
    await ctx.queue.run('activity-sweep');
    expect(await events('signal_lost')).toHaveLength(1);
    await report(400);
    ctx.clock.advance(7 * 60_000);
    await ctx.queue.run('activity-sweep');
    expect(await events('signal_lost')).toHaveLength(2);
  });
});
