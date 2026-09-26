const LOW_PCT = 20;
const REARM_PCT = 25;

/** Una alerta al llegar a ≤ 20 %; no se repite hasta superar 25 % (FR-015). */
export function evaluateBattery(armed: boolean, levelPct: number): { armed: boolean; alert: boolean } {
  if (armed && levelPct <= LOW_PCT) return { armed: false, alert: true };
  if (!armed && levelPct > REARM_PCT) return { armed: true, alert: false };
  return { armed, alert: false };
}
