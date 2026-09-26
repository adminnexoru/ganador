import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  INGEST_SECRET: z.string().min(8),
  PUBLIC_WEB_URL: z.string().url().default('https://ganador.nexoru.ai'),
  PRIVACY_NOTICE_VERSION: z.string().default('v1'),

  TRACCAR_URL: z.string().url().default('http://localhost:8082'),
  TRACCAR_USER: z.string().default(''),
  TRACCAR_PASSWORD: z.string().default(''),

  MESSAGING_PROVIDER: z.enum(['fake', 'live']).default('fake'),
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_ID: z.string().default(''),
  WHATSAPP_TEMPLATE_OTP: z.string().default('codigo_acceso'),
  WHATSAPP_TEMPLATE_ZONE_EXIT: z.string().default('alerta_salida_zona'),
  SMS_ACCOUNT_SID: z.string().default(''),
  SMS_AUTH_TOKEN: z.string().default(''),
  SMS_FROM: z.string().default(''),

  S3_ENDPOINT: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  LOCAL_STORAGE_DIR: z.string().default('./.storage'),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Carga y valida la configuración; falla al arrancar si falta una variable requerida. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuración inválida:\n${missing.join('\n')}`);
  }
  return parsed.data;
}
