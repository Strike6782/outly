import { prisma } from "../config/prisma";
import { redis } from "../config/redis";

/** Result of a dependency health probe used by /health and the heartbeat. */
export type HealthStatus = {
  ok: boolean;
  database: "up" | "down";
  redis: "up" | "down";
};

/**
 * Verify PostgreSQL and Redis are reachable.
 * Used by the public /health route and the Healthchecks.io heartbeat.
 */
export async function checkHealth(): Promise<HealthStatus> {
  let database: "up" | "down" = "down";
  let redisStatus: "up" | "down" = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  try {
    const pong = await redis.ping();
    redisStatus = pong === "PONG" ? "up" : "down";
  } catch {
    redisStatus = "down";
  }

  return {
    ok: database === "up" && redisStatus === "up",
    database,
    redis: redisStatus,
  };
}
