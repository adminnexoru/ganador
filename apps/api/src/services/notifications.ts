import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import {
  batteryReadings,
  deviceEvents,
  notifications,
  owners,
  petAccess,
  pets,
  pushTokens,
  safeZones,
} from '../db/schema';
import type { Deps } from '../deps';
import { formatTime, t } from '../i18n';

type Params = Record<string, string | number>;
type SendJob = { notificationId: string; params: Params };

/**
 * Despacha un evento (FR-013a, FR-024): push a cada destinatario y, solo para zone_exit,
 * WhatsApp a quienes lo aceptaron expresamente. Cada envío es un trabajo independiente,
 * así una falla de WhatsApp no afecta al push.
 */
export async function dispatchEvent(deps: Deps, eventId: string, extra: Params = {}) {
  const [event] = await deps.db.select().from(deviceEvents).where(eq(deviceEvents.id, eventId));
  if (!event) return;
  const [pet] = await deps.db.select().from(pets).where(eq(pets.id, event.petId));
  if (!pet) return;

  const params: Params = { pet: pet.name, time: formatTime(event.occurredAt), ...extra };
  if (event.zoneId) {
    const [zone] = await deps.db.select().from(safeZones).where(eq(safeZones.id, event.zoneId));
    params.zone = zone?.name ?? '';
  }
  if (event.type === 'battery_low' && event.deviceId) {
    const [reading] = await deps.db
      .select({ level: batteryReadings.levelPct })
      .from(batteryReadings)
      .where(eq(batteryReadings.deviceId, event.deviceId))
      .orderBy(desc(batteryReadings.recordedAt))
      .limit(1);
    params.level = reading?.level ?? '';
  }

  // Consultas a la placa: solo el dueño (FR-024). Lo demás: dueño y familiares activos.
  const roles = event.type === 'tag_viewed' ? (['owner'] as const) : (['owner', 'family'] as const);
  const recipients = await deps.db
    .select({ id: owners.id, whatsappOptInAt: owners.whatsappOptInAt, enabled: owners.whatsappAlertsEnabled })
    .from(petAccess)
    .innerJoin(owners, eq(owners.id, petAccess.ownerId))
    .where(
      and(
        eq(petAccess.petId, pet.id),
        eq(petAccess.status, 'active'),
        inArray(petAccess.role, [...roles]),
      ),
    );

  for (const r of recipients) {
    const [push] = await deps.db
      .insert(notifications)
      .values({ eventId, recipientId: r.id, channel: 'push' })
      .returning({ id: notifications.id });
    await deps.queue.send<SendJob>('send-push', { notificationId: push!.id, params });

    if (event.type === 'zone_exit' && r.enabled && r.whatsappOptInAt) {
      const [wa] = await deps.db
        .insert(notifications)
        .values({ eventId, recipientId: r.id, channel: 'whatsapp' })
        .returning({ id: notifications.id });
      await deps.queue.send<SendJob>('send-whatsapp', { notificationId: wa!.id, params });
    }
  }
}

async function loadNotification(deps: Deps, id: string) {
  const [row] = await deps.db
    .select({ n: notifications, type: deviceEvents.type, petId: deviceEvents.petId, locale: owners.locale, phone: owners.phoneE164 })
    .from(notifications)
    .innerJoin(deviceEvents, eq(deviceEvents.id, notifications.eventId))
    .innerJoin(owners, eq(owners.id, notifications.recipientId))
    .where(eq(notifications.id, id));
  return row;
}

async function markStatus(deps: Deps, id: string, ok: boolean) {
  await deps.db
    .update(notifications)
    .set({ status: ok ? 'sent' : 'failed', sentAt: ok ? deps.now() : null })
    .where(eq(notifications.id, id));
}

export async function sendPushJob(deps: Deps, { notificationId, params }: SendJob) {
  const row = await loadNotification(deps, notificationId);
  if (!row) return;
  const tokens = await deps.db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(and(eq(pushTokens.ownerId, row.n.recipientId), isNotNull(pushTokens.token)));
  if (tokens.length === 0) return markStatus(deps, notificationId, false);
  const results = await deps.push.send(
    tokens.map(({ token }) => ({
      to: token,
      title: t(`push.${row.type}.title`, params, row.locale),
      body: t(`push.${row.type}.body`, params, row.locale),
      data: { type: row.type, petId: row.petId, eventId: row.n.eventId },
    })),
  );
  const invalid = results.filter((r) => r.invalidToken).map((r) => r.token);
  if (invalid.length > 0) await deps.db.delete(pushTokens).where(inArray(pushTokens.token, invalid));
  await markStatus(deps, notificationId, results.some((r) => r.ok));
}

export async function sendWhatsappJob(deps: Deps, { notificationId, params }: SendJob) {
  const row = await loadNotification(deps, notificationId);
  if (!row) return;
  try {
    await deps.messaging.sendZoneExitAlert(row.phone, {
      petName: String(params.pet),
      zoneName: String(params.zone ?? ''),
      time: String(params.time),
    });
    await markStatus(deps, notificationId, true);
  } catch (err) {
    await markStatus(deps, notificationId, false);
    throw err;
  }
}
