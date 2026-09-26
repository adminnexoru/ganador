import type { FastifyInstance } from 'fastify';

import { sendPushJob, sendWhatsappJob } from '../services/notifications';
import { sweepActivity } from './activity-sweep';
import { deleteAccount } from './delete-account';
import { runRetention } from './retention';
import { notifyTagViews, sweepTagViews } from './tag-view-notify';
import { pollTraccarActivity } from './traccar-poll';

/** Registra los trabajos en la cola (research R6). */
export async function registerJobs(app: FastifyInstance) {
  const { deps } = app;
  await deps.queue.work<{ ownerId: string }>('delete-account', (d) => deleteAccount(deps, d));
  await deps.queue.work('send-push', (d: Parameters<typeof sendPushJob>[1]) => sendPushJob(deps, d));
  await deps.queue.work('send-whatsapp', (d: Parameters<typeof sendWhatsappJob>[1]) => sendWhatsappJob(deps, d));

  await deps.queue.work<{ tagId: string }>('tag-view-notify', (d) => notifyTagViews(deps, d.tagId));
  await deps.queue.work('tag-view-sweep', () => sweepTagViews(deps));
  await deps.queue.schedule('tag-view-sweep', '* * * * *');
  await deps.queue.work('traccar-poll', () => pollTraccarActivity(deps));
  await deps.queue.work('activity-sweep', () => sweepActivity(deps));
  await deps.queue.work('retention', () => runRetention(deps));
  await deps.queue.schedule('traccar-poll', '* * * * *');
  await deps.queue.schedule('activity-sweep', '* * * * *');
  await deps.queue.schedule('retention', '15 9 * * *'); // 03:15 en Ciudad de México
}
