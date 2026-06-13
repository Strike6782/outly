import { Router } from "express";
import { checkHealth } from "../utils/healthCheck";

const router = Router();

/**
 * Public health endpoint for uptime monitoring and the heartbeat cron script.
 * No authentication — intended for local/cron checks only.
 */
router.get("/health", async (_req, res) => {
  const status = await checkHealth();

  res.status(status.ok ? 200 : 503).json({
    status: status.ok ? "healthy" : "unhealthy",
    database: status.database,
    redis: status.redis,
    timestamp: new Date().toISOString(),
  });
});

export default router;
