import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { owners, pets, privacyConsents, tags } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

describe('consentimiento (FR-002)', () => {
  it('sin consentimiento, los endpoints protegidos responden 403 consent_required', async () => {
    const s = await ctx.login('+525520000001', { consent: false });
    const pets = await ctx.app.inject({ method: 'GET', url: '/v1/pets', headers: s.headers });
    expect(pets.statusCode).toBe(403);
    expect(pets.json().error.code).toBe('consent_required');
    const notice = await ctx.app.inject({ method: 'GET', url: '/v1/privacy-notice', headers: s.headers });
    expect(notice.statusCode).toBe(200);
    expect(notice.json()).toMatchObject({ version: 'v1' });
    expect(notice.json().text).toContain('Aviso de privacidad');
  });

  it('POST /me/consent guarda versión y fecha', async () => {
    const s = await ctx.login('+525520000002', { consent: false });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/me/consent',
      headers: s.headers,
      payload: { noticeVersion: 'v1' },
    });
    expect(res.statusCode).toBe(204);
    const [row] = await ctx.db.select().from(privacyConsents).where(eq(privacyConsents.ownerId, s.user.id));
    expect(row).toMatchObject({ noticeVersion: 'v1', revokedAt: null });
    expect(row!.acceptedAt).toBeInstanceOf(Date);
    const pets = await ctx.app.inject({ method: 'GET', url: '/v1/pets', headers: s.headers });
    expect(pets.statusCode).toBe(200);
  });

  it('rechaza una versión distinta del aviso vigente', async () => {
    const s = await ctx.login('+525520000003', { consent: false });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/me/consent',
      headers: s.headers,
      payload: { noticeVersion: 'v0' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /me (WhatsApp, FR-013a)', () => {
  it('activar WhatsApp registra whatsappOptInAt y desactivarlo lo limpia', async () => {
    const s = await ctx.login('+525520000004');
    const on = await ctx.app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: s.headers,
      payload: { whatsappAlertsEnabled: true, displayName: 'Ana' },
    });
    expect(on.statusCode).toBe(200);
    expect(on.json()).toMatchObject({ whatsappAlertsEnabled: true, displayName: 'Ana' });
    let [row] = await ctx.db.select().from(owners).where(eq(owners.id, s.user.id));
    expect(row!.whatsappOptInAt).toBeInstanceOf(Date);
    await ctx.app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: s.headers,
      payload: { whatsappAlertsEnabled: false },
    });
    [row] = await ctx.db.select().from(owners).where(eq(owners.id, s.user.id));
    expect(row!.whatsappOptInAt).toBeNull();
  });

  it('valida displayName de 1 a 60 caracteres', async () => {
    const s = await ctx.login('+525520000005');
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: s.headers,
      payload: { displayName: 'x'.repeat(61) },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /me/export (FR-003a)', () => {
  it('devuelve solo datos del usuario y de sus mascotas', async () => {
    const a = await ctx.login('+525520000006');
    const b = await ctx.login('+525520000007');
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/pets',
      headers: a.headers,
      payload: { name: 'Firulais', species: 'dog' },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/pets',
      headers: b.headers,
      payload: { name: 'Michi', species: 'cat' },
    });
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me/export', headers: a.headers });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.account.phone).toBe('+525520000006');
    expect(data.consents).toHaveLength(1);
    expect(data.pets.map((p: { name: string }) => p.name)).toEqual(['Firulais']);
    expect(JSON.stringify(data)).not.toContain('Michi');
    expect(JSON.stringify(data)).not.toContain('+525520000007');
  });
});

describe('DELETE /me (FR-003)', () => {
  it('responde 202, cierra la sesión y borra los datos personales', async () => {
    const s = await ctx.login('+525520000008');
    const pet = await ctx.app.inject({
      method: 'POST',
      url: '/v1/pets',
      headers: s.headers,
      payload: { name: 'Toby', species: 'dog' },
    });
    const petId = pet.json().id as string;
    await ctx.db.insert(tags).values({ code: 'ABCDEFGH23', petId, status: 'active' });

    const res = await ctx.app.inject({ method: 'DELETE', url: '/v1/me', headers: s.headers });
    expect(res.statusCode).toBe(202);
    expect(ctx.queue.sent.some((j) => j.name === 'delete-account')).toBe(true);

    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: s.headers });
    expect(me.statusCode).toBe(401);
    const [owner] = await ctx.db.select().from(owners).where(eq(owners.id, s.user.id));
    expect(owner!.phoneE164).not.toBe('+525520000008');
    expect(owner!.deletedAt).toBeInstanceOf(Date);
    expect(await ctx.db.select().from(pets).where(eq(pets.id, petId))).toHaveLength(0);
    const [tag] = await ctx.db.select().from(tags).where(eq(tags.code, 'ABCDEFGH23'));
    expect(tag).toMatchObject({ status: 'disabled', petId: null });
    const [consent] = await ctx.db.select().from(privacyConsents).where(eq(privacyConsents.ownerId, s.user.id));
    expect(consent!.revokedAt).toBeInstanceOf(Date);

    // El mismo número puede volver a registrarse como cuenta nueva.
    const again = await ctx.login('+525520000008');
    expect(again.user.id).not.toBe(s.user.id);
  });
});
