import { describe, expect, it } from 'vitest';

import { OriginLimiter } from '../../src/plugins/public-rate-limit';

describe('OriginLimiter (research R16)', () => {
  const make = () => {
    let now = 1_000_000;
    const limiter = new OriginLimiter({ limit: 3, windowMs: 60_000, rotateMs: 24 * 3600_000, now: () => now });
    return { limiter, advance: (ms: number) => (now += ms) };
  };

  it('permite hasta el límite por minuto y luego pide esperar', () => {
    const { limiter } = make();
    expect(limiter.hit('203.0.113.1').allowed).toBe(true);
    expect(limiter.hit('203.0.113.1').allowed).toBe(true);
    expect(limiter.hit('203.0.113.1').allowed).toBe(true);
    const blocked = limiter.hit('203.0.113.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterS).toBeGreaterThan(0);
    expect(limiter.hit('203.0.113.2').allowed).toBe(true);
  });

  it('los contadores expiran al minuto', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 4; i++) limiter.hit('203.0.113.1');
    advance(60_001);
    expect(limiter.hit('203.0.113.1').allowed).toBe(true);
  });

  it('la clave es un HMAC: la estructura no contiene la IP', () => {
    const { limiter } = make();
    limiter.hit('203.0.113.99');
    const keys = limiter.keysForTesting();
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain('203.0.113.99');
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(limiter)).not.toContain('203.0.113.99');
  });

  it('el secreto rota cada 24 h y la misma IP produce otra clave', () => {
    const { limiter, advance } = make();
    limiter.hit('203.0.113.5');
    const before = limiter.keysForTesting()[0];
    advance(24 * 3600_000 + 1);
    limiter.hit('203.0.113.5');
    const after = limiter.keysForTesting();
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before);
  });
});
