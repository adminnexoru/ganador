import { describe, expect, it } from 'vitest';

import { evaluateZone, initialZoneState, type ZoneState } from '../src/geofence/evaluate';

// Zona de 100 m. 1° de latitud ≈ 111,195 m → metros a grados.
const zone = { centerLat: 19.4194, centerLng: -99.1614, radiusM: 100 };
const T0 = new Date('2026-09-26T12:00:00Z').getTime();
let t = 0;
/** Posición a `d` metros al norte del centro. */
const at = (d: number, accuracyM: number | null = 10, time?: number) => ({
  lat: zone.centerLat + d / 111_195,
  lng: zone.centerLng,
  accuracyM,
  recordedAt: new Date(time ?? T0 + ++t * 60_000),
});

function run(distances: number[], state: ZoneState = initialZoneState()) {
  const events: string[] = [];
  for (const d of distances) {
    const r = evaluateZone(zone, state, at(d));
    state = r.state;
    if (r.event) events.push(r.event);
  }
  return { state, events };
}

describe('evaluateZone (FR-013, FR-014)', () => {
  it('el estado inicial unknown no genera alerta', () => {
    expect(run([500])).toEqual({ state: expect.objectContaining({ state: 'outside' }), events: [] });
    expect(run([0]).events).toEqual([]);
  });

  it('salida solo con 2 posiciones consecutivas fuera del margen', () => {
    const { events, state } = run([0, 150]);
    expect(events).toEqual([]);
    expect(state.state).toBe('inside');
    expect(run([0, 150, 160]).events).toEqual(['zone_exit']);
  });

  it('salida inmediata si está a más de 150 m del borde', () => {
    expect(run([0, 300]).events).toEqual(['zone_exit']);
  });

  it('entrada simétrica', () => {
    expect(run([0, 300, 40]).events).toEqual(['zone_exit']);
    expect(run([0, 300, 40, 30]).events).toEqual(['zone_exit', 'zone_enter']);
    expect(run([500, -100]).events).toEqual([]); // unknown → outside sin alerta, luego dentro
    expect(run([0, 400, 0, 0]).events).toEqual(['zone_exit', 'zone_enter']);
  });

  it('posiciones que oscilan ±20 m en el borde no generan eventos', () => {
    expect(run([0, 80, 120, 80, 120, 80, 120, 115, 85]).events).toEqual([]);
  });

  it('una posición dentro de la banda interrumpe las consecutivas', () => {
    expect(run([0, 150, 110, 150]).events).toEqual([]);
  });

  it('el margen crece con la precisión reportada', () => {
    let state = run([0]).state;
    for (const d of [160, 170]) state = evaluateZone(zone, state, at(d, 80)).state;
    expect(state.state).toBe('inside'); // 60–70 m fuera, margen de 80 m
  });

  it('precisión peor que 100 m no cambia el estado', () => {
    let state = run([0]).state;
    for (const d of [500, 600]) {
      const r = evaluateZone(zone, state, at(d, 150));
      expect(r.event).toBeNull();
      expect(r.state).toBe(state);
      state = r.state;
    }
  });

  it('posiciones duplicadas o fuera de orden no cambian el estado', () => {
    const base = run([0, 150]).state;
    const dup = evaluateZone(zone, base, at(400, 10, base.lastAt!.getTime()));
    expect(dup.state).toBe(base);
    const old = evaluateZone(zone, base, at(400, 10, base.lastAt!.getTime() - 60_000));
    expect(old.state).toBe(base);
    expect(old.event).toBeNull();
  });

  it('radio de 50 m y de 2,000 m', () => {
    const small = { ...zone, radiusM: 50 };
    let s = evaluateZone(small, initialZoneState(), at(0)).state;
    const r = evaluateZone(small, s, at(250));
    expect(r.event).toBe('zone_exit');
    const big = { ...zone, radiusM: 2000 };
    s = evaluateZone(big, initialZoneState(), at(0)).state;
    expect(evaluateZone(big, s, at(1500)).event).toBeNull();
  });
});
