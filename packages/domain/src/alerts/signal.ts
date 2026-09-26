import type { Activity } from '../device/model';

/**
 * Una alerta de pérdida de señal por episodio (FR-016): al pasar a no_signal. Se rearma con el
 * siguiente reporte. El reposo nunca genera alerta.
 */
export function evaluateSignal(
  armed: boolean,
  previous: Activity | null,
  next: Activity | null,
): { armed: boolean; alert: boolean } {
  if (next === 'no_signal') {
    if (armed && previous !== 'no_signal') return { armed: false, alert: true };
    return { armed, alert: false };
  }
  if (!armed && next !== null) return { armed: true, alert: false };
  return { armed, alert: false };
}
