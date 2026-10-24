import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/db';
import { generateToken, AuthRequest } from '../middleware/auth';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

const oauth2Client = new OAuth2Client(googleClientId, googleClientSecret, googleCallbackUrl);

export class AuthController {
  /**
   * Handles Google OAuth login (either via Credential Token from Google One Tap / Button,
   * or authorization code flow).
   */
  public static async googleAuth(req: Request, res: Response) {
    try {
      const { credential, code } = req.body;
      let email = '';
      let name = '';
      let avatar = '';
      let googleId = '';

      if (credential) {
        // ID token from Google Identity Services
        const ticket = await oauth2Client.verifyIdToken({
          idToken: credential,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return res.status(400).json({ message: 'Invalid Google credential token' });
        }
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        avatar = payload.picture || '';
        googleId = payload.sub;
      } else if (code) {
        // Authorization code exchange
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token!,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return res.status(400).json({ message: 'Failed to verify Google profile' });
        }
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        avatar = payload.picture || '';
        googleId = payload.sub;
      } else {
        return res.status(400).json({ message: 'Missing Google credential or code' });
      }

      // Upsert User in PostgreSQL
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          avatar,
          googleId,
        },
        create: {
          email,
          name,
          avatar,
          googleId,
        },
        include: {
          slackIntegration: true,
        },
      });

      const token = generateToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackConnected: !!user.slackIntegration || !!process.env.SLACK_DEFAULT_WEBHOOK_URL,
        },
      });
    } catch (err: any) {
      console.error('[AuthController] Google auth error:', err.message);
      return res.status(500).json({ message: 'Google authentication failed: ' + err.message });
    }
  }

  /**
   * One-click development login for instant testing.
   */
  public static async devLogin(req: Request, res: Response) {
    try {
      const email = req.body.email || 'demo.user@reachinbox.ai';
      const name = req.body.name || 'Demo Engineer';
      const avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox';

      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar },
        create: { email, name, avatar },
        include: { slackIntegration: true },
      });

      const token = generateToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackConnected: !!user.slackIntegration || !!process.env.SLACK_DEFAULT_WEBHOOK_URL,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  /**
   * Returns current authenticated profile and integration status.
   */
  public static async getCurrentUser(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { slackIntegration: true },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      slackConnected: !!user.slackIntegration || !!process.env.SLACK_DEFAULT_WEBHOOK_URL,
      slackChannel: user.slackIntegration?.channelName || process.env.SLACK_DEFAULT_CHANNEL || '#all-new-workspace',
    });
  }
}

export default AuthController;
