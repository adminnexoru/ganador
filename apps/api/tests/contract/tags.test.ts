import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { owners, tags } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { addFamily, ownerWithPet } from '../helpers/fixtures';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
  await ctx.db.insert(tags).values([{ code: 'DDDDDDDDD2' }, { code: 'DDDDDDDDD3' }, { code: 'DDDDDDDDD4' }]);
});
afterAll(() => ctx.close());

const activate = (petId: string, headers: Record<string, string>, code: string) =>
  ctx.app.inject({ method: 'POST', url: `/v1/pets/${petId}/tags`, headers, payload: { code } });

describe('placas (FR-019)', () => {
  it('activa una placa inactiva, la lista y la deshabilita', async () => {
    const o = await ownerWithPet(ctx, '+525570000001');
    const res = await activate(o.petId, o.headers, 'dddddddd d2'.replace(' ', ''));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ code: 'DDDDDDDDD2', status: 'active' });

    const list = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${o.petId}/tags`, headers: o.headers });
    expect(list.json()).toHaveLength(1);

    const del = await ctx.app.inject({ method: 'DELETE', url: `/v1/tags/${res.json().id}`, headers: o.headers });
    expect(del.statusCode).toBe(204);
    const [row] = await ctx.db.select().from(tags).where(eq(tags.code, 'DDDDDDDDD2'));
    expect(row).toMatchObject({ status: 'disabled', petId: null });

    // disabled → active
    const again = await activate(o.petId, o.headers, 'DDDDDDDDD2');
    expect(again.statusCode).toBe(201);
  });

  it('404 si el código no existe; 409 si está activa en otra mascota', async () => {
    const a = await ownerWithPet(ctx, '+525570000002');
    const b = await ownerWithPet(ctx, '+525570000003');
    expect((await activate(a.petId, a.headers, 'ZZZZZZZZZ9')).statusCode).toBe(404);
    expect((await activate(a.petId, a.headers, 'DDDDDDDDD3')).statusCode).toBe(201);
    const res = await activate(b.petId, b.headers, 'DDDDDDDDD3');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('tag_already_active');
  });

  it('409 whatsapp_not_confirmed si el dueño no confirmó WhatsApp', async () => {
    const o = await ownerWithPet(ctx, '+525570000004');
    await ctx.db.update(owners).set({ whatsappConfirmed: false }).where(eq(owners.id, o.user.id));
    const res = await activate(o.petId, o.headers, 'DDDDDDDDD4');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('whatsapp_not_confirmed');
    await ctx.app.inject({ method: 'PATCH', url: '/v1/me', headers: o.headers, payload: { whatsappConfirmed: true } });
    expect((await activate(o.petId, o.headers, 'DDDDDDDDD4')).statusCode).toBe(201);
  });

  it('un familiar recibe 403', async () => {
    const o = await ownerWithPet(ctx, '+525570000005');
    const fam = await addFamily(ctx, o.petId, '+525570000006');
    expect((await activate(o.petId, fam.headers, 'DDDDDDDDD2')).statusCode).toBe(403);
    const pp = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${o.petId}/public-profile`, headers: fam.headers });
    expect(pp.statusCode).toBe(403);
  });
});

describe('configuración de la página pública (FR-021, FR-023)', () => {
  it('lee y actualiza solo showOwnerName, showConditions y showMedications', async () => {
    const o = await ownerWithPet(ctx, '+525570000007');
    const url = `/v1/pets/${o.petId}/public-profile`;
    const get = await ctx.app.inject({ method: 'GET', url, headers: o.headers });
    expect(get.json()).toEqual({ showOwnerName: true, showConditions: false, showMedications: false });
    const put = await ctx.app.inject({
      method: 'PUT',
      url,
      headers: o.headers,
      payload: { showOwnerName: false, showConditions: true, showMedications: true },
    });
    expect(put.json()).toEqual({ showOwnerName: false, showConditions: true, showMedications: true });
    const bad = await ctx.app.inject({
      method: 'PUT',
      url,
      headers: o.headers,
      payload: { showOwnerName: true, showConditions: true, showMedications: true, showWhatsapp: false },
    });
    expect(bad.statusCode).toBe(400);
  });
});
