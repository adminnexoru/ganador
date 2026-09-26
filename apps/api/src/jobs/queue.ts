import { PgBoss } from 'pg-boss';

export type JobHandler<T> = (data: T) => Promise<void>;

/** Cola de trabajos (research R6). En producción pg-boss; en pruebas, ejecución directa. */
export interface JobQueue {
  send<T extends object>(name: string, data: T): Promise<void>;
  work<T extends object>(name: string, handler: JobHandler<T>): Promise<void>;
  /** Programa un trabajo con cron (UTC). */
  schedule(name: string, cron: string): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class PgBossQueue implements JobQueue {
  private readonly boss: PgBoss;

  constructor(connectionString: string) {
    this.boss = new PgBoss(connectionString);
  }

  async start() {
    await this.boss.start();
  }

  async stop() {
    await this.boss.stop();
  }

  async send<T extends object>(name: string, data: T) {
    await this.boss.send(name, data);
  }

  async work<T extends object>(name: string, handler: JobHandler<T>) {
    await this.boss.createQueue(name);
    await this.boss.work<T>(name, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
  }

  async schedule(name: string, cron: string) {
    await this.boss.createQueue(name);
    await this.boss.schedule(name, cron, {});
  }
}

/**
 * Ejecuta cada trabajo en cuanto se envía. Útil en pruebas: los efectos son inmediatos y
 * los errores se reportan en `failures` en lugar de romper a quien encola.
 */
export class InlineQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler<object>>();
  readonly sent: { name: string; data: object }[] = [];
  readonly scheduled: { name: string; cron: string }[] = [];
  readonly failures: { name: string; error: unknown }[] = [];

  async start() {}
  async stop() {}

  async send<T extends object>(name: string, data: T) {
    this.sent.push({ name, data });
    const handler = this.handlers.get(name);
    if (!handler) return;
    try {
      await handler(data);
    } catch (error) {
      this.failures.push({ name, error });
    }
  }

  async work<T extends object>(name: string, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler<object>);
  }

  async schedule(name: string, cron: string) {
    this.scheduled.push({ name, cron });
  }

  /** Ejecuta un trabajo programado a mano (p. ej. el barrido de actividad). */
  async run(name: string) {
    await this.handlers.get(name)?.({});
  }
}
