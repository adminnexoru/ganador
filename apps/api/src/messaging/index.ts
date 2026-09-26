import type { FastifyBaseLogger } from 'fastify';

import type { Config } from '../config';
import { FakeMessaging } from './fake';
import type { MessagingProvider, OtpChannel, ZoneExitAlert } from './provider';
import { SmsClient } from './sms';
import { WhatsAppClient } from './whatsapp';

class LiveMessaging implements MessagingProvider {
  constructor(
    private readonly whatsapp: WhatsAppClient,
    private readonly sms: SmsClient,
  ) {}

  sendOtp(to: string, code: string, channel: OtpChannel) {
    return channel === 'whatsapp' ? this.whatsapp.sendOtp(to, code) : this.sms.sendOtp(to, code);
  }

  sendZoneExitAlert(to: string, alert: ZoneExitAlert) {
    return this.whatsapp.sendZoneExit(to, alert);
  }
}

export function createMessaging(config: Config, log?: FastifyBaseLogger): MessagingProvider {
  if (config.MESSAGING_PROVIDER === 'fake') return new FakeMessaging(log);
  return new LiveMessaging(
    new WhatsAppClient({
      token: config.WHATSAPP_TOKEN,
      phoneId: config.WHATSAPP_PHONE_ID,
      otpTemplate: config.WHATSAPP_TEMPLATE_OTP,
      zoneExitTemplate: config.WHATSAPP_TEMPLATE_ZONE_EXIT,
    }),
    new SmsClient({
      accountSid: config.SMS_ACCOUNT_SID,
      authToken: config.SMS_AUTH_TOKEN,
      from: config.SMS_FROM,
    }),
  );
}

export type { MessagingProvider } from './provider';
