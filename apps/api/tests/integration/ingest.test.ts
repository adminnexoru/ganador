import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { batteryReadings, devices, positions } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { linkDevice, ownerWithPet } from '../helpers/fixtures';
import osmand from '../fixtures/traccar/osmand-position.json';

let ctx: TestContext;
let deviceId: string;
const secret = { 'x-ingest-secret': 'ingest-secret' };

type Forward = typeof osmand;
function forward(time: string, lat = 19.4326, lng = -99.1332, speedKnots = 0, extra: Partial<Forward['position']> = {}) {
  const raw = JSON.parse(JSON.stringify(osmand)) as Forward;
  raw.position = { ...raw.position, fixTime: time, deviceTime: time, latitude: lat, longitude: lng, speed: speedKnots, ...extra };
  return raw;
}
const post = (payload: object, headers: Record<string, string> = secret) =>
  ctx.app.inject({ method: 'POST', url: '/ingest/traccar/positions', headers, payload });

beforeAll(async () => {
  ctx = await createTestApp();
  const owner = await ownerWithPet(ctx, '+525550000001');
  deviceId = (await linkDevice(ctx, owner.petId, '123456', 60)).id;
  ctx.clock.current = new Date('2026-09-26T18:00:30Z');
});
afterAll(() => ctx.close());

describe('POST /ingest/traccar/positions (contracts/device-ingest.md)', () => {
  it('sin X-Ingest-Secret responde 401', async () => {
    expect((await post(forward('2026-09-26T18:00:00Z'), {})).statusCode).toBe(401);
    expect((await post(forward('2026-09-26T18:00:00Z'), { 'x-ingest-secret': 'mal' })).statusCode).toBe(401);
  });

  it('guarda posición y batería y actualiza lastSeenAt y activity en < 5 s', async () => {
    const started = Date.now();
    const res = await post(forward('2026-09-26T18:00:00Z'));
    expect(Date.now() - started).toBeLessThan(5000);
    expect(res.statusCode).toBe(200);
    const rows = await ctx.db.select().from(positions).where(eq(positions.deviceId, deviceId));
    expect(rows).toHaveLength(1);
    const bats = await ctx.db.select().from(batteryReadings).where(eq(batteryReadings.deviceId, deviceId));
    expect(bats[0]).toMatchObject({ levelPct: 87 });
    const [dev] = await ctx.db.select().from(devices).where(eq(devices.id, deviceId));
    expect(dev!.lastSeenAt).toEqual(new Date('2026-09-26T18:00:00Z'));
    expect(dev!.activity).toBe('resting');
  });

  it('descarta duplicados respondiendo 200', async () => {
    const res = await post(forward('2026-09-26T18:00:00Z'));
    expect(res.statusCode).toBe(200);
    const rows = await ctx.db.select().from(positions).where(eq(positions.deviceId, deviceId));
    expect(rows).toHaveLength(1);
  });

  it('ignora dispositivos desconocidos o no vinculados con 200', async () => {
    const raw = forward('2026-09-26T18:00:10Z');
    raw.device.uniqueId = 'desconocido';
    expect((await post(raw)).statusCode).toBe(200);
    const all = await ctx.db.select().from(positions);
    expect(all).toHaveLength(1);
  });

  it('responde 400 si el cuerpo no es válido', async () => {
    expect((await post({ foo: 'bar' })).statusCode).toBe(400);
  });

  it('marca moving cuando se desplaza', async () => {
    await post(forward('2026-09-26T18:01:00Z', 19.4336, -99.1332, 3));
    const [dev] = await ctx.db.select().from(devices).where(eq(devices.id, deviceId));
    expect(dev!.activity).toBe('moving');
  });

  it('filtro de plausibilidad: descarta velocidad implícita > 250 km/h', async () => {
    // ~111 km en 1 minuto
    const res = await post(forward('2026-09-26T18:02:00Z', 20.4336, -99.1332));
    expect(res.statusCode).toBe(200);
    const rows = await ctx.db.select().from(positions).where(eq(positions.deviceId, deviceId));
    expect(rows.map((r) => r.lat)).not.toContain(20.4336);
  });

  it('filtro de plausibilidad: descarta posiciones más de 5 min en el futuro', async () => {
    const res = await post(forward('2026-09-26T18:30:00Z', 19.4337, -99.1332));
    expect(res.statusCode).toBe(200);
    const rows = await ctx.db.select().from(positions).where(eq(positions.deviceId, deviceId));
    expect(rows.map((r) => r.recordedAt.toISOString())).not.toContain('2026-09-26T18:30:00.000Z');
  });
});

describe('POST /ingest/traccar/events', () => {
  it('acepta deviceOnline y exige el secreto', async () => {
    const payload = {
      event: { id: 1, type: 'deviceOnline', eventTime: '2026-09-26T18:03:00Z', deviceId: 7, attributes: {} },
      device: { id: 7, uniqueId: '123456', name: 'x' },
    };
    expect((await ctx.app.inject({ method: 'POST', url: '/ingest/traccar/events', payload })).statusCode).toBe(401);
    const res = await ctx.app.inject({ method: 'POST', url: '/ingest/traccar/events', headers: secret, payload });
    expect(res.statusCode).toBe(200);
  });
});

describe('sondeo de actividad (latidos sin posición)', () => {
  it('un lastUpdate nuevo en Traccar mantiene al dispositivo en reposo', async () => {
    await ctx.traccar.createDevice('123456', 'x');
    ctx.clock.current = new Date('2026-09-26T18:10:00Z');
    ctx.traccar.touch('123456', new Date('2026-09-26T18:09:30Z'));
    await ctx.queue.run('traccar-poll');
    await ctx.queue.run('activity-sweep');
    const [dev] = await ctx.db.select().from(devices).where(eq(devices.id, deviceId));
    expect(dev!.lastSeenAt).toEqual(new Date('2026-09-26T18:09:30Z'));
    expect(dev!.activity).not.toBe('no_signal');
  });

  it('el barrido marca no_signal al superar el umbral (60 s → 6 min)', async () => {
    ctx.clock.current = new Date('2026-09-26T18:16:00Z');
    await ctx.queue.run('activity-sweep');
    const [dev] = await ctx.db.select().from(devices).where(eq(devices.id, deviceId));
    expect(dev!.activity).toBe('no_signal');
    expect(dev!.activitySince).toEqual(new Date('2026-09-26T18:15:30Z'));
  });
});
