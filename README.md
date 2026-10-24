# ReachInbox Email Job Scheduler & Dashboard

A high-performance, fault-tolerant email scheduling service and analytics dashboard built for ReachInbox (Outbox Labs). This system schedules and delivers single or bulk cold email campaigns at future timestamps, enforces worker concurrency, simulates email provider throttling, rate-limits sends per sender per hour using Redis atomic counters, alerts Slack on limit breaches, indexes emails in Elasticsearch, and guarantees complete persistence across server restarts without cron jobs.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
   - [1. How Scheduling Works (Zero Cron)](#1-how-scheduling-works-zero-cron)
   - [2. How Persistence on Restart is Handled](#2-how-persistence-on-restart-is-handled)
   - [3. How Rate Limiting & Concurrency are Implemented](#3-how-rate-limiting--concurrency-are-implemented)
2. [Environment Variables & Ethereal Email Setup](#environment-variables--ethereal-email-setup)
   - [Setting Up Ethereal Email (Two Options)](#setting-up-ethereal-email-two-options)
   - [Backend Environment Variables (`backend/.env`)](#backend-environment-variables-backendenv)
   - [Frontend Environment Variables (`frontend/.env`)](#frontend-environment-variables-frontendenv)
3. [How to Run the Application](#how-to-run-the-application)
   - [Option A: Running with Docker Compose (Fastest)](#option-a-running-with-docker-compose-fastest)
   - [Option B: Running Locally Step-by-Step](#option-b-running-locally-step-by-step)
     - [1. Running Database (PostgreSQL)](#1-running-database-postgresql)
     - [2. Running Cache & Queue Store (Redis)](#2-running-cache--queue-store-redis)
     - [3. Running Backend (Express API & BullMQ Worker)](#3-running-backend-express-api--bullmq-worker)
     - [4. Running Frontend (Vite + React)](#4-running-frontend-vite--react)
4. [List of Features Implemented](#list-of-features-implemented)
   - [Backend Features (Mapped)](#backend-features-mapped)
   - [Frontend Features (Mapped)](#frontend-features-mapped)
5. [Verification & Testing Checklist](#verification--testing-checklist)
6. [Tech Stack](#tech-stack)

---

## Architecture Overview

```
                      +-----------------------------+
                      | React Frontend (Vite + TS)  |
                      |  - Google OAuth / Dev Auth  |
                      |  - Dual Layout: Table/List  |
                      |  - Compose Modal & CSV Drag |
                      |  - Metric Counters & Search |
                      +--------------+--------------+
                                     |  HTTP / REST
                                     v
                      +-----------------------------+
                      |  Express.js TypeScript API  |
                      |   /api/auth  /api/emails    |
                      |   /api/slack /admin/queues  |
                      +---+----------+----------+---+
                          |          |          |
         +----------------+          |          +-----------------+
         v                           v                            v
+------------------+       +-------------------+       +--------------------+
| PostgreSQL 16    |       | Redis 7 (BullMQ)  |       | Elasticsearch 8.13 |
| (Prisma ORM)     |       | - Delayed Queues  |       | - Full-Text Search |
| - Users & Senders|       | - Sliding Limits  |       | - Status Indexing  |
| - Email Jobs     |       | - Persistent AOF  |       +--------------------+
+------------------+       +---------+---------+
                                     |
                                     v
                      +-----------------------------+
                      |    BullMQ Worker Consumer   |
                      | - Concurrency Control (5)   |
                      | - Inter-email Delays (2000ms|
                      | - Hourly Rate Limiter (50/h)|
                      +---+---------------------+---+
                          |                     |
                          v                     v
              +-----------------------+   +-------------------+
              | Ethereal SMTP Mailer  |   | Slack Alerts Webhook
              | - Captured Message-ID |   | - Live Warning Ping
              | - Web Preview URL     |   | - Next Run Window |
              +-----------------------+   +-------------------+
```

### 1. How Scheduling Works (Zero Cron)

Traditional cron polling (`setInterval` or `* * * * *`) suffers from uneven loads, high database polling queries, missed windows during process restarts, and race conditions when multiple worker instances run. This system uses an **event-driven delayed queue architecture** powered by **BullMQ** and **Redis**:

1. **Timestamp Offset Calculation**:
   When a user schedules an email for a future date/time `scheduledAt`, the backend computes the exact millisecond delay:
   $$\text{delay} = \max(0, \text{scheduledAt} - \text{Date.now()})$$
2. **Redis Sorted Set (ZSET)**:
   BullMQ places the job into a Redis Sorted Set (`wait` / `delayed`) scored by its target execution UNIX timestamp. Redis efficiently tracks pending timers without CPU spinning or polling queries.
3. **Deterministic Wakeup**:
   Redis streams notify BullMQ workers the instant the delay expires. The worker moves the job to the `active` queue and begins processing.
4. **Staggered Batch Scheduling**:
   When multiple emails or a CSV file of leads are uploaded, the scheduler calculates individual offsets for each recipient:
   $$\text{timestamp}_i = \text{targetTime} + (i \times \text{delayBetweenMs})$$
   This ensures campaigns are spaced evenly rather than sent as an instant burst.
5. **Idempotency**:
   Every BullMQ job uses the database record's unique ID (`emailJobId`) as its `jobId`. Enqueueing the same ID multiple times is deduplicated at the Redis layer.

---

### 2. How Persistence on Restart is Handled

System reliability requires that scheduled jobs, active timers, and execution states survive sudden crashes or restarts of the Express server, worker processes, or host machine:

1. **Relational Single Source of Truth**:
   Every scheduled email is persisted in **PostgreSQL** via Prisma ORM before it is enqueued, with initial status `SCHEDULED`, along with all parameters (sender, recipient, subject, body, target time, hourly limit, delay).
2. **Redis Append-Only File (AOF) Persistence**:
   Redis is configured with `--appendonly yes`. Every queue operation, delayed timer state, and sliding window counter is logged to disk (`redis_data` volume). If Redis restarts, the entire queue state and exact timer offsets are restored from disk.
3. **Seamless Crash Recovery**:
   - If the backend or worker process crashes while 500 emails are queued for tomorrow, **no jobs are lost**.
   - Upon restart, the BullMQ worker connects to Redis, resumes listening to the existing sorted sets, and fires every job at its original scheduled timestamp.
   - Any jobs whose scheduled time passed while the server was down execute immediately upon worker startup.
4. **Safe Status Synchronization**:
   Before sending an email, the worker verifies the current status in PostgreSQL. If a job was marked `CANCELLED` by the user in the UI while queued, the worker safely skips processing without sending.

---

### 3. How Rate Limiting & Concurrency are Implemented

#### Concurrency Control
- **Configurable Worker Concurrency**:
  The BullMQ worker runs with configurable concurrency (`WORKER_CONCURRENCY=5`, configurable via `.env`). This allows the worker to process up to 5 jobs in parallel without thread starvation or blocking the Node.js event loop.
- **Provider Throttling (Inter-Email Spacing)**:
  Real mail providers (Gmail, SendGrid, Amazon SES) penalize or flag accounts that send bursts of emails in the same second. The worker enforces a configurable minimum interval between individual sends (`MIN_DELAY_BETWEEN_EMAILS_MS=2000`, 2 seconds). The worker records the sender's last dispatch timestamp in Redis (`last_send_ts:{senderEmail}`) and automatically waits if consecutive sends occur too closely.

#### Sliding Hourly Rate Limiting
- **Quota Tracking per Sender**:
  Each sender has an hourly sending limit (`MAX_EMAILS_PER_HOUR_PER_SENDER=50`, customizable in the compose modal per campaign).
- **Atomic Redis Counters**:
  Every send increments an atomic Redis key keyed by sender and hourly window:
  ```
  ratelimit:{senderEmail}:{YYYY-MM-DD-HH}
  ```
  An automatic TTL of 2 hours (`EXPIRE 7200`) ensures old keys are evicted cleanly without manual garbage collection.
- **Graceful Postponement (No Dropped Emails)**:
  When a sender hits the hourly threshold:
  1. The email is **never dropped, lost, or marked as failed**.
  2. The worker computes the exact milliseconds remaining until the top of the next hour window:
     $$\Delta t = \text{nextHourStart} - \text{now}$$
  3. The job status is updated to `RATE_LIMITED` in PostgreSQL and Elasticsearch.
  4. The job is automatically rescheduled to run at `nextHourStart` using BullMQ's delayed retry.
- **Live Slack Alerting**:
  Whenever the hourly limit is reached, a rich Slack Block Kit alert is immediately dispatched to the user's connected Slack webhook/channel detailing the sender address, the quota reached, and the scheduled resume time.

---

## Environment Variables & Ethereal Email Setup

### Setting Up Ethereal Email (Two Options)

[Ethereal Email](https://ethereal.email) is a fake SMTP service designed for testing. Emails sent through Ethereal are captured in a safe test mailbox without delivering to real recipients.

#### Option 1: Automatic Setup (Zero Config - Default)
Leave `ETHEREAL_USER` and `ETHEREAL_PASS` empty in your `backend/.env`.
When the backend starts up, `nodemailer.createTestAccount()` automatically generates dynamic, temporary test credentials and logs them to your terminal:
```
[Mailer] Generating dynamic Ethereal test account...
[Mailer] Created Ethereal account: <generated-user>@ethereal.email
```
Every sent email generates a web preview URL (`nodemailer.getTestMessageUrl()`) that is stored in the database and visible in the Frontend table via the **"View Mail"** button.

#### Option 2: Dedicated Account (Persistent Mailbox)
If you want all test emails saved to a single persistent mailbox on ethereal.email:
1. Navigate to [https://ethereal.email/create](https://ethereal.email/create).
2. Click **Create Ethereal Account**.
3. Copy the generated **Account**, **User**, and **Password**.
4. Open `backend/.env` and paste the credentials:
   ```env
   ETHEREAL_USER=your_account_user@ethereal.email
   ETHEREAL_PASS=your_account_password
   ```
5. Restart your backend server. Now, you can log into [ethereal.email/messages](https://ethereal.email/messages) with those credentials to see all sent emails in one inbox.

---

### Backend Environment Variables (`backend/.env`)

Create a `.env` file inside the `backend/` directory (or copy from `backend/.env.example`):

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port for the Express API server |
| `NODE_ENV` | No | `development` | Runtime environment (`development` / `production`) |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed CORS origin for the Vite frontend |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:postgres@localhost:5432/email_scheduler?schema=public` | PostgreSQL connection URL |
| `REDIS_HOST` | **Yes** | `localhost` | Redis server hostname |
| `REDIS_PORT` | **Yes** | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | `""` | Redis auth password (if enabled) |
| `ELASTICSEARCH_NODE` | No | `http://localhost:9200` | Elasticsearch node URL (falls back to DB if unreachable) |
| `JWT_SECRET` | **Yes** | `super-secret-reachinbox-key-...` | Secret used to sign authentication JWT tokens |
| `WORKER_CONCURRENCY` | No | `5` | Number of simultaneous jobs BullMQ worker processes |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | No | `2000` | Minimum throttle delay (ms) between consecutive sends per sender |
| `MAX_EMAILS_PER_HOUR_PER_SENDER`| No | `50` | Maximum emails a single sender can deliver per hour |
| `GOOGLE_CLIENT_ID` | No | Configured | Google OAuth 2.0 Client ID for Google login |
| `GOOGLE_CLIENT_SECRET` | No | Configured | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | No | `http://localhost:5000/api/auth/google/callback` | OAuth redirect URI |
| `SLACK_CLIENT_ID` | No | Configured | Slack App Client ID |
| `SLACK_CLIENT_SECRET` | No | Configured | Slack App Client Secret |
| `SLACK_DEFAULT_WEBHOOK_URL` | No | Pre-configured | Incoming Webhook URL to receive live rate limit alerts |
| `SLACK_DEFAULT_CHANNEL` | No | `#all-new-workspace` | Slack channel name for alert notifications |
| `ETHEREAL_USER` | No | Auto-generated | Ethereal SMTP username (auto-generated if blank) |
| `ETHEREAL_PASS` | No | Auto-generated | Ethereal SMTP password (auto-generated if blank) |
| `SMTP_HOST` | No | Blank | (Optional) Real SMTP host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | No | `587` | (Optional) Real SMTP port |
| `SMTP_USER` | No | Blank | (Optional) Real SMTP username |
| `SMTP_PASS` | No | Blank | (Optional) Real SMTP app password |

---

### Frontend Environment Variables (`frontend/.env`)

Create a `.env` file inside the `frontend/` directory (or copy from `frontend/.env.example`):

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | **Yes** | `http://localhost:5000/api` | Backend API base URL |
| `VITE_GOOGLE_CLIENT_ID`| No | Pre-configured | Google OAuth 2.0 Client ID for the Google Sign-in button |

---

## How to Run the Application

You can run the entire system using **Docker Compose** (recommended, zero-install) or **locally step-by-step**.

---

### Option A: Running with Docker Compose (Fastest)

Spins up all 5 isolated containers: PostgreSQL 16, Redis 7 (AOF enabled), Elasticsearch 8.13, Backend API & Worker, and Frontend UI:

```bash
# 1. Clone or navigate to the repository root
cd outbox

# 2. Build and boot all containers
docker compose up --build
```

#### Access Points:
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:5000](http://localhost:5000)
- **Bull-Board Queue Monitor**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **Elasticsearch Engine**: [http://localhost:9200](http://localhost:9200)

To stop the containers:
```bash
docker compose down
```

---

### Option B: Running Locally Step-by-Step

#### Prerequisites
- **Node.js** >= 20.x
- **npm** >= 10.x
- **PostgreSQL** running on port `5432`
- **Redis** running on port `6379`
- *(Optional)* **Elasticsearch** running on port `9200` (system includes automated PostgreSQL fallback)

---

#### 1. Running Database (PostgreSQL)

If you don't have a local PostgreSQL instance installed, run one via Docker:

```bash
docker run -d \
  --name reachinbox_postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=email_scheduler \
  postgres:16-alpine
```

Apply the database schema and generate Prisma client:

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

---

#### 2. Running Cache & Queue Store (Redis)

Start Redis with Append-Only File (AOF) persistence enabled to ensure queue timers survive restarts:

```bash
docker run -d \
  --name reachinbox_redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes
```

*(Or start your local service: `redis-server --appendonly yes`)*

---

#### 3. Running Backend (Express API & BullMQ Worker)

The backend Express application (`src/server.ts`) boots the Express API, connects to PostgreSQL and Redis, and automatically initializes the **BullMQ worker** within the process:

```bash
cd backend
npm run dev
```

> **Note on Standalone Worker Process**:
> If you wish to run the BullMQ worker as an independent, decoupled consumer process (e.g. for microservice scaling), run:
> ```bash
> npm run worker
> ```

You should see:
```
[Server] Initializing Elasticsearch client...
[Mailer] Created Ethereal account: ...@ethereal.email
=================================================
🚀 ReachInbox Scheduler API: http://localhost:5000
📊 Bull-Board Queue Monitor: http://localhost:5000/admin/queues
=================================================
```

---

#### 4. Running Frontend (Vite + React)

In a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## List of Features Implemented

### Backend Features (Mapped)

| Category | Implemented Features & Technical Details |
|---|---|
| **Scheduler** | - **Zero-Cron Delayed Queuing**: Uses BullMQ delayed jobs with exact millisecond resolution.<br>- **Staggered Batch Ingestion**: Uploads CSV leads or arrays and staggers timestamps by configured intervals.<br>- **Cancellation Management**: `DELETE /api/emails/:id` flags DB records as `CANCELLED`, automatically skipped by workers.<br>- **Bull-Board Monitor**: Real-time visual queue inspector mounted at `/admin/queues`. |
| **Persistence** | - **PostgreSQL Primary Source of Truth**: Full schema for `User`, `Sender`, `EmailJob`, and `SlackIntegration`.<br>- **Redis AOF Durability**: Redis disk journaling ensures delayed timers persist across container or OS restarts.<br>- **Idempotent Job IDs**: BullMQ deduplicates tasks using `emailJob.id`.<br>- **Audit History**: Records sent timestamps, message IDs, failure reasons, and retry counters. |
| **Rate Limiting** | - **Sliding Hourly Counters**: Atomic Redis counter `ratelimit:{sender}:{window}` with 2-hour TTL.<br>- **Non-Dropping Reschedule**: If limit reached, worker computes exact delay until next hour window and reschedules the job.<br>- **State Transition**: Marks jobs as `RATE_LIMITED` in DB and search index.<br>- **Live Slack Alerting**: Instantly dispatches rich Block Kit warnings with quota details to Slack channels. |
| **Concurrency** | - **Worker Concurrency Pool**: BullMQ worker runs 5 parallel threads (`WORKER_CONCURRENCY=5`).<br>- **Provider Throttling**: Enforces configurable minimum spacing (default 2000ms) between consecutive sends per sender using Redis timestamps.<br>- **Graceful Shutdown**: Intercepts `SIGINT`/`SIGTERM` to allow in-flight jobs to complete cleanly before closing connections. |
| **Integrations** | - **Ethereal SMTP**: Automatic ephemeral test credentials generation and preview link extraction.<br>- **Elasticsearch 8.13**: Full-text search with fuzzy matching and transparent PostgreSQL `ILIKE` fallback.<br>- **Google OAuth 2.0**: Verified token validation via `google-auth-library` and instant Dev Login mode. |

---

### Frontend Features (Mapped)

| Category | Implemented Features & Technical Details |
|---|---|
| **Login** | - **Google OAuth 2.0 Integration**: Sign-in with Google button using `@react-oauth/google`.<br>- **Instant Dev/Test Login**: 1-click test bypass login button for development and grading.<br>- **Session Persistence**: Stores JWT in `localStorage` with automatic headers injection via Axios interceptors.<br>- **User Profile Display**: User avatar, full name, and email in the top navigation bar with logout menu. |
| **Dashboard** | - **Real-Time Metrics Bar**: Dynamic counters for Scheduled, Delivered, Rate Limited, and Queue Depth.<br>- **Dual View Switcher**: Toggle between modern **Split List-Detail View** and classic **Full-Width Table View**.<br>- **Responsive Navigation Sidebar**: Quick links for All Campaigns, Scheduled, Sent, Analytics, and Slack Settings.<br>- **Global Search**: Search bar with debounce querying Elasticsearch / PostgreSQL. |
| **Compose** | - **Multi-Channel Compose Modal & Dedicated View**: Rich email drafting interface.<br>- **Lead List CSV / TXT Upload**: Drag-and-drop file upload with automated regex email parsing and count badge (`10 emails detected`).<br>- **Date-Time Scheduling**: Immediate send toggle or precise future date/time picker.<br>- **Granular Sending Controls**: Interactive sliders/inputs for inter-send delay (ms) and hourly limit caps.<br>- **Sender Selector**: Dropdown to choose configured sender accounts. |
| **Tables & Lists** | - **Scheduled Emails Table**: Real-time status indicators (`SCHEDULED`, `PROCESSING`, `RATE_LIMITED`), batch tags, scheduled date, and one-click cancel action button.<br>- **Sent Emails Table**: Displays delivery timestamps, recipient, subject, and direct **"View Mail"** link opening the captured Ethereal message.<br>- **Email Detail Drawer**: Side inspector showing complete metadata, headers, HTML body, and delivery logs. |
| **Slack Integration** | - **Connect Slack Modal**: Direct Incoming Webhook configuration or OAuth flow.<br>- **Live Connection Status**: Visual badge indicating connection health.<br>- **Send Test Alert**: Interactive button to fire a live test alert to verified Slack channels. |

---

## Verification & Testing Checklist

Use these steps to test every core requirement:

### 1. Test Email Scheduling
1. Log into the dashboard at [http://localhost:5173](http://localhost:5173) (use **Instant Test Login** or Google OAuth).
2. Click **Compose Email**.
3. Drag-and-drop `leads_sample.csv` (included in the root directory). Notice the counter pill displays `10 emails detected`.
4. Leave "Start Immediately" checked, or select a future time.
5. Set **Delay Between Emails** to `2` seconds, and click **Schedule Emails**.
6. Switch to the **Scheduled** tab to see your jobs queued. Open [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) to see them in the BullMQ dashboard.

### 2. Test Ethereal Email Delivery
1. Wait for the jobs to process.
2. Click on the **Sent** tab.
3. Click the **"View Mail"** button on any sent row. An Ethereal browser window will open displaying the exact rendered HTML email and headers.

### 3. Test Hourly Rate Limiting & Slack Alerting
1. Click **Compose Email**.
2. Enter 3 recipient email addresses.
3. Set **Hourly Limit** to `2` and inter-send delay to `1000` ms.
4. Schedule the emails.
5. Watch the first 2 emails deliver successfully.
6. Observe the 3rd email transition to `RATE_LIMITED` status in the Scheduled table.
7. Check the Slack channel (`#all-new-workspace`) to verify the real-time Slack alert detailing the quota breach and next execution window.

### 4. Test Persistence on Server Restart
1. Compose an email and schedule it **3 minutes** into the future.
2. Verify the email appears as `SCHEDULED` in both the UI and Bull-Board.
3. Stop the backend process:
   - If running locally: Press `Ctrl + C` in the backend terminal.
   - If running Docker: Run `docker stop reachinbox_backend`.
4. Wait 30 seconds. Notice the job remains intact in Redis.
5. Restart the backend (`npm run dev` or `docker start reachinbox_backend`).
6. Observe that when the scheduled time arrives, the worker wakes up and delivers the email without duplication or data loss.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Axios, `@react-oauth/google` |
| **Backend API** | Node.js, TypeScript, Express.js, Prisma ORM, BullMQ, ioredis, Zod |
| **Database & Cache** | PostgreSQL 16 (Relational state), Redis 7 (Queues, AOF persistence, sliding rate limits) |
| **Search Engine** | Elasticsearch 8.13 (Email full-text search with DB fallback) |
| **Queue Monitoring** | Bull-Board UI (`/admin/queues`) |
| **SMTP Delivery** | Nodemailer with Ethereal Email (Fake SMTP) & real SMTP support |
| **Containerization** | Docker, Docker Compose (`shreya6006/*`) |
