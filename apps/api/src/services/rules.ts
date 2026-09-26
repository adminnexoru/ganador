import {
  evaluateBattery,
  evaluateSignal,
  evaluateZone,
  initialZoneState,
  type NeutralBattery,
  type ZoneState,
} from '@ganador/domain';
import { and, eq } from 'drizzle-orm';

import { deviceEvents, devices, positions, safeZones, zoneStates } from '../db/schema';
import type { Deps } from '../deps';
import { setSignalLostHook } from '../jobs/activity-sweep';
import { setReportHook, setRuleEvaluator } from './ingest';
import { dispatchEvent } from './notifications';

type DeviceRow = typeof devices.$inferSelect;
type PositionRow = typeof positions.$inferSelect;
type EventType = (typeof deviceEvents.$inferInsert)['type'];

async function emit(
  deps: Deps,
  device: DeviceRow,
  type: EventType,
  occurredAt: Date,
  extra: { zoneId?: string; positionId?: number } = {},
) {
  if (!device.petId) return;
  const [event] = await deps.db
    .insert(deviceEvents)
    .values({ petId: device.petId, deviceId: device.id, type, occurredAt, ...extra })
    .returning({ id: deviceEvents.id });
  await dispatchEvent(deps, event!.id);
}

/** Zonas y batería por cada posición nueva (FR-013, FR-014, FR-015). */
async function evaluateRules(deps: Deps, device: DeviceRow, position: PositionRow | null, battery: NeutralBattery | null) {
  if (position && device.petId) {
    const zones = await deps.db
      .select()
      .from(safeZones)
      .where(and(eq(safeZones.petId, device.petId), eq(safeZones.active, true)));
    for (const zone of zones) {
      const [row] = await deps.db
        .select()
        .from(zoneStates)
        .where(and(eq(zoneStates.zoneId, zone.id), eq(zoneStates.deviceId, device.id)));
      const current: ZoneState = row
        ? { state: row.state, pendingState: row.pendingState === 'unknown' ? null : row.pendingState, pendingCount: row.pendingCount, lastAt: row.lastAt }
        : initialZoneState();
      const { state, event } = evaluateZone(zone, current, position);
      if (state !== current) {
        await deps.db
          .insert(zoneStates)
          .values({ zoneId: zone.id, deviceId: device.id, ...state })
          .onConflictDoUpdate({
            target: [zoneStates.zoneId, zoneStates.deviceId],
            set: { state: state.state, pendingState: state.pendingState, pendingCount: state.pendingCount, lastAt: state.lastAt },
          });
      }
      if (event) await emit(deps, device, event, position.recordedAt, { zoneId: zone.id, positionId: position.id });
    }
  }

  if (battery) {
    const r = evaluateBattery(device.batteryAlertArmed, battery.levelPct);
    if (r.armed !== device.batteryAlertArmed) {
      await deps.db.update(devices).set({ batteryAlertArmed: r.armed }).where(eq(devices.id, device.id));
    }
    if (r.alert) await emit(deps, device, 'battery_low', battery.recordedAt);
  }
}

/** Pérdida de señal: una alerta por episodio; se rearma con el siguiente reporte (FR-016). */
async function onSignalLost(deps: Deps, device: DeviceRow) {
  const r = evaluateSignal(device.signalAlertArmed, 'resting', device.activity);
  if (r.armed !== device.signalAlertArmed) {
    await deps.db.update(devices).set({ signalAlertArmed: r.armed }).where(eq(devices.id, device.id));
  }
  if (r.alert) await emit(deps, device, 'signal_lost', device.activitySince ?? deps.now());
}

async function onReported(deps: Deps, device: DeviceRow) {
  const r = evaluateSignal(device.signalAlertArmed, 'no_signal', device.activity);
  if (r.armed !== device.signalAlertArmed) {
    await deps.db.update(devices).set({ signalAlertArmed: r.armed }).where(eq(devices.id, device.id));
  }
}

/** Conecta las reglas del dominio a la ingesta y al barrido de actividad. */
export function registerRules() {
  setRuleEvaluator(evaluateRules);
  setSignalLostHook(onSignalLost);
  setReportHook(onReported);
}
