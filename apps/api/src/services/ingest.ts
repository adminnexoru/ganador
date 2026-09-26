import {
  applyReport,
  distanceM,
  type ActivityState,
  type Fix,
  type NeutralBattery,
  type NeutralDevice,
  type NeutralDeviceEvent,
  type NeutralPosition,
} from '@ganador/domain';
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm';

import { batteryReadings, devices, positions } from '../db/schema';
import type { Deps } from '../deps';

type DeviceRow = typeof devices.$inferSelect;
type PositionRow = typeof positions.$inferSelect;

const MAX_SPEED_KMH = 250; // filtro de plausibilidad (constitución v1.1.0)
const MAX_FUTURE_MS = 5 * 60 * 1000;

export type RuleEvaluator = (
  deps: Deps,
  device: DeviceRow,
  position: PositionRow | null,
  battery: NeutralBattery | null,
) => Promise<void>;

/** Punto de extensión para las reglas de zonas y batería (US3). */
let evaluateRules: RuleEvaluator = async () => {};
export function setRuleEvaluator(fn: RuleEvaluator) {
  evaluateRules = fn;
}
/** Se llama cuando un dispositivo vuelve a reportar (rearma la alerta de señal, US3). */
let onDeviceReported: (deps: Deps, device: DeviceRow) => Promise<void> = async () => {};
export function setReportHook(fn: typeof onDeviceReported) {
  onDeviceReported = fn;
}

async function findLinkedDevice(deps: Deps, externalId: string) {
  const [row] = await deps.db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.source, 'traccar'),
        eq(devices.externalId, externalId),
        eq(devices.status, 'linked'),
        isNotNull(devices.petId),
      ),
    );
  return row ?? null;
}

async function lastValidPosition(deps: Deps, deviceId: string, before?: Date) {
  const [row] = await deps.db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.deviceId, deviceId),
        eq(positions.valid, true),
        ...(before ? [lt(positions.recordedAt, before)] : []),
      ),
    )
    .orderBy(desc(positions.recordedAt))
    .limit(1);
  return row ?? null;
}

function stateOf(device: DeviceRow, lastFix: PositionRow | null): ActivityState {
  return {
    activity: device.activity,
    since: device.activitySince,
    lastSeenAt: device.lastSeenAt,
    lastFix: lastFix ? { lat: lastFix.lat, lng: lastFix.lng, recordedAt: lastFix.recordedAt } : null,
  };
}

async function saveActivity(deps: Deps, device: DeviceRow, next: ActivityState) {
  const [updated] = await deps.db
    .update(devices)
    .set({ activity: next.activity, activitySince: next.since, lastSeenAt: next.lastSeenAt })
    .where(eq(devices.id, device.id))
    .returning();
  return updated!;
}

/** Descarta datos físicamente imposibles para mitigar suplantaciones. */
function isPlausible(deps: Deps, p: NeutralPosition, previous: PositionRow | null): boolean {
  if (p.recordedAt.getTime() - deps.now().getTime() > MAX_FUTURE_MS) return false;
  if (!previous || !p.valid) return true;
  const hours = Math.abs(p.recordedAt.getTime() - previous.recordedAt.getTime()) / 3_600_000;
  const km = distanceM(previous, p) / 1000;
  return hours === 0 ? km < 0.1 : km / hours <= MAX_SPEED_KMH;
}

async function ingestPosition(deps: Deps, device: DeviceRow, p: NeutralPosition, battery: NeutralBattery | null) {
  const previous = await lastValidPosition(deps, device.id);
  if (!isPlausible(deps, p, previous)) {
    deps.log?.warn({ deviceId: device.id, recordedAt: p.recordedAt }, 'posición descartada por plausibilidad');
    return;
  }
  const [inserted] = await deps.db
    .insert(positions)
    .values({
      deviceId: device.id,
      recordedAt: p.recordedAt,
      receivedAt: deps.now(),
      lat: p.lat,
      lng: p.lng,
      accuracyM: p.accuracyM,
      speedKmh: p.speedKmh,
      valid: p.valid,
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted) return; // duplicado
  if (battery) {
    await deps.db.insert(batteryReadings).values({
      deviceId: device.id,
      recordedAt: battery.recordedAt,
      levelPct: battery.levelPct,
      charging: battery.charging,
    });
  }
  const priorFix = await lastValidPosition(deps, device.id, p.recordedAt);
  const fix: Fix = { lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, speedKmh: p.speedKmh, valid: p.valid };
  const wasNoSignal = device.activity === 'no_signal';
  const updated = await saveActivity(deps, device, applyReport(stateOf(device, priorFix), { at: p.recordedAt, fix }));
  if (wasNoSignal || updated.lastSeenAt?.getTime() !== device.lastSeenAt?.getTime()) {
    await onDeviceReported(deps, updated);
  }
  await evaluateRules(deps, updated, inserted.valid ? inserted : null, battery);
}

async function ingestHeartbeat(deps: Deps, device: DeviceRow, at: Date) {
  if (at.getTime() - deps.now().getTime() > MAX_FUTURE_MS) return;
  const state = stateOf(device, null);
  const next = applyReport(state, { at });
  if (next === state) return; // repetido o más antiguo que el último reporte
  const updated = await saveActivity(deps, device, next);
  await onDeviceReported(deps, updated);
}

/** Pipeline de contracts/device-ingest.md, pasos 1–5. */
export async function ingest(deps: Deps, events: NeutralDeviceEvent[], described?: NeutralDevice) {
  for (const event of events) {
    const ref = event.kind === 'position' ? event.position.device : event.device;
    let device = await findLinkedDevice(deps, ref.externalId);
    if (!device) continue;
    if (described && (device.profile !== described.profile || device.restIntervalS !== described.restIntervalS)) {
      const [updated] = await deps.db
        .update(devices)
        .set({ profile: described.profile, restIntervalS: described.restIntervalS })
        .where(eq(devices.id, device.id))
        .returning();
      device = updated!;
    }
    if (event.kind === 'position') await ingestPosition(deps, device, event.position, event.battery);
    else if (event.kind === 'heartbeat' || event.kind === 'online') await ingestHeartbeat(deps, device, event.at);
  }
}
