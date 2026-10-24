import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/google', AuthController.googleAuth);
router.post('/dev-login', AuthController.devLogin);
router.get('/me', requireAuth, AuthController.getCurrentUser);

export default router;
