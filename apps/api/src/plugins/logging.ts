import type { FastifyServerOptions } from 'fastify';

/**
 * Registro en JSON sin IP ni agente de usuario en ninguna ruta. Esto cubre FR-024a
 * (/public/*), la ingesta y la telemetría: el servidor no necesita esos datos.
 */
export function loggerOptions(level: string): FastifyServerOptions['logger'] {
  return {
    level,
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
    },
  };
}
