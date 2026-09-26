import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { devices, publicProfileSettings, safeZones, tags, tagViews } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { linkDevice, ownerWithPet } from '../helpers/fixtures';

let ctx: TestContext;
let petId: string;
const IP = '203.0.113.77';

async function tagFor(code: string, status: 'inactive' | 'active' | 'disabled', pet: string | null = petId) {
  await ctx.db.insert(tags).values({ code, status, petId: status === 'active' ? pet : null });
}
const view = (code: string, ip = IP) =>
  ctx.app.inject({ method: 'GET', url: `/public/tags/${code}`, remoteAddress: ip });

beforeAll(async () => {
  ctx = await createTestApp({ captureLogs: true });
  const owner = await ownerWithPet(ctx, '+525560000001', { petName: 'Firulais' });
  petId = owner.petId;
  await ctx.app.inject({ method: 'PATCH', url: '/v1/me', headers: owner.headers, payload: { displayName: 'Ana' } });
  await ctx.app.inject({
    method: 'PATCH',
    url: `/v1/pets/${petId}`,
    headers: owner.headers,
    payload: { conditions: 'Epilepsia', medications: 'Fenobarbital' },
  });
  await linkDevice(ctx, petId, 'imei-publico');
  await ctx.db.insert(safeZones).values({ petId, name: 'Casa', centerLat: 19.4, centerLng: -99.1, radiusM: 100 });
  await tagFor('AAAAAAAAA2', 'active');
  await tagFor('AAAAAAAAA3', 'inactive');
  await tagFor('AAAAAAAAA4', 'disabled');
});
afterAll(() => ctx.close());

describe('GET /public/tags/{code} (contracts/public-api.md)', () => {
  it('placa activa: foto, nombre y whatsappUrl siempre; datos de salud ocultos por defecto', async () => {
    const res = await view('AAAAAAAAA2');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = res.json();
    expect(body).toEqual({
      status: 'active',
      pet: { name: 'Firulais', species: 'dog', photoUrl: null },
      owner: {
        name: 'Ana',
        whatsappUrl: expect.stringMatching(/^https:\/\/wa\.me\/525560000001\?text=.*Firulais/),
      },
    });
    expect(body.owner).not.toHaveProperty('phone');
    expect(body).not.toHaveProperty('health');
  });

  it('solo incluye los datos autorizados y los no autorizados se omiten', async () => {
    await ctx.db
      .update(publicProfileSettings)
      .set({ showOwnerName: false, showConditions: true, showMedications: false })
      .where(eq(publicProfileSettings.petId, petId));
    const body = (await view('AAAAAAAAA2')).json();
    expect(body.owner).toEqual({ whatsappUrl: expect.any(String) });
    expect(body.health).toEqual({ conditions: 'Epilepsia' });
  });

  it('nunca incluye dirección, zonas, ubicación del rastreador ni IDs internos', async () => {
    const text = (await view('AAAAAAAAA2')).body;
    const [dev] = await ctx.db.select().from(devices).where(eq(devices.petId, petId));
    for (const forbidden of [petId, dev!.id, 'Casa', 'centerLat', 'lat', 'lng', 'zone', 'address', 'direccion']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('placa inactiva o deshabilitada: { status: "inactive" } sin TagView', async () => {
    for (const code of ['AAAAAAAAA3', 'AAAAAAAAA4']) {
      const res = await view(code);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'inactive' });
    }
    const [inactive] = await ctx.db.select().from(tags).where(eq(tags.code, 'AAAAAAAAA3'));
    expect(await ctx.db.select().from(tagViews).where(eq(tagViews.tagId, inactive!.id))).toHaveLength(0);
  });

  it('código inexistente: 404', async () => {
    expect((await view('ZZZZZZZZZ9')).statusCode).toBe(404);
    expect((await view('no-valido')).statusCode).toBe(404);
  });

  it('registra un TagView por consulta y avisa solo al dueño', async () => {
    const [tag] = await ctx.db.select().from(tags).where(eq(tags.code, 'AAAAAAAAA2'));
    const views = await ctx.db.select().from(tagViews).where(eq(tagViews.tagId, tag!.id));
    expect(views.length).toBeGreaterThan(0);
    expect(Object.keys(views[0]!)).toEqual(['id', 'tagId', 'viewedAt', 'notifiedAt']);
    expect(ctx.push.sent.some((m) => m.data.type === 'tag_viewed')).toBe(true);
  });

  it('31 peticiones al mismo código en un minuto → 429', async () => {
    await tagFor('BBBBBBBBB2', 'active');
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await view('BBBBBBBBB2', `198.51.100.${i}`)).statusCode;
    expect(last).toBe(429);
    ctx.clock.advance(61_000);
    expect((await view('BBBBBBBBB2', '198.51.100.200')).statusCode).toBe(200);
  });

  it('61 peticiones del mismo origen a códigos distintos → 429 con Retry-After', async () => {
    const ip = '192.0.2.10';
    let res;
    for (let i = 0; i < 61; i++) res = await view(`CCCCCCCC${String.fromCharCode(65 + (i % 26))}${2 + (i % 8)}`, ip);
    expect(res!.statusCode).toBe(429);
    expect(Number(res!.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('ni la IP ni su HMAC aparecen en la base de datos ni en los registros', async () => {
    const tables = await ctx.client.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    );
    let all = '';
    for (const { tablename } of tables.rows) {
      const r = await ctx.client.query<{ t: string }>(
        `select coalesce(string_agg(row_to_json(t)::text, ' '), '') as t from "${tablename}" t`,
      );
      all += r.rows[0]!.t;
    }
    const logs = ctx.logs.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    for (const ip of [IP, '192.0.2.10', '198.51.100.1']) {
      expect(all).not.toContain(ip);
      expect(logs).not.toContain(ip);
    }
    expect(logs).not.toMatch(/remoteAddress|user-agent|"ip"/i);
  });
});
