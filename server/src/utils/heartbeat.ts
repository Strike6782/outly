/**
 * Healthchecks.io dead man's switch integration.
 * Pings an external URL on a schedule so you get email alerts when Outly stops.
 */

const PING_URL = process.env.HEALTHCHECKS_PING_URL?.trim();
const INTERVAL_MS = parseInt(process.env.HEALTHCHECKS_INTERVAL_MS || "300000", 10);
const REQUEST_TIMEOUT_MS = 10_000;

/** True when HEALTHCHECKS_PING_URL is set in the environment. */
export function isHeartbeatEnabled(): boolean {
  return Boolean(PING_URL);
}

/**
 * Notify Healthchecks.io of success or failure.
 * On failure, appends /fail to the ping URL per Healthchecks.io API.
 */
export async function pingHeartbeat(success: boolean): Promise<void> {
  if (!PING_URL) {
    return;
  }

  const url = success ? PING_URL : `${PING_URL.replace(/\/$/, "")}/fail`;

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[heartbeat] Ping failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("[heartbeat] Ping error:", error);
  }
}

/**
 * Start periodic heartbeat pings after an optional dependency check.
 * Runs once immediately, then on every HEALTHCHECKS_INTERVAL_MS (default 5 min).
 */
export function startHeartbeat(
  checkDependencies: () => Promise<boolean>,
): void {
  if (!PING_URL) {
    console.log("[heartbeat] Disabled — set HEALTHCHECKS_PING_URL in server/.env to enable");
    return;
  }

  const run = async (): Promise<void> => {
    const healthy = await checkDependencies();
    await pingHeartbeat(healthy);
  };

  void run();

  setInterval(() => {
    run().catch((error) => console.error("[heartbeat] Error:", error));
  }, INTERVAL_MS);

  console.log(
    `[heartbeat] Healthchecks.io enabled (interval: ${INTERVAL_MS / 1000}s)`,
  );
}
