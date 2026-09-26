import type { FastifyInstance } from 'fastify';

import { sendPushJob, sendWhatsappJob } from '../services/notifications';
import { deleteAccount } from './delete-account';

/** Registra los trabajos en la cola (research R6). */
export async function registerJobs(app: FastifyInstance) {
  const { deps } = app;
  await deps.queue.work<{ ownerId: string }>('delete-account', (d) => deleteAccount(deps, d));
  await deps.queue.work('send-push', (d: Parameters<typeof sendPushJob>[1]) => sendPushJob(deps, d));
  await deps.queue.work('send-whatsapp', (d: Parameters<typeof sendWhatsappJob>[1]) => sendWhatsappJob(deps, d));
}
