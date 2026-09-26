// Revisa las traducciones (principio IV): falla si en.json tiene claves que no existen en
// es-MX.json o si es-MX.json tiene claves que ningún archivo usa.
//   node scripts/check-i18n.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Dict = { [k: string]: string | Dict };
const root = new URL('..', import.meta.url).pathname;
const load = (f: string) => JSON.parse(readFileSync(join(root, 'src/i18n/locales', f), 'utf8')) as Dict;

function keys(d: Dict, prefix = ''): string[] {
  return Object.entries(d).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`)));
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const base = new Set(keys(load('es-MX.json')));
const en = keys(load('en.json'));
const problems: string[] = [];

for (const k of en) if (!base.has(k)) problems.push(`en.json tiene "${k}", que no existe en es-MX.json`);

const used = new Set<string>();
for (const file of files(join(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/['"`]([a-zA-Z]+(?:\.[a-zA-Z]+)+)['"`]/g)) used.add(m[1]!);
  // La página pública del servidor usa las claves de "public" como propiedades (strings.x).
  for (const m of src.matchAll(/\bstrings\.(\w+)/g)) used.add(`public.${m[1]}`);
  if (src.includes('esMX.privacy.title')) used.add('privacy.title');
}
for (const k of base) if (!used.has(k)) problems.push(`es-MX.json tiene "${k}" sin uso`);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n OK: ${base.size} claves en es-MX, ${en.length} en en`);
