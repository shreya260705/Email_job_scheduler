import axios from 'axios';
import { WebClient } from '@slack/web-api';
import prisma from '../config/db';

interface RateLimitAlertParams {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  nextAvailableWindow: Date;
  recipientEmail: string;
  subject?: string;
}

export class SlackService {
  /**
   * Dispatches a live notification to the user's connected Slack workspace or default webhook
   * when a sender hits the hourly rate limit threshold.
   */
  public static async notifyRateLimitHit(params: RateLimitAlertParams): Promise<boolean> {
    const { userId, senderEmail, hourlyLimit, nextAvailableWindow, recipientEmail, subject } = params;

    try {
      // 1. Check if user has an active Slack integration stored in PostgreSQL
      let webhookUrl: string | null = null;
      let botToken: string | null = null;
      let channelId: string | null = null;

      const userIntegration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });

      if (userIntegration) {
        webhookUrl = userIntegration.webhookUrl;
        botToken = userIntegration.accessToken;
        channelId = userIntegration.channelName;
      } else if (process.env.SLACK_DEFAULT_WEBHOOK_URL) {
        // Fallback to configured default webhook so testing works out of the box
        webhookUrl = process.env.SLACK_DEFAULT_WEBHOOK_URL;
      }

      if (!webhookUrl && !botToken) {
        console.log(`[SlackService] User ${userId} has not connected Slack. Skipping rate-limit notification.`);
        return false;
      }

      const formattedNextTime = nextAvailableWindow.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const messagePayload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ ReachInbox: Sender Hourly Rate Limit Reached',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender Account:*\n\`${senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Quota:*\n*${hourlyLimit} emails / hr*`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Queued Recipient:*\n${recipientEmail}`,
              },
              {
                type: 'mrkdwn',
                text: `*Next Execution Window:*\n*${formattedNextTime}*`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🛡️ *Auto-rescheduling active*: The job was postponed into the next hour window to protect your sender reputation. No emails were dropped.`,
              },
            ],
          },
        ],
      };

      // If webhook is available, dispatch via incoming webhook
      if (webhookUrl) {
        await axios.post(webhookUrl, messagePayload);
        console.log(`[SlackService] Live rate-limit alert dispatched to Slack Webhook for ${senderEmail}`);
        return true;
      }

      // If bot token is available, dispatch via WebClient
      if (botToken && channelId) {
        const client = new WebClient(botToken);
        await client.chat.postMessage({
          channel: channelId,
          text: `ReachInbox Alert: Hourly rate limit of ${hourlyLimit}/hr reached for ${senderEmail}`,
          blocks: messagePayload.blocks,
        });
        console.log(`[SlackService] Live rate-limit alert dispatched to Slack Channel ${channelId} for ${senderEmail}`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[SlackService] Error dispatching Slack notification:', error.response?.data || error.message);
      // Fail gracefully: scheduler should never crash because of third-party notification failure
      return false;
    }
  }

  /**
   * Sends a verification test ping to confirm webhook or channel connectivity.
   */
  public static async sendTestMessage(webhookUrl: string): Promise<boolean> {
    try {
      await axios.post(webhookUrl, {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '✅ ReachInbox Slack Connection Verified',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Your Slack workspace has been successfully connected to the *ReachInbox Email Job Scheduler*. Real-time rate-limit alerts will appear here.',
            },
          },
        ],
      });
      return true;
    } catch (err: any) {
      console.error('[SlackService] Failed to send test Slack message:', err.message);
      throw new Error(err.response?.data?.message || err.message);
    }
  }
}

export default SlackService;
