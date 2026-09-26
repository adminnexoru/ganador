import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { devices } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { addFamily } from '../helpers/fixtures';
import { jpegWithGps, multipartBody } from '../helpers/images';
import osmand from '../fixtures/traccar/osmand-position.json';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

async function newPet(headers: Record<string, string>, payload: object = { name: 'Firulais', species: 'dog' }) {
  return ctx.app.inject({ method: 'POST', url: '/v1/pets', headers, payload });
}

describe('mascotas (FR-005)', () => {
  it('crea, lista, edita y elimina con validaciones', async () => {
    const s = await ctx.login('+525540000001');
    const created = await newPet(s.headers, {
      name: 'Firulais',
      species: 'dog',
      breed: 'Mestizo',
      size: 'medium',
      conditions: 'Epilepsia',
      medications: 'Fenobarbital',
    });
    expect(created.statusCode).toBe(201);
    const pet = created.json();
    expect(pet).toMatchObject({ name: 'Firulais', species: 'dog', role: 'owner', photoUrl: null });

    const list = await ctx.app.inject({ method: 'GET', url: '/v1/pets', headers: s.headers });
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].location).toBeNull();

    const patched = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/pets/${pet.id}`,
      headers: s.headers,
      payload: { name: 'Firu', breed: '' },
    });
    expect(patched.json()).toMatchObject({ name: 'Firu', breed: null });

    const del = await ctx.app.inject({ method: 'DELETE', url: `/v1/pets/${pet.id}`, headers: s.headers });
    expect(del.statusCode).toBe(204);
    const gone = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${pet.id}`, headers: s.headers });
    expect(gone.statusCode).toBe(404);
  });

  it('valida nombre de 1 a 40 caracteres y especie perro o gato', async () => {
    const s = await ctx.login('+525540000002');
    expect((await newPet(s.headers, { name: '', species: 'dog' })).statusCode).toBe(400);
    expect((await newPet(s.headers, { name: 'x'.repeat(41), species: 'dog' })).statusCode).toBe(400);
    expect((await newPet(s.headers, { name: 'Piolín', species: 'bird' })).statusCode).toBe(400);
    expect((await newPet(s.headers, { name: 'Ok', species: 'cat', conditions: 'x'.repeat(501) })).statusCode).toBe(400);
  });

  it('un familiar puede ver pero recibe 403 al editar; un extraño recibe 404', async () => {
    const s = await ctx.login('+525540000003');
    const pet = (await newPet(s.headers)).json();
    const fam = await addFamily(ctx, pet.id, '+525540000004');
    const view = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${pet.id}`, headers: fam.headers });
    expect(view.json()).toMatchObject({ role: 'family' });
    const edit = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/pets/${pet.id}`,
      headers: fam.headers,
      payload: { name: 'Otro' },
    });
    expect(edit.statusCode).toBe(403);
    const stranger = await ctx.login('+525540000005');
    const res = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${pet.id}`, headers: stranger.headers });
    expect(res.statusCode).toBe(404);
  });

  it('la foto se guarda sin metadatos (EXIF/GPS) y con versión pública ≤ 60 KB', async () => {
    const s = await ctx.login('+525540000006');
    const pet = (await newPet(s.headers)).json();
    const original = await jpegWithGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const form = multipartBody('file', 'foto.jpg', 'image/jpeg', original);
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/pets/${pet.id}/photo`,
      headers: { ...s.headers, ...form.headers },
      payload: form.payload,
    });
    expect(res.statusCode).toBe(200);
    const photoUrl = res.json().photoUrl as string;
    expect(photoUrl).toMatch(/^\/public\/photos\//);

    const pub = await ctx.app.inject({ method: 'GET', url: photoUrl });
    expect(pub.statusCode).toBe(200);
    expect(pub.rawPayload.length).toBeLessThanOrEqual(60 * 1024);
    for (const obj of ctx.storage.objects.values()) {
      const meta = await sharp(obj.body).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
    }
  });

  it('rechaza archivos que no son imagen', async () => {
    const s = await ctx.login('+525540000007');
    const pet = (await newPet(s.headers)).json();
    const form = multipartBody('file', 'x.txt', 'text/plain', Buffer.from('hola'));
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/pets/${pet.id}/photo`,
      headers: { ...s.headers, ...form.headers },
      payload: form.payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('unsupported_image');
  });
});

describe('rastreador (FR-006)', () => {
  it('vincula, registra en Traccar y rechaza con 409 si está en otra mascota', async () => {
    const a = await ctx.login('+525540000010');
    const b = await ctx.login('+525540000011');
    const petA = (await newPet(a.headers)).json();
    const petB = (await newPet(b.headers)).json();
    const link = await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${petA.id}/device`,
      headers: a.headers,
      payload: { externalId: '864895030000099' },
    });
    expect(link.statusCode).toBe(201);
    expect(ctx.traccar.devices.has('864895030000099')).toBe(true);

    const again = await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${petB.id}/device`,
      headers: b.headers,
      payload: { externalId: '864895030000099' },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('device_already_linked');

    const unlink = await ctx.app.inject({ method: 'DELETE', url: `/v1/pets/${petA.id}/device`, headers: a.headers });
    expect(unlink.statusCode).toBe(204);
    const relink = await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${petB.id}/device`,
      headers: b.headers,
      payload: { externalId: '864895030000099' },
    });
    expect(relink.statusCode).toBe(201);
  });

  it('un familiar no puede vincular (403)', async () => {
    const s = await ctx.login('+525540000012');
    const pet = (await newPet(s.headers)).json();
    const fam = await addFamily(ctx, pet.id, '+525540000013');
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${pet.id}/device`,
      headers: fam.headers,
      payload: { externalId: '111' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /pets/{id}/location (FR-008, FR-009)', () => {
  it('devuelve posición, batería, actividad y stale solo en no_signal', async () => {
    const s = await ctx.login('+525540000020');
    const pet = (await newPet(s.headers)).json();
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${pet.id}/device`,
      headers: s.headers,
      payload: { externalId: '123456' },
    });
    ctx.clock.current = new Date('2026-09-26T18:00:05Z');
    const ingest = await ctx.app.inject({
      method: 'POST',
      url: '/ingest/traccar/positions',
      headers: { 'x-ingest-secret': 'ingest-secret' },
      payload: osmand,
    });
    expect(ingest.statusCode).toBe(200);

    const res = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${pet.id}/location`, headers: s.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      position: { lat: 19.4326, lng: -99.1332, accuracyM: 12.5, recordedAt: '2026-09-26T18:00:00.000Z' },
      battery: { levelPct: 87 },
      activity: 'moving',
      stale: false,
    });

    // Traccar Client: 60 s en reposo → umbral de 6 min.
    const [dev] = await ctx.db.select().from(devices).where(eq(devices.externalId, '123456'));
    expect(dev).toMatchObject({ profile: 'traccar-client', restIntervalS: 60 });
    ctx.clock.advance(7 * 60 * 1000);
    const stale = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${pet.id}/location`, headers: s.headers });
    expect(stale.json()).toMatchObject({ activity: 'no_signal', stale: true });
  });

  it('sin rastreador responde 200 con null', async () => {
    const s = await ctx.login('+525540000021');
    const pet = (await newPet(s.headers)).json();
    const res = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${pet.id}/location`, headers: s.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});
