import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export interface EmailJobPayload {
  emailJobId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenMs: number;
  hourlyLimit: number;
}

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000, // Retain last 1000 completed jobs for audit & Bull-board
    },
    removeOnFail: {
      count: 5000, // Retain failed jobs for inspection
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('[Queue] BullMQ Queue connection error:', err.message);
});

/**
 * Enqueues an individual email job with exact millisecond delay.
 * Idempotency is enforced by using the database record ID as the BullMQ jobId.
 */
export async function scheduleEmailJob(payload: EmailJobPayload, targetTime: Date) {
  const now = Date.now();
  const scheduledTimeMs = targetTime.getTime();
  const delay = Math.max(0, scheduledTimeMs - now);

  const job = await emailQueue.add(
    'send-email',
    payload,
    {
      delay,
      jobId: payload.emailJobId, // Prevents duplicate jobs in the queue
    }
  );

  return job;
}

/**
 * Enqueues a batch of emails, automatically applying staggered delays between them
 * to respect the user's inter-email throttle settings.
 */
export async function scheduleEmailBatch(
  jobs: { payload: EmailJobPayload; initialTime: Date }[],
  interEmailDelayMs: number
) {
  const results = [];
  let currentTargetTime = jobs[0]?.initialTime.getTime() || Date.now();

  for (let i = 0; i < jobs.length; i++) {
    const item = jobs[i];
    // Stagger subsequent emails by the configured delay
    const scheduledTimestamp = i === 0 ? currentTargetTime : currentTargetTime + i * interEmailDelayMs;
    const targetDate = new Date(scheduledTimestamp);

    const job = await scheduleEmailJob(item.payload, targetDate);
    results.push(job);
  }

  return results;
}

export default emailQueue;
