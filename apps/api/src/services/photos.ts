import { randomBytes } from 'node:crypto';

import sharp, { type Metadata } from 'sharp';

import type { Deps } from '../deps';
import { AppError } from '../errors';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // ≤ 10 MB
const PUBLIC_MAX_BYTES = 60 * 1024; // versión pública ≤ 60 KB (research R3)
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);

export function photoKeys(petId: string, nonce: string) {
  return {
    original: `pets/${petId}/${nonce}/original.jpg`,
    public: `pets/${petId}/${nonce}/public.webp`,
  };
}

/** Ruta pública (sin autenticación) de la foto reducida. */
export function publicPhotoPath(photoKey: string | null): string | null {
  const m = photoKey?.match(/^pets\/([0-9a-f-]+)\/([A-Za-z0-9_-]+)\/original\.jpg$/);
  return m ? `/public/photos/${m[1]}/${m[2]}.webp` : null;
}

/**
 * Procesa y guarda la foto de una mascota. sharp descarta todos los metadatos (EXIF, XMP,
 * IPTC, incluida la ubicación GPS) al no usar withMetadata(): así la foto no revela el
 * domicilio (FR-022, research R16).
 */
export async function savePetPhoto(deps: Deps, petId: string, input: Buffer): Promise<string> {
  if (input.length > MAX_UPLOAD_BYTES) throw new AppError(400, 'unsupported_image');
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new AppError(400, 'unsupported_image');
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new AppError(400, 'unsupported_image');

  const base = sharp(input).rotate(); // aplica la orientación antes de quitar metadatos
  const original = await base
    .clone()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  let quality = 70;
  let size = 480;
  let pub = await base.clone().resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
  while (pub.length > PUBLIC_MAX_BYTES && (quality > 30 || size > 240)) {
    if (quality > 30) quality -= 10;
    else size -= 80;
    pub = await base.clone().resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
  }

  const keys = photoKeys(petId, randomBytes(9).toString('base64url'));
  await deps.storage.put(keys.original, original, 'image/jpeg');
  await deps.storage.put(keys.public, pub, 'image/webp');
  return keys.original;
}

export async function deletePetPhoto(deps: Deps, photoKey: string | null) {
  if (!photoKey) return;
  await deps.storage.delete(photoKey);
  await deps.storage.delete(photoKey.replace(/original\.jpg$/, 'public.webp'));
}
