import { Worker, Job } from 'bullmq';
import { redisClient, redisConnectionOptions } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobPayload, scheduleEmailJob } from '../queues/emailQueue';
import prisma from '../config/db';
import { getMailerTransporter, getEtherealPreviewUrl } from '../config/mailer';
import ElasticsearchService from '../services/elasticsearchService';
import SlackService from '../services/slackService';

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const defaultMinDelayMs = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10);
const defaultHourlyLimit = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates current 1-hour time window key and milliseconds remaining until next hour window.
 */
function getHourWindowInfo() {
  const now = new Date();
  const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const nextHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);

  const windowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  const delayUntilNextHourMs = Math.max(1000, nextHourStart.getTime() - now.getTime());

  return { windowKey, nextHourStart, delayUntilNextHourMs };
}

/**
 * Checks and increments the Redis-backed atomic rate limit counter for a sender within the current hour.
 * Returns true if allowed, or false if hourly cap reached.
 */
async function checkAndIncrementRateLimit(senderEmail: string, limit: number): Promise<{ allowed: boolean; nextHourStart: Date; delayUntilNextHourMs: number }> {
  const { windowKey, nextHourStart, delayUntilNextHourMs } = getHourWindowInfo();
  const redisKey = `ratelimit:${senderEmail}:${windowKey}`;

  // Atomic increment in Redis
  const count = await redisClient.incr(redisKey);

  // Set TTL of 2 hours on first increment to allow automatic cleanup
  if (count === 1) {
    await redisClient.expire(redisKey, 7200);
  }

  if (count > limit) {
    return {
      allowed: false,
      nextHourStart,
      delayUntilNextHourMs,
    };
  }

  return {
    allowed: true,
    nextHourStart,
    delayUntilNextHourMs,
  };
}

/**
 * Enforces inter-email delay per sender using Redis timestamps to mimic provider throttling safely
 * across concurrent workers.
 */
async function enforceInterEmailDelay(senderEmail: string, minDelayMs: number) {
  const lastSendKey = `last_send_ts:${senderEmail}`;
  const now = Date.now();
  const lastSendTime = await redisClient.get(lastSendKey);

  if (lastSendTime) {
    const elapsed = now - parseInt(lastSendTime, 10);
    if (elapsed < minDelayMs) {
      const waitTime = minDelayMs - elapsed;
      await sleep(waitTime);
    }
  }

  await redisClient.set(lastSendKey, Date.now().toString(), 'EX', 3600);
}

export function createEmailWorker(): Worker<EmailJobPayload> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailJobId, userId, senderEmail, recipientEmail, subject, body, delayBetweenMs, hourlyLimit } = job.data;
      const effectiveHourlyLimit = hourlyLimit || defaultHourlyLimit;
      const effectiveMinDelay = delayBetweenMs || defaultMinDelayMs;

      console.log(`[Worker] Processing Job ${job.id} for ${recipientEmail} from ${senderEmail}`);

      // 1. Check current status in DB (Idempotency and Cancel checks)
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
      });

      if (!emailRecord) {
        console.warn(`[Worker] Record ${emailJobId} not found in DB. Skipping.`);
        return;
      }

      if (emailRecord.status === 'CANCELLED' || emailRecord.status === 'SENT') {
        console.log(`[Worker] Job ${emailJobId} is already ${emailRecord.status}. Skipping.`);
        return;
      }

      // 2. Check Hourly Rate Limiter (Atomic Redis Counter)
      const rateLimitCheck = await checkAndIncrementRateLimit(senderEmail, effectiveHourlyLimit);

      if (!rateLimitCheck.allowed) {
        console.warn(`[Worker] Rate limit of ${effectiveHourlyLimit}/hr REACHED for sender: ${senderEmail}`);

        // Update DB status to RATE_LIMITED
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'RATE_LIMITED',
            failureReason: `Hourly quota of ${effectiveHourlyLimit} exceeded. Postponed to ${rateLimitCheck.nextHourStart.toISOString()}`,
          },
        });

        // Update Elasticsearch
        await ElasticsearchService.updateEmailDoc(emailJobId, {
          status: 'RATE_LIMITED',
        });

        // 3. Dispatch Live Slack Alert
        await SlackService.notifyRateLimitHit({
          userId,
          senderEmail,
          hourlyLimit: effectiveHourlyLimit,
          nextAvailableWindow: rateLimitCheck.nextHourStart,
          recipientEmail,
          subject,
        });

        // 4. Reschedule job into next available hour window without dropping it
        console.log(`[Worker] Rescheduling ${emailJobId} to run in ${Math.round(rateLimitCheck.delayUntilNextHourMs / 1000)}s`);
        await scheduleEmailJob(job.data, rateLimitCheck.nextHourStart);

        return;
      }

      // 3. Throttling: Enforce minimum delay between sends
      await enforceInterEmailDelay(senderEmail, effectiveMinDelay);

      // 4. Mark status as PROCESSING
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'PROCESSING' },
      });

      try {
        // 5. Send Email via SMTP
        const transporter = await getMailerTransporter();

        const senderRawName = senderEmail.split('@')[0].replace(/[._-]/g, ' ');
        const senderDisplayName = senderRawName.charAt(0).toUpperCase() + senderRawName.slice(1);

        const info = await transporter.sendMail({
          from: `"${senderDisplayName}" <${senderEmail}>`,
          to: recipientEmail,
          subject,
          text: body.replace(/<[^>]*>/g, ' '),
          html: body.includes('<') ? body : body.replace(/\n/g, '<br/>'),
        });

        const previewUrl = getEtherealPreviewUrl(info) || null;
        console.log(`[Worker] Email sent to ${recipientEmail}. Preview: ${previewUrl}`);

        // 6. Update Database
        const updatedRecord = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealMessageId: info.messageId,
            etherealPreviewUrl: previewUrl,
            failureReason: null,
          },
        });

        // 7. Update Elasticsearch index
        await ElasticsearchService.updateEmailDoc(emailJobId, {
          status: 'SENT',
          sentAt: updatedRecord.sentAt,
          etherealPreviewUrl: previewUrl,
        });

      } catch (sendError: any) {
        console.error(`[Worker] Failed sending email ${emailJobId}:`, sendError.message);

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            failureReason: sendError.message,
            retryCount: { increment: 1 },
          },
        });

        await ElasticsearchService.updateEmailDoc(emailJobId, {
          status: 'FAILED',
        });

        throw sendError; // BullMQ backoff retry
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] BullMQ Worker connection error:', err.message);
  });

  return worker;
}

// Standalone execution support
if (require.main === module) {
  console.log(`[Worker] Starting standalone BullMQ Worker (Concurrency: ${concurrency})...`);
  createEmailWorker();
}

export default createEmailWorker;
