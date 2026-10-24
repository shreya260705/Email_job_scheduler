import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import { emailQueue } from './queues/emailQueue';
import { createEmailWorker } from './workers/emailWorker';
import { initElasticsearch } from './config/elasticsearch';
import prisma from './config/db';

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.endsWith('.vercel.app')
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during deployment testing
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Bull-Board Queue Monitoring Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue as any) as any],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Healthcheck
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-email-scheduler',
  });
});

// Start BullMQ Worker in process
const worker = createEmailWorker();

// Graceful initialization & start
async function bootstrap() {
  try {
    console.log('[Server] Initializing Elasticsearch client...');
    await initElasticsearch();

    app.listen(Number(port), '0.0.0.0', () => {
      console.log(`=================================================`);
      console.log(`🚀 ReachInbox Scheduler API: http://0.0.0.0:${port}`);
      console.log(`📊 Bull-Board Queue Monitor: http://0.0.0.0:${port}/admin/queues`);
      console.log(`=================================================`);
    });
  } catch (err: any) {
    console.error('[Server] Initialization failed:', err);
    process.exit(1);
  }
}

// Graceful Shutdown & Process Error Handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
});

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received. Shutting down gracefully...');
  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();

export default app;
