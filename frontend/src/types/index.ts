export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  slackConnected?: boolean;
  slackChannel?: string;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED' | 'CANCELLED';

export interface EmailJob {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  etherealPreviewUrl?: string | null;
  failureReason?: string | null;
  delayBetweenMs?: number;
  hourlyLimit?: number;
  createdAt: string;
}

export interface SchedulerMetrics {
  stats: {
    scheduled: number;
    sent: number;
    failed: number;
    rateLimited: number;
  };
  queue: {
    waiting: number;
    delayed: number;
    active: number;
  };
}

export interface SenderOption {
  id: string;
  name: string;
  email: string;
}
