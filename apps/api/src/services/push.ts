export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushResult = { token: string; ok: boolean; invalidToken: boolean };

/** Envío de notificaciones push (research R10). */
export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

/** Servicio push de Expo (entrega por FCM y APNs). */
export class ExpoPushSender implements PushSender {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    if (messages.length === 0) return [];
    const res = await this.fetchFn('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        messages.map((m) => ({ ...m, sound: 'default', priority: 'high', channelId: 'alertas' })),
      ),
    });
    if (!res.ok) throw new Error(`Expo push respondió ${res.status}`);
    const json = (await res.json()) as {
      data: { status: 'ok' | 'error'; details?: { error?: string } }[];
    };
    return json.data.map((ticket, i) => ({
      token: messages[i]!.to,
      ok: ticket.status === 'ok',
      invalidToken: ticket.details?.error === 'DeviceNotRegistered',
    }));
  }
}

export class FakePush implements PushSender {
  readonly sent: PushMessage[] = [];
  invalid = new Set<string>();

  async send(messages: PushMessage[]) {
    this.sent.push(...messages);
    return messages.map((m) => ({
      token: m.to,
      ok: !this.invalid.has(m.to),
      invalidToken: this.invalid.has(m.to),
    }));
  }
}
