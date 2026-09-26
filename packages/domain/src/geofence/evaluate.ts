import { distanceM } from '../geo';

export type ZoneSide = 'inside' | 'outside';
export type ZoneState = {
  state: ZoneSide | 'unknown';
  /** Lado candidato que se está confirmando y cuántas posiciones seguidas lo confirman. */
  pendingState: ZoneSide | null;
  pendingCount: number;
  /** Hora de la última posición evaluada (descarta duplicadas y fuera de orden). */
  lastAt: Date | null;
};
export type ZoneEvent = 'zone_exit' | 'zone_enter';
export type Circle = { centerLat: number; centerLng: number; radiusM: number };
export type ZonePosition = { lat: number; lng: number; accuracyM: number | null; recordedAt: Date };

const MIN_MARGIN_M = 30;
const MAX_ACCURACY_M = 100;
const IMMEDIATE_M = 150;
const CONFIRMATIONS = 2;

export const initialZoneState = (): ZoneState => ({
  state: 'unknown',
  pendingState: null,
  pendingCount: 0,
  lastAt: null,
});

/**
 * Geocerca circular con histéresis (research R8, FR-013, FR-014):
 * - cambia de lado solo si la posición queda más allá de max(30 m, precisión) del borde en
 *   2 posiciones consecutivas, o en 1 si está a más de 150 m;
 * - las posiciones dentro de esa banda no cuentan e interrumpen la confirmación;
 * - precisión peor que 100 m, duplicadas o fuera de orden no cambian el estado;
 * - el primer lado conocido (desde unknown) no genera alerta.
 */
export function evaluateZone(
  zone: Circle,
  state: ZoneState,
  pos: ZonePosition,
): { state: ZoneState; event: ZoneEvent | null } {
  const unchanged = { state, event: null };
  if (state.lastAt && pos.recordedAt.getTime() <= state.lastAt.getTime()) return unchanged;
  if (pos.accuracyM !== null && pos.accuracyM > MAX_ACCURACY_M) return unchanged;

  const fromEdge = distanceM({ lat: zone.centerLat, lng: zone.centerLng }, pos) - zone.radiusM;
  const margin = Math.max(MIN_MARGIN_M, pos.accuracyM ?? 0);
  const base = { ...state, lastAt: pos.recordedAt };

  let side: ZoneSide | null = null;
  if (fromEdge > margin) side = 'outside';
  else if (fromEdge < -margin) side = 'inside';
  if (!side) return { state: { ...base, pendingState: null, pendingCount: 0 }, event: null };

  if (state.state === 'unknown') {
    return { state: { ...base, state: side, pendingState: null, pendingCount: 0 }, event: null };
  }
  if (side === state.state) return { state: { ...base, pendingState: null, pendingCount: 0 }, event: null };

  const count = state.pendingState === side ? state.pendingCount + 1 : 1;
  if (Math.abs(fromEdge) > IMMEDIATE_M || count >= CONFIRMATIONS) {
    return {
      state: { ...base, state: side, pendingState: null, pendingCount: 0 },
      event: side === 'outside' ? 'zone_exit' : 'zone_enter',
    };
  }
  return { state: { ...base, pendingState: side, pendingCount: count }, event: null };
}
