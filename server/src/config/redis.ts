import IORedis from "ioredis";
import { RedisOptions } from "ioredis";

/**
 * Redis Configuration — Single Source of Truth
 *
 * Both the IORedis client (`redis`) and the BullMQ connection options
 * (`redisConnection`) are derived from the same parsed REDIS_URL.
 * This prevents config drift where one component connects to a different
 * Redis instance than the other (the original bug had `redis` using
 * REDIS_URL while `redisConnection` hardcoded localhost:6379).
 */

// Parse REDIS_URL to extract host, port, and password.
// Falls back to localhost:6379 when REDIS_URL is not set.
function parseRedisUrl(): { host: string; port: number; password?: string } {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return { host: "localhost", port: 6379 };
  }

  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      // redis:// URLs encode password in the "password" field (redis://:secret@host:port)
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    };
  } catch {
    // If REDIS_URL is malformed, fall back to safe defaults rather than crashing.
    // Log a warning so operators can diagnose misconfiguration.
    console.warn(
      `[redis] Failed to parse REDIS_URL ("${redisUrl}"), falling back to localhost:6379`
    );
    return { host: "localhost", port: 6379 };
  }
}

const parsedConfig = parseRedisUrl();

/**
 * RedisOptions used by BullMQ queues and workers.
 *
 * maxRetriesPerRequest: null — BullMQ requires this to be null.
 * Without it, BullMQ throws "ReplyError: LOADING" when Redis is
 * still loading data on startup, because ioredis defaults to
 * retrying 20 times then giving up.
 */
export const redisConnection: RedisOptions = {
  host: parsedConfig.host,
  port: parsedConfig.port,
  ...(parsedConfig.password ? { password: parsedConfig.password } : {}),
  maxRetriesPerRequest: null,
};

/**
 * Shared IORedis client instance for direct Redis operations.
 * Uses the same parsed config as redisConnection for consistency.
 */
export const redis = new IORedis(redisConnection);
