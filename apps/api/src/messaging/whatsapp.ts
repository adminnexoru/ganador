import { MessagingError, type ZoneExitAlert } from './provider';

type WhatsAppConfig = {
  token: string;
  phoneId: string;
  otpTemplate: string;
  zoneExitTemplate: string;
};

/** WhatsApp Cloud API de Meta con plantillas aprobadas (research R11). */
export class WhatsAppClient {
  constructor(
    private readonly cfg: WhatsAppConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async send(to: string, template: Record<string, unknown>) {
    const res = await this.fetchFn(`https://graph.facebook.com/v21.0/${this.cfg.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'template',
        template,
      }),
    });
    if (!res.ok) throw new MessagingError(`WhatsApp respondió ${res.status}`, 'whatsapp');
  }

  /** Plantilla de autenticación: el código va en el cuerpo y en el botón de copiar. */
  sendOtp(to: string, code: string) {
    return this.send(to, {
      name: this.cfg.otpTemplate,
      language: { code: 'es_MX' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    });
  }

  /** Plantilla de utilidad: "{{1}} salió de {{2}} a las {{3}}". */
  sendZoneExit(to: string, alert: ZoneExitAlert) {
    return this.send(to, {
      name: this.cfg.zoneExitTemplate,
      language: { code: 'es_MX' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: alert.petName },
            { type: 'text', text: alert.zoneName },
            { type: 'text', text: alert.time },
          ],
        },
      ],
    });
  }
}
