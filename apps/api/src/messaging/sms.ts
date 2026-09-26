import { MessagingError } from './provider';

type SmsConfig = { accountSid: string; authToken: string; from: string };

/** Respaldo por SMS para códigos de acceso (API REST de Twilio). */
export class SmsClient {
  constructor(
    private readonly cfg: SmsConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendOtp(to: string, code: string) {
    const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64');
    const res = await this.fetchFn(
      `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: to,
          From: this.cfg.from,
          Body: `Tu código de Ganador es ${code}. Vence en 10 minutos.`,
        }),
      },
    );
    if (!res.ok) throw new MessagingError(`SMS respondió ${res.status}`, 'sms');
  }
}
