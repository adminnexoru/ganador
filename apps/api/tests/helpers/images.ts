import sharp from 'sharp';

/** JPEG de prueba con metadatos EXIF, incluida una ubicación GPS falsa. */
export async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: '#3a7' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'CamaraPrueba', Model: 'Modelo X' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '19/1 25/1 57/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '99/1 7/1 59/1',
      },
    })
    .toBuffer();
}

export function multipartBody(field: string, filename: string, contentType: string, data: Buffer) {
  const boundary = '----ganadorTestBoundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}
