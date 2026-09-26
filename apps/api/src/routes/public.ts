import type { FastifyInstance } from 'fastify';

/** Rutas sin autenticación: fotos públicas y página pública de la placa (contracts/public-api.md). */
export async function publicRoutes(app: FastifyInstance) {
  app.get<{ Params: { petId: string; file: string } }>('/photos/:petId/:file', async (req, reply) => {
    const m = req.params.file.match(/^([A-Za-z0-9_-]+)\.webp$/);
    if (!m) return reply.status(404).send();
    const obj = await app.deps.storage.get(`pets/${req.params.petId}/${m[1]}/public.webp`);
    if (!obj) return reply.status(404).send();
    return reply
      .header('Content-Type', obj.contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(obj.body);
  });
}
