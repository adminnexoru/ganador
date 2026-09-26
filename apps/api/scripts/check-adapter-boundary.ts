// Principio I: ningún archivo fuera de src/adapters/ usa tipos o formatos de Traccar.
// Solo los archivos de ensamblado (composición) pueden importar el adaptador.
//   pnpm --filter @ganador/api check:adapters
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const domain = new URL('../../../packages/domain/src', import.meta.url).pathname;

// Ensamblado: crean el cliente, reciben el reenvío o sondean Traccar.
const WIRING = new Set(['app.ts', 'deps.ts', 'routes/ingest.ts', 'routes/devices.ts', 'jobs/traccar-poll.ts']);
// Formatos propios de Traccar que solo deben existir dentro del adaptador.
const TRACCAR_FIELDS = /\b(uniqueId|fixTime|deviceTime|serverTime|batteryLevel|tc_positions|forward\.json)\b/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const problems: string[] = [];
for (const file of files(root)) {
  const rel = relative(root, file);
  if (rel.startsWith('adapters/')) continue;
  const src = readFileSync(file, 'utf8');
  if (/from ['"][./]*adapters\//.test(src) && !WIRING.has(rel)) {
    problems.push(`${rel}: importa el adaptador de Traccar fuera del ensamblado`);
  }
  const allowedField = rel === 'jobs/retention.ts' ? /tc_positions/ : null;
  const m = src.match(TRACCAR_FIELDS);
  if (m && !(allowedField && allowedField.test(m[0]))) problems.push(`${rel}: usa el campo de Traccar "${m[0]}"`);
}
for (const file of files(domain)) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(TRACCAR_FIELDS);
  if (m) problems.push(`packages/domain/${relative(domain, file)}: usa el campo de Traccar "${m[0]}"`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Frontera del adaptador OK');
