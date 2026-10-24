import { Router } from 'express';
import multer from 'multer';
import { EmailController } from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

router.use(requireAuth);

router.get('/senders', EmailController.getSenders);
router.post('/schedule', upload.single('leadsFile'), EmailController.scheduleEmails);
router.get('/scheduled', EmailController.getScheduledEmails);
router.get('/sent', EmailController.getSentEmails);
router.get('/metrics', EmailController.getMetrics);
router.delete('/:id', EmailController.cancelScheduledEmail);

export default router;
