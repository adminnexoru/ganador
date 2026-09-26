import type { FastifyBaseLogger } from 'fastify';

import type { MessagingProvider, OtpChannel, ZoneExitAlert } from './provider';

export type SentMessage =
  | { kind: 'otp'; to: string; code: string; channel: OtpChannel }
  | { kind: 'zone_exit'; to: string; alert: ZoneExitAlert };

/** Proveedor de desarrollo y pruebas: guarda los mensajes y los escribe en el registro. */
export class FakeMessaging implements MessagingProvider {
  readonly sent: SentMessage[] = [];
  /** Canales que fallan a propósito (para probar respaldos). */
  failing = new Set<OtpChannel>();

  constructor(private readonly log?: FastifyBaseLogger) {}

  async sendOtp(to: string, code: string, channel: OtpChannel) {
    if (this.failing.has(channel)) throw new Error(`fake ${channel} failure`);
    this.sent.push({ kind: 'otp', to, code, channel });
    this.log?.info({ channel, code }, 'código de acceso (proveedor falso)');
  }

  async sendZoneExitAlert(to: string, alert: ZoneExitAlert) {
    if (this.failing.has('whatsapp')) throw new Error('fake whatsapp failure');
    this.sent.push({ kind: 'zone_exit', to, alert });
    this.log?.info({ alert }, 'alerta de salida por WhatsApp (proveedor falso)');
  }

  lastCode(to: string): string | undefined {
    const msg = [...this.sent].reverse().find((m) => m.kind === 'otp' && m.to === to);
    return msg?.kind === 'otp' ? msg.code : undefined;
  }
}
