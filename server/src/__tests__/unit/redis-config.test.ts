/**
 * Redis Config Tests — Property-Based + Unit
 *
 * The Redis config module reads process.env.REDIS_URL at import time and
 * exports `redisConnection` (RedisOptions) and `redis` (IORedis instance).
 * We use jest.resetModules() between tests to re-import with different env values.
 */

import * as fc from "fast-check";

// Mock IORedis to prevent actual Redis connections during tests.
// The mock returns an object that mirrors the options it was constructed with,
// so we can inspect what config was passed to the client.
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation((opts: any) => ({
    ...opts,
    disconnect: jest.fn(),
  }));
});

describe("Redis Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * Feature: backend-smtp-email-sending, Property 20: REDIS_URL Parsing
   *
   * For any valid Redis URL with host, port, and optional password,
   * the parsed connection options should match the URL components.
   *
   * Validates: Requirements 9.1, 9.2, 9.5
   */
  it("Property 20: REDIS_URL parsing produces matching connection options", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("localhost", "redis.example.com", "10.0.0.1", "my-redis-host"),
        fc.integer({ min: 1, max: 65535 }),
        fc.option(
          fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)
        ),
        (host, port, password) => {
          // Reset module cache on every iteration so the module re-reads
          // process.env.REDIS_URL fresh each time (it runs at import time).
          jest.resetModules();

          // Build a valid Redis URL from the generated components
          const url = password
            ? `redis://:${password}@${host}:${port}`
            : `redis://${host}:${port}`;

          process.env.REDIS_URL = url;

          // Re-import the module with the new env value
          const { redisConnection } = require("../../config/redis");

          expect(redisConnection.host).toBe(host);
          expect(redisConnection.port).toBe(port);

          if (password) {
            expect(redisConnection.password).toBe(password);
          } else {
            expect(redisConnection.password).toBeUndefined();
          }

          // BullMQ requirement: maxRetriesPerRequest must always be null
          expect(redisConnection.maxRetriesPerRequest).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unit test: Missing REDIS_URL defaults to localhost:6379
   */
  it("defaults to localhost:6379 when REDIS_URL is not set", () => {
    delete process.env.REDIS_URL;

    const { redisConnection } = require("../../config/redis");

    expect(redisConnection.host).toBe("localhost");
    expect(redisConnection.port).toBe(6379);
    expect(redisConnection.password).toBeUndefined();
  });

  /**
   * Unit test: REDIS_URL with password includes password in options
   */
  it("includes password when REDIS_URL contains a password", () => {
    process.env.REDIS_URL = "redis://:mysecretpass@redis-host.example.com:6380";

    const { redisConnection } = require("../../config/redis");

    expect(redisConnection.host).toBe("redis-host.example.com");
    expect(redisConnection.port).toBe(6380);
    expect(redisConnection.password).toBe("mysecretpass");
  });

  /**
   * Unit test: maxRetriesPerRequest is null in all cases
   * BullMQ requires this to prevent "ReplyError: LOADING" on startup.
   */
  it("sets maxRetriesPerRequest to null (required by BullMQ)", () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    const { redisConnection } = require("../../config/redis");

    expect(redisConnection.maxRetriesPerRequest).toBeNull();
  });

  /**
   * Unit test: Malformed REDIS_URL falls back to localhost:6379
   */
  it("falls back to localhost:6379 for malformed REDIS_URL", () => {
    process.env.REDIS_URL = "not-a-valid-url";

    const { redisConnection } = require("../../config/redis");

    expect(redisConnection.host).toBe("localhost");
    expect(redisConnection.port).toBe(6379);
    expect(redisConnection.password).toBeUndefined();
  });
});
