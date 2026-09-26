import { createHmac, randomBytes } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

import { AppError } from '../errors';

type Counter = { count: number; resetAt: number };
type Options = { limit: number; windowMs: number; now: () => number };

/** Contador en memoria por clave con ventana fija (sin persistir ni registrar nada). */
class WindowCounter {
  private counters = new Map<string, Counter>();
  constructor(private readonly opts: Options) {}

  hit(key: string): { allowed: boolean; retryAfterS: number } {
    const now = this.opts.now();
    let c = this.counters.get(key);
    if (!c || c.resetAt <= now) {
      c = { count: 0, resetAt: now + this.opts.windowMs };
      this.counters.set(key, c);
    }
    c.count++;
    if (this.counters.size > 50_000) this.sweep(now);
    return { allowed: c.count <= this.opts.limit, retryAfterS: Math.ceil((c.resetAt - now) / 1000) };
  }

  clear() {
    this.counters.clear();
  }

  keys() {
    return [...this.counters.keys()];
  }

  private sweep(now: number) {
    for (const [k, c] of this.counters) if (c.resetAt <= now) this.counters.delete(k);
  }
}

/**
 * Límite por origen (research R16, FR-024a): la clave es un HMAC de la IP con un secreto que
 * vive solo en memoria y rota cada 24 h. Ni la IP ni el HMAC se guardan ni se registran.
 */
export class OriginLimiter {
  #secret = randomBytes(32);
  #secretCreatedAt: number;
  #counter: WindowCounter;
  readonly #rotateMs: number;
  readonly #now: () => number;

  constructor(opts: Options & { rotateMs: number }) {
    this.#now = opts.now;
    this.#rotateMs = opts.rotateMs;
    this.#secretCreatedAt = opts.now();
    this.#counter = new WindowCounter(opts);
  }

  hit(ip: string) {
    if (this.#now() - this.#secretCreatedAt > this.#rotateMs) {
      this.#secret = randomBytes(32);
      this.#secretCreatedAt = this.#now();
      this.#counter.clear();
    }
    return this.#counter.hit(createHmac('sha256', this.#secret).update(ip).digest('hex'));
  }

  keysForTesting() {
    return this.#counter.keys();
  }

  toJSON() {
    return { type: 'OriginLimiter' };
  }
}

/** Límites de la página pública: 60/min por origen y 30/min por código. */
export function createPublicLimits(now: () => number) {
  const origin = new OriginLimiter({ limit: 60, windowMs: 60_000, rotateMs: 24 * 3600_000, now });
  const perCode = new WindowCounter({ limit: 30, windowMs: 60_000, now });
  const reject = (retryAfterS: number) =>
    new AppError(429, 'rate_limited', {}, { 'Retry-After': String(retryAfterS) });

  return {
    checkOrigin(req: FastifyRequest) {
      const r = origin.hit(req.ip);
      if (!r.allowed) throw reject(r.retryAfterS);
    },
    checkCode(code: string) {
      const r = perCode.hit(code);
      if (!r.allowed) throw reject(r.retryAfterS);
    },
  };
}
