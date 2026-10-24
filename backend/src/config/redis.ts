import Redis, { RedisOptions } from 'ioredis';

const rawRedisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || '';
const redisUrl = rawRedisUrl.trim().replace(/^['"]|['"]$/g, '');
const redisHost = (process.env.REDIS_HOST || process.env.REDISHOST || 'localhost').trim();
const redisPort = parseInt((process.env.REDIS_PORT || process.env.REDISPORT || '6379').trim(), 10);
const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || undefined;
const redisUsername = process.env.REDIS_USER || process.env.REDISUSER || undefined;

let parsedOptions: RedisOptions = {
  host: redisHost,
  port: redisPort,
  username: redisUsername,
  password: redisPassword,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

if (redisUrl) {
  try {
    const u = new URL(redisUrl);
    parsedOptions = {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: true } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch (e) {
    console.warn('[Redis] Could not parse REDIS_URL as URL, falling back to host/port configs');
  }
}

export const redisConnectionOptions = parsedOptions;

export const redisClient = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log(`[Redis] Connected successfully (${redisUrl ? 'via REDIS_URL' : `${parsedOptions.host}:${parsedOptions.port}`})`);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection Error:', err.message);
});

export default redisClient;
