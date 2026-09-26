import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { positions } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { addFamily, linkDevice, ownerWithPet } from '../helpers/fixtures';

let ctx: TestContext;
let owner: Awaited<ReturnType<typeof ownerWithPet>>;

beforeAll(async () => {
  ctx = await createTestApp();
  ctx.clock.current = new Date('2026-09-26T18:00:00Z'); // 12:00 en CDMX
  owner = await ownerWithPet(ctx, '+525591000001');
  const device = await linkDevice(ctx, owner.petId, 'track-imei');
  const rows = [
    // 25 de septiembre en CDMX (UTC-6): de 06:00 del 25 a 05:59 del 26 en UTC
    ['2026-09-25T15:00:00Z', 19.41, true],
    ['2026-09-25T14:00:00Z', 19.4, true],
    ['2026-09-26T05:30:00Z', 19.42, true], // 23:30 del 25 en CDMX
    ['2026-09-25T16:00:00Z', 19.43, false], // inválida: no se muestra
    ['2026-09-26T06:30:00Z', 19.44, true], // 00:30 del 26 en CDMX
  ] as const;
  await ctx.db.insert(positions).values(
    rows.map(([t, lat, valid]) => ({ deviceId: device.id, recordedAt: new Date(t), lat, lng: -99.16, valid })),
  );
});
afterAll(() => ctx.close());

const track = (date: string, headers = owner.headers) =>
  ctx.app.inject({ method: 'GET', url: `/v1/pets/${owner.petId}/track?date=${date}`, headers });

describe('GET /pets/{id}/track (FR-010)', () => {
  it('devuelve las posiciones válidas del día en la zona horaria del usuario, en orden', async () => {
    const res = await track('2026-09-25');
    expect(res.statusCode).toBe(200);
    expect(res.json().map((p: { lat: number }) => p.lat)).toEqual([19.4, 19.41, 19.42]);
    expect(res.json()[0]).toEqual({ lat: 19.4, lng: -99.16, recordedAt: '2026-09-25T14:00:00.000Z' });
  });

  it('fecha con más de 7 días o futura → 400', async () => {
    expect((await track('2026-09-19')).statusCode).toBe(400);
    expect((await track('2026-09-19')).json().error.code).toBe('date_out_of_range');
    expect((await track('2026-09-20')).statusCode).toBe(200);
    expect((await track('2026-09-27')).statusCode).toBe(400);
    expect((await track('ayer')).statusCode).toBe(400);
  });

  it('un familiar puede consultarlo (200)', async () => {
    const fam = await addFamily(ctx, owner.petId, '+525591000002');
    expect((await track('2026-09-26', fam.headers)).statusCode).toBe(200);
  });
});
