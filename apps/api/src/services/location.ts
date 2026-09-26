import { and, desc, eq } from 'drizzle-orm';

import { batteryReadings, devices, positions } from '../db/schema';
import type { Deps } from '../deps';
import { computeSignalThreshold } from '@ganador/domain';

export type LocationView = {
  position: { lat: number; lng: number; accuracyM: number | null; recordedAt: string } | null;
  battery: { levelPct: number; recordedAt: string } | null;
  activity: 'moving' | 'resting' | 'no_signal' | null;
  activitySince: string | null;
  /** Verdadero solo cuando el dispositivo superó su umbral de señal (FR-009). */
  stale: boolean;
};

/** Ubicación, batería y estado de actividad de la mascota (contracts/app-api.md). */
export async function getLocation(deps: Deps, petId: string): Promise<LocationView | null> {
  const [device] = await deps.db
    .select()
    .from(devices)
    .where(and(eq(devices.petId, petId), eq(devices.status, 'linked')));
  if (!device) return null;

  const [pos] = await deps.db
    .select()
    .from(positions)
    .where(and(eq(positions.deviceId, device.id), eq(positions.valid, true)))
    .orderBy(desc(positions.recordedAt))
    .limit(1);
  const [bat] = await deps.db
    .select()
    .from(batteryReadings)
    .where(eq(batteryReadings.deviceId, device.id))
    .orderBy(desc(batteryReadings.recordedAt))
    .limit(1);

  // El barrido marca no_signal cada minuto; aquí se recalcula para no esperar al barrido.
  let activity = device.activity;
  let since = device.activitySince;
  if (device.lastSeenAt) {
    const threshold = computeSignalThreshold(device.restIntervalS) * 1000;
    if (deps.now().getTime() - device.lastSeenAt.getTime() > threshold && activity !== 'no_signal') {
      activity = 'no_signal';
      since = new Date(device.lastSeenAt.getTime() + threshold);
    }
  }

  return {
    position: pos
      ? { lat: pos.lat, lng: pos.lng, accuracyM: pos.accuracyM, recordedAt: pos.recordedAt.toISOString() }
      : null,
    battery: bat ? { levelPct: bat.levelPct, recordedAt: bat.recordedAt.toISOString() } : null,
    activity: activity ?? null,
    activitySince: since?.toISOString() ?? null,
    stale: activity === 'no_signal',
  };
}
