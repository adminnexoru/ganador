import { eq } from 'drizzle-orm';

import { deviceEvents, devices, owners, petAccess, pushTokens } from '../../src/db/schema';
import type { TestContext } from './app';

/** Crea un dueño con consentimiento, una mascota y un token push. */
export async function ownerWithPet(
  ctx: TestContext,
  phone: string,
  opts: { whatsapp?: boolean; petName?: string } = {},
) {
  const s = await ctx.login(phone);
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/pets',
    headers: s.headers,
    payload: { name: opts.petName ?? 'Firulais', species: 'dog' },
  });
  const petId = res.json().id as string;
  await ctx.db.insert(pushTokens).values({
    token: `ExponentPushToken[${phone}]`,
    ownerId: s.user.id,
    platform: 'android',
  });
  if (opts.whatsapp) {
    await ctx.app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: s.headers,
      payload: { whatsappAlertsEnabled: true },
    });
  }
  return { ...s, petId };
}

/** Agrega un familiar activo con token push, sin pasar por la invitación. */
export async function addFamily(ctx: TestContext, petId: string, phone: string, whatsapp = false) {
  const s = await ctx.login(phone);
  await ctx.db.insert(petAccess).values({ petId, ownerId: s.user.id, role: 'family', status: 'active' });
  await ctx.db.insert(pushTokens).values({
    token: `ExponentPushToken[${phone}]`,
    ownerId: s.user.id,
    platform: 'ios',
  });
  if (whatsapp) {
    await ctx.db
      .update(owners)
      .set({ whatsappAlertsEnabled: true, whatsappOptInAt: new Date() })
      .where(eq(owners.id, s.user.id));
  }
  return s;
}

export async function linkDevice(ctx: TestContext, petId: string, externalId: string, restIntervalS = 600) {
  const [d] = await ctx.db
    .insert(devices)
    .values({ source: 'traccar', externalId, profile: 'generic-gt06', petId, status: 'linked', restIntervalS })
    .returning();
  return d!;
}

export async function insertEvent(
  ctx: TestContext,
  petId: string,
  type: (typeof deviceEvents.$inferInsert)['type'],
  extra: Partial<typeof deviceEvents.$inferInsert> = {},
) {
  const [e] = await ctx.db
    .insert(deviceEvents)
    .values({ petId, type, occurredAt: ctx.clock.now(), ...extra })
    .returning();
  return e!;
}
