import { describe, expect, it } from 'vitest';

import { evaluateBattery } from '../src/alerts/battery';

function run(levels: number[]) {
  let armed = true;
  let alerts = 0;
  for (const level of levels) {
    const r = evaluateBattery(armed, level);
    armed = r.armed;
    if (r.alert) alerts++;
  }
  return { armed, alerts };
}

describe('evaluateBattery (FR-015)', () => {
  it('una alerta al cruzar ≤ 20 %', () => {
    expect(run([50, 21, 20])).toEqual({ armed: false, alerts: 1 });
    expect(run([50, 21])).toEqual({ armed: true, alerts: 0 });
  });

  it('no repite mientras no se recargue', () => {
    expect(run([20, 15, 10, 5]).alerts).toBe(1);
  });

  it('se rearma al superar 25 %', () => {
    expect(run([19, 25]).armed).toBe(false);
    expect(run([19, 26]).armed).toBe(true);
  });

  it('25 → 19 → 18 → 30 → 19 produce exactamente 2 alertas', () => {
    expect(run([25, 19, 18, 30, 19]).alerts).toBe(2);
  });
});
