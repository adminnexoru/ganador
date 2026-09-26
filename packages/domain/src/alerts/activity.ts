import type { Activity } from '../device/model';
import { distanceM } from '../geo';

/** Umbral de señal en segundos: intervalo en reposo + max(5 min, intervalo / 2) (FR-009a). */
export function computeSignalThreshold(restIntervalS: number): number {
  return restIntervalS + Math.max(300, restIntervalS / 2);
}

const MOVING_SPEED_KMH = 1;
const MIN_MOVE_M = 30;

export type Fix = { lat: number; lng: number; accuracyM: number | null; speedKmh: number | null; valid: boolean };

export type ActivityState = {
  activity: Activity | null;
  /** Primer reporte (o momento) del estado actual. */
  since: Date | null;
  /** Última actividad del dispositivo, con o sin posición. */
  lastSeenAt: Date | null;
  /** Última posición válida usada para medir desplazamiento. */
  lastFix: { lat: number; lng: number; recordedAt: Date } | null;
};

export const initialActivityState = (): ActivityState => ({
  activity: null,
  since: null,
  lastSeenAt: null,
  lastFix: null,
});

function withActivity(state: ActivityState, activity: Activity, since: Date): ActivityState {
  return state.activity === activity ? state : { ...state, activity, since };
}

/**
 * Aplica un reporte del dispositivo: posición (`fix`) o latido sin posición. Reportes
 * duplicados o más antiguos que el último no cambian nada (FR-009).
 */
export function applyReport(state: ActivityState, report: { at: Date; fix?: Fix }): ActivityState {
  if (state.lastSeenAt && report.at.getTime() <= state.lastSeenAt.getTime()) return state;
  let next: ActivityState = { ...state, lastSeenAt: report.at };

  const fix = report.fix;
  if (!fix || !fix.valid) {
    // Actividad sin desplazamiento medible: sigue en su estado, o reposo si no lo había.
    if (!next.activity || next.activity === 'no_signal') next = withActivity(next, 'resting', report.at);
    return next;
  }

  let moving = (fix.speedKmh ?? 0) > MOVING_SPEED_KMH;
  if (!moving && state.lastFix) {
    moving = distanceM(state.lastFix, fix) > Math.max(MIN_MOVE_M, fix.accuracyM ?? 0);
  }
  next = withActivity(next, moving ? 'moving' : 'resting', report.at);
  return { ...next, lastFix: { lat: fix.lat, lng: fix.lng, recordedAt: report.at } };
}

/** Pasa a no_signal si el dispositivo superó su umbral sin reportar. */
export function applyTick(state: ActivityState, now: Date, restIntervalS: number): ActivityState {
  if (!state.lastSeenAt || state.activity === 'no_signal') return state;
  const thresholdMs = computeSignalThreshold(restIntervalS) * 1000;
  if (now.getTime() - state.lastSeenAt.getTime() <= thresholdMs) return state;
  return { ...state, activity: 'no_signal', since: new Date(state.lastSeenAt.getTime() + thresholdMs) };
}
