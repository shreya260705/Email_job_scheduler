import { Response } from 'express';
import axios from 'axios';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import SlackService from '../services/slackService';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class SlackController {
  /**
   * Returns current Slack connection status for the authenticated user.
   */
  public static async getStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });

      if (integration) {
        return res.json({
          connected: true,
          channel: integration.channelName || '#general',
          team: integration.teamName || 'Connected Workspace',
          webhookConfigured: true,
        });
      }

      // Check if global default webhook is present
      const defaultWebhook = process.env.SLACK_DEFAULT_WEBHOOK_URL;
      if (defaultWebhook) {
        return res.json({
          connected: true,
          channel: process.env.SLACK_DEFAULT_CHANNEL || '#all-new-workspace',
          team: 'ReachInbox Workspace',
          webhookConfigured: true,
          isDefault: true,
        });
      }

      return res.json({
        connected: false,
        channel: null,
        team: null,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Directly connects or updates an incoming webhook URL for the user.
   */
  public static async connectWebhook(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { webhookUrl, channelName = '#general', teamName = 'My Workspace' } = req.body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({ message: 'A valid Slack Incoming Webhook URL is required.' });
      }

      const integration = await prisma.slackIntegration.upsert({
        where: { userId },
        update: {
          webhookUrl,
          channelName,
          teamName,
        },
        create: {
          userId,
          webhookUrl,
          channelName,
          teamName,
        },
      });

      return res.json({
        message: 'Slack webhook connected successfully!',
        integration: {
          channel: integration.channelName,
          team: integration.teamName,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Disconnects the user's Slack integration.
   */
  public static async disconnect(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      await prisma.slackIntegration.deleteMany({
        where: { userId },
      });

      return res.json({ message: 'Slack disconnected successfully.' });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Dispatches a live test message to verify the Slack connection.
   */
  public static async sendTestAlert(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      const userIntegration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });

      const webhookUrl = userIntegration?.webhookUrl || process.env.SLACK_DEFAULT_WEBHOOK_URL;

      if (!webhookUrl) {
        return res.status(400).json({ message: 'No Slack webhook configured. Please connect Slack first.' });
      }

      await SlackService.sendTestMessage(webhookUrl);

      return res.json({ message: 'Test notification dispatched to Slack successfully!' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to send test alert: ' + err.message });
    }
  }

  /**
   * Handles Slack OAuth 2.0 callback redirect.
   */
  public static async oauthCallback(req: AuthRequest, res: Response) {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.redirect(`${FRONTEND_URL}?slack_error=missing_code`);
      }

      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        null,
        {
          params: {
            client_id: SLACK_CLIENT_ID,
            client_secret: SLACK_CLIENT_SECRET,
            code,
            redirect_uri: SLACK_REDIRECT_URI,
          },
        }
      );

      const data = response.data;
      if (!data.ok) {
        console.error('[SlackOAuth] Error exchanging code:', data.error);
        return res.redirect(`${FRONTEND_URL}?slack_error=${data.error}`);
      }

      const webhookUrl = data.incoming_webhook?.url || process.env.SLACK_DEFAULT_WEBHOOK_URL;
      const channel = data.incoming_webhook?.channel || '#general';
      const team = data.team?.name || 'Slack Workspace';

      if (state && typeof state === 'string') {
        await prisma.slackIntegration.upsert({
          where: { userId: state },
          update: {
            webhookUrl: webhookUrl || '',
            channelName: channel,
            teamName: team,
            accessToken: data.access_token,
          },
          create: {
            userId: state,
            webhookUrl: webhookUrl || '',
            channelName: channel,
            teamName: team,
            accessToken: data.access_token,
          },
        });
      }

      return res.redirect(`${FRONTEND_URL}?slack_connected=true`);
    } catch (err: any) {
      console.error('[SlackOAuth] Callback error:', err.message);
      return res.redirect(`${FRONTEND_URL}?slack_error=oauth_failed`);
    }
  }
}

export default SlackController;
