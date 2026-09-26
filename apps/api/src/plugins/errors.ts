import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { AppError } from '../errors';
import { pickLocale, t } from '../i18n';

/** Respuestas de error { error: { code, message } } con mensaje en el idioma del usuario. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | AppError | ZodError, req, reply) => {
    const locale = pickLocale(req.headers['accept-language']);
    let status = 500;
    let code = 'internal_error';
    let details: unknown;
    if (err instanceof AppError) {
      status = err.statusCode;
      code = err.code;
      for (const [k, v] of Object.entries(err.headers)) void reply.header(k, v);
    } else if (err instanceof ZodError) {
      status = 400;
      code = 'validation_error';
      details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    } else if ((err as FastifyError).statusCode && (err as FastifyError).statusCode! < 500) {
      status = (err as FastifyError).statusCode!;
      code = status === 413 ? 'unsupported_image' : 'validation_error';
    }
    if (status >= 500) req.log.error({ err }, 'error no controlado');
    void reply.status(status).send({
      error: {
        code,
        message: t(`errors.${code}`, err instanceof AppError ? err.params : {}, locale),
        ...(details ? { details } : {}),
      },
    });
  });
  app.setNotFoundHandler((req, reply) => {
    void reply.status(404).send({
      error: { code: 'not_found', message: t('errors.not_found', {}, pickLocale(req.headers['accept-language'])) },
    });
  });
}
