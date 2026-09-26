import type { FastifyRequest } from 'fastify';

/**
 * Registro en JSON sin IP ni agente de usuario en ninguna ruta. Esto cubre FR-024a
 * (/public/*), la ingesta y la telemetría: el servidor no necesita esos datos.
 */
export function loggerOptions(level: string) {
  return {
    level,
    serializers: {
      req(req: FastifyRequest) {
        return { method: req.method, url: req.url };
      },
    },
  };
}
