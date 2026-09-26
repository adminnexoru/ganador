// Mide la página pública con Lighthouse (móvil, Slow 4G simulado) contra lighthouserc.json.
// Requiere haber corrido `pnpm export:web` y tener Chrome (CHROME_PATH).
//   pnpm --filter @ganador/mobile lighthouse
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(new URL('../lighthouserc.json', import.meta.url)));
const root = new URL('..', import.meta.url).pathname;
const start = (cmd, args, env) => spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'ignore' });

const api = start('node', ['scripts/fake-public-api.mjs'], { PORT: '4011' });
const web = start('node', ['server/index.mjs'], { PORT: '4010', API_INTERNAL_URL: 'http://localhost:4011' });
await new Promise((r) => setTimeout(r, 1500));

const out = join(mkdtempSync(join(tmpdir(), 'lh-')), 'report.json');
const code = await new Promise((resolve) => {
  const lh = spawn(
    'npx',
    [
      'lighthouse',
      `http://localhost:4010${cfg.url}`,
      '--only-categories=performance',
      '--form-factor=mobile',
      '--throttling-method=simulate',
      '--chrome-flags=--headless=new --no-sandbox',
      '--output=json',
      `--output-path=${out}`,
      '--quiet',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  lh.on('exit', resolve);
});
api.kill();
web.kill();
if (code !== 0) process.exit(1);

const report = JSON.parse(readFileSync(out, 'utf8'));
const items = report.audits['network-requests'].details.items;
const scriptBytes = items.filter((i) => i.resourceType === 'Script').reduce((s, i) => s + i.transferSize, 0);
const totalBytes = items.reduce((s, i) => s + i.transferSize, 0);
const lcp = report.audits['largest-contentful-paint'].numericValue;
const b = cfg.budgets;
const checks = [
  ['JavaScript (bytes)', scriptBytes, b.maxScriptBytes],
  ['Total (bytes)', totalBytes, b.maxTotalBytes],
  ['LCP (ms)', Math.round(lcp), b.maxLargestContentfulPaintMs],
];
let failed = false;
for (const [name, value, max] of checks) {
  const ok = value <= max;
  failed ||= !ok;
  console.log(`${ok ? 'OK ' : 'FALLA'} ${name}: ${value} (máx. ${max})`);
}
process.exit(failed ? 1 : 0);
