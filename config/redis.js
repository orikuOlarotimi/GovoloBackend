const redisUrl = process.env.REDIS_URL;

let connection;

if (redisUrl) {
  const url = new URL(redisUrl);
  connection = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    // "rediss://" means TLS (used by external URLs and providers like Upstash)
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
} else {
  // local development fallback
  connection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

module.exports = { connection };