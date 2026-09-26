export type OtpChannel = 'whatsapp' | 'sms';

export type ZoneExitAlert = { petName: string; zoneName: string; time: string };

/** Puerto de mensajería (research R11): permite cambiar de proveedor sin tocar servicios. */
export interface MessagingProvider {
  sendOtp(phoneE164: string, code: string, channel: OtpChannel): Promise<void>;
  sendZoneExitAlert(phoneE164: string, alert: ZoneExitAlert): Promise<void>;
}

export class MessagingError extends Error {
  constructor(
    message: string,
    readonly channel: OtpChannel,
  ) {
    super(message);
    this.name = 'MessagingError';
  }
}
