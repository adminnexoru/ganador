import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { notifications, safeZones } from '../../src/db/schema';
import { dispatchEvent } from '../../src/services/notifications';
import { createTestApp, type TestContext } from '../helpers/app';
import { addFamily, insertEvent, ownerWithPet } from '../helpers/fixtures';

let ctx: TestContext;
let petId: string;
let zoneId: string;

beforeAll(async () => {
  ctx = await createTestApp();
  const owner = await ownerWithPet(ctx, '+525530000001', { whatsapp: true, petName: 'Firulais' });
  petId = owner.petId;
  await addFamily(ctx, petId, '+525530000002', true);
  await addFamily(ctx, petId, '+525530000003', false);
  const [z] = await ctx.db
    .insert(safeZones)
    .values({ petId, name: 'Casa', centerLat: 19.4, centerLng: -99.1, radiusM: 100 })
    .returning();
  zoneId = z!.id;
});
afterAll(() => ctx.close());
beforeEach(() => {
  ctx.push.sent.length = 0;
  ctx.messaging.sent.length = 0;
});

describe('despachador de notificaciones (FR-013a, FR-024)', () => {
  it('cada evento notifica por push al dueño y a los familiares activos', async () => {
    const e = await insertEvent(ctx, petId, 'battery_low');
    await dispatchEvent(ctx.app.deps, e.id);
    expect(ctx.push.sent.map((m) => m.to).sort()).toEqual([
      'ExponentPushToken[+525530000001]',
      'ExponentPushToken[+525530000002]',
      'ExponentPushToken[+525530000003]',
    ]);
    expect(ctx.push.sent[0]).toMatchObject({ data: { type: 'battery_low', petId, eventId: e.id } });
    expect(ctx.push.sent[0]!.title).toContain('Firulais');
    expect(ctx.messaging.sent.filter((m) => m.kind === 'zone_exit')).toHaveLength(0);
  });

  it('solo zone_exit se envía además por WhatsApp a quienes lo aceptaron', async () => {
    const e = await insertEvent(ctx, petId, 'zone_exit', { zoneId });
    await dispatchEvent(ctx.app.deps, e.id);
    expect(ctx.push.sent).toHaveLength(3);
    const wa = ctx.messaging.sent.filter((m) => m.kind === 'zone_exit');
    expect(wa.map((m) => m.to).sort()).toEqual(['+525530000001', '+525530000002']);
    expect(wa[0]).toMatchObject({ alert: { petName: 'Firulais', zoneName: 'Casa' } });
  });

  it('una falla de WhatsApp no impide el push', async () => {
    ctx.messaging.failing.add('whatsapp');
    const e = await insertEvent(ctx, petId, 'zone_exit', { zoneId });
    await dispatchEvent(ctx.app.deps, e.id);
    ctx.messaging.failing.clear();
    expect(ctx.push.sent).toHaveLength(3);
    const rows = await ctx.db.select().from(notifications).where(eq(notifications.eventId, e.id));
    expect(rows.filter((r) => r.channel === 'push').every((r) => r.status === 'sent')).toBe(true);
    expect(rows.filter((r) => r.channel === 'whatsapp').every((r) => r.status === 'failed')).toBe(true);
  });

  it('sin whatsappOptInAt no se envía WhatsApp', async () => {
    const other = await ownerWithPet(ctx, '+525530000004', { whatsapp: false });
    const [z] = await ctx.db
      .insert(safeZones)
      .values({ petId: other.petId, name: 'Parque', centerLat: 19.4, centerLng: -99.1, radiusM: 100 })
      .returning();
    const e = await insertEvent(ctx, other.petId, 'zone_exit', { zoneId: z!.id });
    await dispatchEvent(ctx.app.deps, e.id);
    expect(ctx.messaging.sent.filter((m) => m.kind === 'zone_exit')).toHaveLength(0);
    expect(ctx.push.sent).toHaveLength(1);
  });

  it('tag_viewed se notifica solo al dueño, nunca a familiares', async () => {
    const e = await insertEvent(ctx, petId, 'tag_viewed');
    await dispatchEvent(ctx.app.deps, e.id, { count: 2 });
    expect(ctx.push.sent.map((m) => m.to)).toEqual(['ExponentPushToken[+525530000001]']);
    expect(ctx.push.sent[0]!.body).toContain('2');
  });

  it('elimina tokens que Expo reporta inválidos', async () => {
    ctx.push.invalid.add('ExponentPushToken[+525530000003]');
    const e = await insertEvent(ctx, petId, 'battery_low');
    await dispatchEvent(ctx.app.deps, e.id);
    ctx.push.invalid.clear();
    ctx.push.sent.length = 0;
    const e2 = await insertEvent(ctx, petId, 'battery_low');
    await dispatchEvent(ctx.app.deps, e2.id);
    expect(ctx.push.sent.map((m) => m.to)).not.toContain('ExponentPushToken[+525530000003]');
  });
});
