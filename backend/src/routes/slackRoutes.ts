import { Router } from 'express';
import { SlackController } from '../controllers/slackController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public OAuth callback
router.get('/callback', SlackController.oauthCallback);

// Protected routes
router.get('/status', requireAuth, SlackController.getStatus);
router.post('/connect-webhook', requireAuth, SlackController.connectWebhook);
router.post('/disconnect', requireAuth, SlackController.disconnect);
router.post('/test', requireAuth, SlackController.sendTestAlert);

export default router;
