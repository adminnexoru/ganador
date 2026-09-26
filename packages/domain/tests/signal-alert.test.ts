import { describe, expect, it } from 'vitest';

import { evaluateSignal } from '../src/alerts/signal';
import type { Activity } from '../src/device/model';

function run(steps: (Activity | null)[]) {
  let armed = true;
  let prev: Activity | null = null;
  let alerts = 0;
  for (const next of steps) {
    const r = evaluateSignal(armed, prev, next);
    armed = r.armed;
    if (r.alert) alerts++;
    prev = next;
  }
  return { armed, alerts };
}

describe('evaluateSignal (FR-016)', () => {
  it('una alerta signal_lost por episodio al pasar a no_signal', () => {
    expect(run(['resting', 'no_signal'])).toEqual({ armed: false, alerts: 1 });
    expect(run(['moving', 'no_signal', 'no_signal']).alerts).toBe(1);
  });

  it('se rearma con el siguiente reporte', () => {
    expect(run(['resting', 'no_signal', 'resting']).armed).toBe(true);
    expect(run(['resting', 'no_signal', 'resting', 'no_signal']).alerts).toBe(2);
  });

  it('resting nunca genera alerta', () => {
    expect(run(['resting', 'resting', 'moving', 'resting']).alerts).toBe(0);
  });
});
