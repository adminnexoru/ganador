// Servidor web de producción (web.output: "server"): sirve los archivos estáticos de
// dist/client y delega rutas y rutas de servidor (+api) a expo-server. No registra IP.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createGzip } from 'node:zlib';

import { createRequire } from 'node:module';

// La versión CommonJS del adaptador resuelve en Node sin bundler.
const { createRequestHandler } = createRequire(import.meta.url)('expo-server/adapter/http');

const dist = process.env.DIST_DIR ?? new URL('../dist', import.meta.url).pathname;
const client = join(dist, 'client');
const handle = createRequestHandler({ build: join(dist, 'server') });
const types = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = normalize(join(client, decodeURIComponent(url.pathname)));
  if (file.startsWith(client) && extname(file) && existsSync(file) && statSync(file).isFile()) {
    const gzip = /gzip/.test(req.headers['accept-encoding'] ?? '') && !/\.(png|ico|woff2)$/.test(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': url.pathname.startsWith('/_expo/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    const stream = createReadStream(file);
    (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
    return;
  }
  handle(req, res, (err) => {
    res.statusCode = err ? 500 : 404;
    res.end();
  });
}).listen(Number(process.env.PORT ?? 8081), () => {
  console.log(`web en http://localhost:${process.env.PORT ?? 8081}`);
});
