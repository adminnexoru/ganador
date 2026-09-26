export const TIMING_BUCKETS_MS = [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 30000, 2147483647];

export const bucketFor = (ms: number) => TIMING_BUCKETS_MS.find((b) => ms <= b)!;

/** Percentil a partir del histograma: devuelve el límite superior del rango que lo contiene. */
export function percentileFromHistogram(rows: { bucketMs: number; count: number }[], p: number): number | null {
  const sorted = [...rows].sort((a, b) => a.bucketMs - b.bucketMs);
  const total = sorted.reduce((s, r) => s + r.count, 0);
  if (total === 0) return null;
  let acc = 0;
  for (const r of sorted) {
    acc += r.count;
    if (acc / total >= p) return r.bucketMs;
  }
  return sorted.at(-1)!.bucketMs;
}
