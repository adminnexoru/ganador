// Genera un lote de placas inactivas y un CSV con código y URL para grabar el NFC (registro
// NDEF de tipo URL) e imprimir el QR (research R4).
//
//   DATABASE_URL=postgres://... pnpm --filter tags generate --count 100 --out lote-001.csv
//
// El dominio de las placas es ganador.nexoru.ai (temporal). La URL queda grabada para
// siempre: antes de producir lotes grandes revisa research R4.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { generateTagCode, tagUrl } from '../../apps/api/src/services/tag-codes';

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '10' },
    out: { type: 'string', default: 'placas.csv' },
    base: { type: 'string', default: process.env.PUBLIC_WEB_URL ?? 'https://ganador.nexoru.ai' },
  },
});

const count = Number(values.count);
if (!Number.isInteger(count) || count < 1 || count > 10_000) {
  console.error('--count debe estar entre 1 y 10000');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const created: string[] = [];
try {
  while (created.length < count) {
    const code = generateTagCode();
    const rows = await sql`insert into tags (code, status) values (${code}, 'inactive')
      on conflict (code) do nothing returning code`;
    if (rows.length > 0) created.push(code);
  }
} finally {
  await sql.end();
}

const lines = ['codigo,url', ...created.map((c) => `${c},${tagUrl(values.base!, c)}`)];
writeFileSync(values.out!, `${lines.join('\n')}\n`);
console.log(`${created.length} placas creadas → ${values.out}`);
