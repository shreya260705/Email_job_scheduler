import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { scheduleEmailJob, emailQueue } from '../queues/emailQueue';
import ElasticsearchService from '../services/elasticsearchService';
import { extractValidEmails } from '../utils/csvParser';
import { executeEmailDelivery } from '../workers/emailWorker';

const DEFAULT_SENDERS = [
  { name: 'Growth Team', email: 'outreach@growth.reachinbox.ai' },
  { name: 'Shreya Tripathi', email: 'shreya@reachinbox.ai' },
  { name: 'Alex Johnson', email: 'alex@reachinbox.ai' },
];

export class EmailController {
  /**
   * Returns list of configured sender accounts.
   */
  public static async getSenders(req: AuthRequest, res: Response) {
    try {
      const dbSenders = await prisma.sender.findMany({
        select: { id: true, name: true, email: true },
      });

      if (dbSenders.length === 0) {
        // Seed default senders if none exist
        await prisma.sender.createMany({
          data: DEFAULT_SENDERS,
          skipDuplicates: true,
        });
        return res.json(DEFAULT_SENDERS);
      }

      return res.json(dbSenders);
    } catch (err: any) {
      return res.json(DEFAULT_SENDERS);
    }
  }

  /**
   * Schedules single or bulk emails with custom start times, inter-send delays, and hourly caps.
   */
  public static async scheduleEmails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      let recipients: string[] = [];
      const {
        senderEmail = 'outreach@growth.reachinbox.ai',
        subject,
        body,
        startTime,
        delayBetweenSeconds = 2,
        hourlyLimit = 50,
      } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ message: 'Subject and body are required.' });
      }

      // Check if CSV/TXT file was uploaded
      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        recipients = extractValidEmails(fileContent);
      } else if (req.body.recipientEmails) {
        if (Array.isArray(req.body.recipientEmails)) {
          recipients = req.body.recipientEmails;
        } else if (typeof req.body.recipientEmails === 'string') {
          recipients = extractValidEmails(req.body.recipientEmails);
        }
      }

      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ message: 'No valid recipient email addresses found.' });
      }

      const initialStartTime = startTime ? new Date(startTime) : new Date();
      const delayBetweenMs = Math.max(500, Number(delayBetweenSeconds) * 1000);
      const parsedHourlyLimit = Math.max(1, Number(hourlyLimit));
      const batchId = `batch_${Date.now()}`;

      const createdJobs = [];

      for (let i = 0; i < recipients.length; i++) {
        const recipientEmail = recipients[i];
        // Stagger each recipient's scheduled timestamp by the inter-send delay
        const targetTime = new Date(initialStartTime.getTime() + i * delayBetweenMs);

        // 1. Create source of truth record in PostgreSQL
        const emailRecord = await prisma.emailJob.create({
          data: {
            userId,
            senderEmail,
            recipientEmail,
            subject,
            body,
            scheduledAt: targetTime,
            status: 'SCHEDULED',
            delayBetweenMs,
            hourlyLimit: parsedHourlyLimit,
            batchId,
          },
        });

        // 2. Index in Elasticsearch
        await ElasticsearchService.indexEmail({
          id: emailRecord.id,
          userId,
          senderEmail,
          recipientEmail,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: targetTime,
          createdAt: emailRecord.createdAt,
        });

        // 3. Queue in BullMQ with millisecond delay (no cron)
        await scheduleEmailJob(
          {
            emailJobId: emailRecord.id,
            userId,
            senderEmail,
            recipientEmail,
            subject,
            body,
            scheduledAt: targetTime.toISOString(),
            delayBetweenMs,
            hourlyLimit: parsedHourlyLimit,
          },
          targetTime
        );

        createdJobs.push(emailRecord);
      }

      return res.status(201).json({
        message: `Successfully scheduled ${createdJobs.length} email(s).`,
        count: createdJobs.length,
        batchId,
        firstScheduledAt: initialStartTime.toISOString(),
        lastScheduledAt: new Date(initialStartTime.getTime() + (recipients.length - 1) * delayBetweenMs).toISOString(),
      });
    } catch (err: any) {
      console.error('[EmailController] Error scheduling emails:', err);
      return res.status(500).json({ message: 'Failed to schedule emails: ' + err.message });
    }
  }

  /**
   * Reconciles overdue scheduled jobs where scheduledAt <= now and status === 'SCHEDULED'.
   * Ensures seamless, guaranteed delivery even if BullMQ worker was restarting or delayed.
   */
  public static async reconcileOverdueJobs(userId?: string) {
    try {
      const now = new Date();
      const overdueJobs = await prisma.emailJob.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now },
          ...(userId ? { userId } : {}),
        },
        take: 20,
      });

      if (overdueJobs.length > 0) {
        console.log(`[Reconciliation] Reconciling ${overdueJobs.length} overdue scheduled jobs...`);
        for (const job of overdueJobs) {
          try {
            await executeEmailDelivery(job.id);
          } catch (e: any) {
            console.error(`[Reconciliation] Error delivering ${job.id}:`, e.message);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Reconciliation] Failed checking overdue jobs:', err.message);
    }
  }

  /**
   * Retrieves scheduled emails with immediate PostgreSQL retrieval and Elasticsearch search.
   */
  public static async getScheduledEmails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      // Reconcile any overdue jobs so status seamlessly reflects SENT immediately
      await EmailController.reconcileOverdueJobs(userId);

      const { q = '', page = '1', limit = '50' } = req.query;

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const trimmedQuery = (q as string).trim();

      // If search query is provided, attempt Elasticsearch first, then DB fallback
      if (trimmedQuery.length > 0) {
        const searchResult = await ElasticsearchService.searchEmails({
          userId,
          query: trimmedQuery,
          status: 'SCHEDULED',
          page: pageNum,
          limit: limitNum,
        });

        return res.json({
          emails: searchResult.items,
          total: searchResult.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(searchResult.total / limitNum),
        });
      }

      // Canonical database fetch: retrieve all SCHEDULED, RATE_LIMITED, and PROCESSING jobs
      const whereClause: any = {
        userId,
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      };

      if (trimmedQuery.length > 0) {
        whereClause.OR = [
          { recipientEmail: { contains: trimmedQuery, mode: 'insensitive' } },
          { subject: { contains: trimmedQuery, mode: 'insensitive' } },
          { body: { contains: trimmedQuery, mode: 'insensitive' } },
          { senderEmail: { contains: trimmedQuery, mode: 'insensitive' } },
        ];
      }

      const [emails, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereClause,
          skip,
          take: limitNum,
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.emailJob.count({ where: whereClause }),
      ]);

      return res.json({
        emails,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Retrieves sent and failed emails with Ethereal preview links and search.
   */
  public static async getSentEmails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      // Reconcile any overdue jobs so newly delivered emails appear in Sent list
      await EmailController.reconcileOverdueJobs(userId);

      const { q = '', status = 'ALL', page = '1', limit = '50' } = req.query;

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const trimmedQuery = (q as string).trim();

      // If search query is provided, attempt Elasticsearch first
      if (trimmedQuery.length > 0) {
        const searchResult = await ElasticsearchService.searchEmails({
          userId,
          query: trimmedQuery,
          status: status === 'ALL' ? 'SENT' : (status as string),
          page: pageNum,
          limit: limitNum,
        });

        return res.json({
          emails: searchResult.items,
          total: searchResult.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(searchResult.total / limitNum),
        });
      }

      // Canonical database fetch: retrieve all SENT or FAILED jobs
      const whereClause: any = {
        userId,
        status: status === 'ALL' ? { in: ['SENT', 'FAILED'] } : (status as any),
      };

      if (trimmedQuery.length > 0) {
        whereClause.OR = [
          { recipientEmail: { contains: trimmedQuery, mode: 'insensitive' } },
          { subject: { contains: trimmedQuery, mode: 'insensitive' } },
          { body: { contains: trimmedQuery, mode: 'insensitive' } },
          { senderEmail: { contains: trimmedQuery, mode: 'insensitive' } },
        ];
      }

      const [emails, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereClause,
          skip,
          take: limitNum,
          orderBy: { sentAt: 'desc' },
        }),
        prisma.emailJob.count({ where: whereClause }),
      ]);

      return res.json({
        emails,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Fetches real-time scheduler metrics.
   */
  public static async getMetrics(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      await EmailController.reconcileOverdueJobs(userId);

      const [totalScheduled, totalSent, totalFailed, totalRateLimited] = await Promise.all([
        prisma.emailJob.count({
          where: {
            userId,
            status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
          },
        }),
        prisma.emailJob.count({
          where: {
            userId,
            status: { in: ['SENT', 'FAILED'] },
          },
        }),
        prisma.emailJob.count({ where: { userId, status: 'FAILED' } }),
        prisma.emailJob.count({ where: { userId, status: 'RATE_LIMITED' } }),
      ]);

      const waitingCount = await emailQueue.getWaitingCount();
      const delayedCount = await emailQueue.getDelayedCount();
      const activeCount = await emailQueue.getActiveCount();

      return res.json({
        stats: {
          scheduled: totalScheduled,
          sent: totalSent,
          failed: totalFailed,
          rateLimited: totalRateLimited,
        },
        queue: {
          waiting: waitingCount,
          delayed: delayedCount,
          active: activeCount,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Cancels or deletes an email job from BullMQ and PostgreSQL.
   */
  public static async cancelScheduledEmail(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const jobRecord = await prisma.emailJob.findFirst({
        where: { id, userId },
      });

      if (!jobRecord) {
        return res.status(404).json({ message: 'Email not found.' });
      }

      // If still scheduled, remove from BullMQ
      if (jobRecord.status === 'SCHEDULED') {
        try {
          const bullJob = await emailQueue.getJob(id);
          if (bullJob) {
            await bullJob.remove();
          }
        } catch (e) {}
      }

      // Delete from DB and Elasticsearch
      await prisma.emailJob.delete({
        where: { id },
      });

      try {
        await ElasticsearchService.deleteEmailDoc(id);
      } catch (e) {}

      return res.json({ message: 'Email removed successfully.' });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }
}

export default EmailController;
