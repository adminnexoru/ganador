import { randomInt } from 'node:crypto';

/** Base32 sin caracteres ambiguos (sin 0, 1, I, O): 32 símbolos (research R4). */
export const TAG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TAG_CODE_LENGTH = 10; // ≈ 50 bits
const CODE_RE = new RegExp(`^[${TAG_ALPHABET}]{${TAG_CODE_LENGTH}}$`);

/** Código aleatorio criptográfico de 10 caracteres. */
export function generateTagCode(): string {
  let code = '';
  for (let i = 0; i < TAG_CODE_LENGTH; i++) code += TAG_ALPHABET[randomInt(TAG_ALPHABET.length)];
  return code;
}

/** Normaliza lo que escribe o escanea el dueño: mayúsculas, sin espacios ni guiones. */
export function normalizeTagCode(input: string): string | null {
  const fromUrl = input.match(/\/p\/([^/?#\s]+)/)?.[1] ?? input;
  const code = fromUrl.toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}

export const tagUrl = (baseUrl: string, code: string) => `${baseUrl.replace(/\/$/, '')}/p/${code}`;
