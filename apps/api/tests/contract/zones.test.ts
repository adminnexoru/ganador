import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestContext } from '../helpers/app';
import { addFamily, ownerWithPet } from '../helpers/fixtures';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

const casa = { name: 'Casa', centerLat: 19.4194, centerLng: -99.1614, radiusM: 100 };

describe('zonas seguras (FR-012)', () => {
  it('crea, lista, edita, desactiva y borra', async () => {
    const o = await ownerWithPet(ctx, '+525580000001');
    const created = await ctx.app.inject({ method: 'POST', url: `/v1/pets/${o.petId}/zones`, headers: o.headers, payload: casa });
    expect(created.statusCode).toBe(201);
    const zone = created.json();
    expect(zone).toMatchObject({ ...casa, active: true });

    const list = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${o.petId}/zones`, headers: o.headers });
    expect(list.json()).toHaveLength(1);

    const patched = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/zones/${zone.id}`,
      headers: o.headers,
      payload: { name: 'Mi casa', radiusM: 150, active: false },
    });
    expect(patched.json()).toMatchObject({ name: 'Mi casa', radiusM: 150, active: false });

    const del = await ctx.app.inject({ method: 'DELETE', url: `/v1/zones/${zone.id}`, headers: o.headers });
    expect(del.statusCode).toBe(204);
    const after = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${o.petId}/zones`, headers: o.headers });
    expect(after.json()).toHaveLength(0);
  });

  it('radiusM fuera de 50–2,000 → 400; nombre de 1 a 40', async () => {
    const o = await ownerWithPet(ctx, '+525580000002');
    for (const payload of [
      { ...casa, radiusM: 49 },
      { ...casa, radiusM: 2001 },
      { ...casa, name: '' },
      { ...casa, name: 'x'.repeat(41) },
      { ...casa, centerLat: 91 },
    ]) {
      const res = await ctx.app.inject({ method: 'POST', url: `/v1/pets/${o.petId}/zones`, headers: o.headers, payload });
      expect(res.statusCode).toBe(400);
    }
  });

  it('un familiar puede listar (200) pero no crear ni editar (403)', async () => {
    const o = await ownerWithPet(ctx, '+525580000003');
    const zone = (
      await ctx.app.inject({ method: 'POST', url: `/v1/pets/${o.petId}/zones`, headers: o.headers, payload: casa })
    ).json();
    const fam = await addFamily(ctx, o.petId, '+525580000004');
    expect((await ctx.app.inject({ method: 'GET', url: `/v1/pets/${o.petId}/zones`, headers: fam.headers })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'POST', url: `/v1/pets/${o.petId}/zones`, headers: fam.headers, payload: casa })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'PATCH', url: `/v1/zones/${zone.id}`, headers: fam.headers, payload: { name: 'X' } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'DELETE', url: `/v1/zones/${zone.id}`, headers: fam.headers })).statusCode).toBe(403);
  });

  it('un extraño recibe 404', async () => {
    const o = await ownerWithPet(ctx, '+525580000005');
    const zone = (
      await ctx.app.inject({ method: 'POST', url: `/v1/pets/${o.petId}/zones`, headers: o.headers, payload: casa })
    ).json();
    const stranger = await ctx.login('+525580000006');
    expect((await ctx.app.inject({ method: 'PATCH', url: `/v1/zones/${zone.id}`, headers: stranger.headers, payload: { name: 'X' } })).statusCode).toBe(404);
  });
});
