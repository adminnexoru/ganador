// API falsa para medir la página pública con Lighthouse: responde GET /public/tags/:code.
import { createServer } from 'node:http';

const sample = {
  status: 'active',
  pet: { name: 'Firulais', species: 'dog', photoUrl: null },
  owner: { name: 'Ana', whatsappUrl: 'https://wa.me/525512345678?text=Hola' },
  health: { conditions: 'Epilepsia' },
};

createServer((req, res) => {
  if (req.url?.startsWith('/public/tags/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(req.url.endsWith('INACTIVA22') ? { status: 'inactive' } : sample));
  }
  res.writeHead(404);
  res.end();
}).listen(Number(process.env.PORT ?? 4011));
