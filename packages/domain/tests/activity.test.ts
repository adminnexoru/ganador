import { describe, expect, it } from 'vitest';

import {
  applyReport,
  applyTick,
  computeSignalThreshold,
  initialActivityState,
  type ActivityState,
} from '../src/alerts/activity';

const T0 = new Date('2026-09-26T12:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);
const HOME = { lat: 19.4326, lng: -99.1332 };
// ~0.0009° de latitud ≈ 100 m
const fix = (s: number, dLat = 0, extra: Partial<{ accuracyM: number; speedKmh: number; valid: boolean }> = {}) => ({
  at: at(s),
  fix: {
    lat: HOME.lat + dLat,
    lng: HOME.lng,
    accuracyM: extra.accuracyM ?? 10,
    speedKmh: extra.speedKmh ?? 0,
    valid: extra.valid ?? true,
  },
});

describe('computeSignalThreshold (FR-009a)', () => {
  it('suma el intervalo en reposo más max(5 min, la mitad del intervalo)', () => {
    expect(computeSignalThreshold(60)).toBe(360);
    expect(computeSignalThreshold(600)).toBe(900);
    expect(computeSignalThreshold(1800)).toBe(2700);
  });
});

describe('estado de actividad (FR-009)', () => {
  it('el primer reporte sin desplazamiento deja al dispositivo en reposo', () => {
    const s = applyReport(initialActivityState(), fix(0));
    expect(s.activity).toBe('resting');
    expect(s.since).toEqual(at(0));
    expect(s.lastSeenAt).toEqual(at(0));
  });

  it('moving si la velocidad supera 1 km/h', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyReport(s, fix(60, 0, { speedKmh: 4 }));
    expect(s.activity).toBe('moving');
    expect(s.since).toEqual(at(60));
  });

  it('moving si se desplaza más de max(30 m, precisión)', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyReport(s, fix(60, 0.0009)); // ~100 m
    expect(s.activity).toBe('moving');
  });

  it('no se mueve si el desplazamiento cabe en la precisión reportada', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyReport(s, fix(60, 0.0004, { accuracyM: 60 })); // ~45 m con precisión de 60 m
    expect(s.activity).toBe('resting');
  });

  it('vuelve a reposo y since marca el primer reporte del estado actual', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyReport(s, fix(60, 0.0009, { speedKmh: 5 }));
    s = applyReport(s, fix(120, 0.0009));
    expect(s.activity).toBe('resting');
    expect(s.since).toEqual(at(120));
    s = applyReport(s, fix(180, 0.0009));
    expect(s.since).toEqual(at(120));
  });

  it('pasa a no_signal al superar el umbral y since es el momento en que lo superó', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyTick(s, at(899), 600);
    expect(s.activity).toBe('resting');
    s = applyTick(s, at(901), 600);
    expect(s.activity).toBe('no_signal');
    expect(s.since).toEqual(at(900));
  });

  it('un latido sin posición mantiene el reposo y renueva lastSeenAt', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyReport(s, { at: at(600) });
    s = applyTick(s, at(1400), 600);
    expect(s.activity).toBe('resting');
    expect(s.lastSeenAt).toEqual(at(600));
  });

  it('un reporte después de no_signal sale del estado sin señal', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyTick(s, at(1000), 600);
    expect(s.activity).toBe('no_signal');
    s = applyReport(s, { at: at(1100) });
    expect(s.activity).toBe('resting');
    expect(s.since).toEqual(at(1100));
  });

  it('posiciones duplicadas o más antiguas que la última no cambian el estado', () => {
    let s = applyReport(initialActivityState(), fix(100));
    const before: ActivityState = { ...s };
    s = applyReport(s, fix(100, 0.0009, { speedKmh: 20 }));
    expect(s).toEqual(before);
    s = applyReport(s, fix(50, 0.0009, { speedKmh: 20 }));
    expect(s).toEqual(before);
  });

  it('una posición inválida cuenta como actividad pero no como desplazamiento', () => {
    let s = applyReport(initialActivityState(), fix(0));
    s = applyReport(s, fix(60, 0.01, { valid: false, speedKmh: 30 }));
    expect(s.activity).toBe('resting');
    expect(s.lastSeenAt).toEqual(at(60));
    expect(s.lastFix?.lat).toBe(HOME.lat);
  });
});
