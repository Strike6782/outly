import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-queue";

/**
 * BullMQ email queue — configured for durability and fault tolerance.
 *
 * WHY removeOnComplete: false — Retaining completed job metadata enables
 * debugging and audit trails. Without this, completed jobs vanish from Redis
 * and you lose visibility into what was sent.
 *
 * WHY removeOnFail: false — Failed jobs are kept for inspection and manual
 * retry. Operators can examine why a job failed and re-enqueue it.
 *
 * WHY attempts: 3 with exponential backoff — Transient failures (SMTP timeout,
 * DB connection blip) are retried automatically. Exponential backoff prevents
 * hammering a struggling service.
 */
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,

  defaultJobOptions: {
    // Retain completed jobs for 24 hours (max 1000) for debugging,
    // then auto-remove to prevent unbounded Redis memory growth.
    removeOnComplete: { age: 86400, count: 1000 },
    // Retain failed jobs for 7 days (max 500) for inspection and manual retry.
    removeOnFail: { age: 604800, count: 500 },
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s → 10s → 20s
    },
  },
});
