import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pushTokens, safeZones, tags } from '../../src/db/schema';
import { createTestApp, type TestContext } from '../helpers/app';
import { insertEvent, linkDevice, ownerWithPet } from '../helpers/fixtures';
import { dispatchEvent } from '../../src/services/notifications';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

describe('compartir con la familia (FR-017, FR-018)', () => {
  it('invitar, aceptar, permisos de familiar y revocar', async () => {
    const owner = await ownerWithPet(ctx, '+525592000001', { petName: 'Firulais' });
    await linkDevice(ctx, owner.petId, 'fam-imei');
    const [zone] = await ctx.db
      .insert(safeZones)
      .values({ petId: owner.petId, name: 'Casa', centerLat: 19.4, centerLng: -99.1, radiusM: 100 })
      .returning();
    const [tag] = await ctx.db.insert(tags).values({ code: 'FFFFFFFFF2', petId: owner.petId, status: 'active' }).returning();

    // El invitado ya tiene cuenta: recibe un push de invitación.
    const fam = await ctx.login('+525592000002');
    await ctx.db.insert(pushTokens).values({ token: 'ExponentPushToken[fam]', ownerId: fam.user.id, platform: 'ios' });

    const invite = await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${owner.petId}/access`,
      headers: owner.headers,
      payload: { phone: '55 9200 0002' },
    });
    expect(invite.statusCode).toBe(201);
    expect(invite.json()).toMatchObject({ status: 'invited', role: 'family', phone: '+525592000002' });
    expect(ctx.push.sent.some((m) => m.to === 'ExponentPushToken[fam]' && m.data.type === 'invitation')).toBe(true);
    const accessId = invite.json().id as string;

    // Nadie más puede aceptarla.
    const other = await ctx.login('+525592000003');
    const pendingOther = await ctx.app.inject({ method: 'GET', url: '/v1/invitations', headers: other.headers });
    expect(pendingOther.json()).toEqual([]);
    const steal = await ctx.app.inject({ method: 'POST', url: `/v1/invitations/${accessId}/accept`, headers: other.headers });
    expect(steal.statusCode).toBe(404);

    const pending = await ctx.app.inject({ method: 'GET', url: '/v1/invitations', headers: fam.headers });
    expect(pending.json()).toEqual([{ id: accessId, petName: 'Firulais', invitedBy: expect.any(String) }]);
    const accept = await ctx.app.inject({ method: 'POST', url: `/v1/invitations/${accessId}/accept`, headers: fam.headers });
    expect(accept.statusCode).toBe(204);

    const h = fam.headers;
    const id = owner.petId;
    // Endpoints F: 200.
    for (const url of [`/v1/pets/${id}`, `/v1/pets/${id}/location`, `/v1/pets/${id}/track?date=2026-09-26`, `/v1/pets/${id}/zones`]) {
      expect((await ctx.app.inject({ method: 'GET', url, headers: h })).statusCode, url).toBe(200);
    }
    // Endpoints O: 403.
    const ownerOnly: [string, string, object?][] = [
      ['PATCH', `/v1/pets/${id}`, { name: 'X' }],
      ['DELETE', `/v1/pets/${id}`],
      ['POST', `/v1/pets/${id}/zones`, { name: 'X', centerLat: 1, centerLng: 1, radiusM: 100 }],
      ['PATCH', `/v1/zones/${zone!.id}`, { name: 'X' }],
      ['GET', `/v1/pets/${id}/public-profile`],
      ['PUT', `/v1/pets/${id}/public-profile`, { showOwnerName: true, showConditions: true, showMedications: true }],
      ['POST', `/v1/pets/${id}/tags`, { code: 'FFFFFFFFF2' }],
      ['DELETE', `/v1/tags/${tag!.id}`],
      ['POST', `/v1/pets/${id}/device`, { externalId: 'otro' }],
      ['DELETE', `/v1/pets/${id}/device`],
      ['GET', `/v1/pets/${id}/access`],
      ['POST', `/v1/pets/${id}/access`, { phone: '5500000000' }],
    ];
    for (const [method, url, payload] of ownerOnly) {
      const res = await ctx.app.inject({ method: method as 'GET', url, headers: h, payload });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }

    // El familiar recibe alertas.
    ctx.push.sent.length = 0;
    await dispatchEvent(ctx.app.deps, (await insertEvent(ctx, id, 'battery_low')).id);
    expect(ctx.push.sent.map((m) => m.to)).toContain('ExponentPushToken[fam]');

    // Revocar: efecto inmediato.
    const list = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${id}/access`, headers: owner.headers });
    expect(list.json().find((a: { id: string }) => a.id === accessId)).toMatchObject({ status: 'active' });
    const revoke = await ctx.app.inject({ method: 'DELETE', url: `/v1/pets/${id}/access/${accessId}`, headers: owner.headers });
    expect(revoke.statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'GET', url: `/v1/pets/${id}`, headers: h })).statusCode).toBe(404);
    ctx.push.sent.length = 0;
    await dispatchEvent(ctx.app.deps, (await insertEvent(ctx, id, 'battery_low')).id);
    expect(ctx.push.sent.map((m) => m.to)).not.toContain('ExponentPushToken[fam]');
  });

  it('no se puede invitar al propio número ni revocar al dueño', async () => {
    const owner = await ownerWithPet(ctx, '+525592000010');
    const self = await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${owner.petId}/access`,
      headers: owner.headers,
      payload: { phone: '+525592000010' },
    });
    expect(self.statusCode).toBe(400);
    expect(self.json().error.code).toBe('cannot_invite_self');
    const list = await ctx.app.inject({ method: 'GET', url: `/v1/pets/${owner.petId}/access`, headers: owner.headers });
    const own = list.json().find((a: { role: string }) => a.role === 'owner');
    const res = await ctx.app.inject({ method: 'DELETE', url: `/v1/pets/${owner.petId}/access/${own.id}`, headers: owner.headers });
    expect(res.statusCode).toBe(400);
  });

  it('una invitación a un número sin cuenta aparece cuando esa persona se registra', async () => {
    const owner = await ownerWithPet(ctx, '+525592000020', { petName: 'Michi' });
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/pets/${owner.petId}/access`,
      headers: owner.headers,
      payload: { phone: '5592000021' },
    });
    const newcomer = await ctx.login('+525592000021');
    const pending = await ctx.app.inject({ method: 'GET', url: '/v1/invitations', headers: newcomer.headers });
    expect(pending.json()).toHaveLength(1);
    expect(pending.json()[0].petName).toBe('Michi');
  });
});
