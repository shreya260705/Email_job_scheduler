import Redis, { RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let parsedOptions: RedisOptions = {
  host: redisHost,
  port: redisPort,
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
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
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
