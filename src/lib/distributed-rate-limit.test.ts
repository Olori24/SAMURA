import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execute, isDatabaseConfigured, checkRateLimit } = vi.hoisted(() => ({
  execute: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
}));
vi.mock("@/db", () => ({
  getDb: () => ({ execute }),
  isDatabaseConfigured,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));

import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  isDatabaseConfigured.mockReturnValue(true);
  execute.mockResolvedValue({ rows: [{ requestCount: 1, retryAfterSeconds: 60 }] });
  checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkDistributedRateLimit", () => {
  it("allows requests while the shared counter is below the limit", async () => {
    execute.mockResolvedValue({ rows: [{ requestCount: 2, retryAfterSeconds: 43 }] });

    await expect(checkDistributedRateLimit("user:123:chat", 3, 60_000)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("blocks requests after the shared counter exceeds the limit", async () => {
    execute.mockResolvedValue({ rows: [{ requestCount: 4, retryAfterSeconds: 17 }] });

    await expect(checkDistributedRateLimit("user:123:chat", 3, 60_000)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 17,
    });
  });

  it("fails closed in production when the shared store throws", async () => {
    execute.mockRejectedValue(new Error("database unavailable"));

    await expect(checkDistributedRateLimit("user:123:images", 2, 60_000)).resolves.toMatchObject({
      allowed: false,
      unavailable: true,
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("fails closed in production when database configuration is absent", async () => {
    isDatabaseConfigured.mockReturnValue(false);

    await expect(checkDistributedRateLimit("user:123:chat")).resolves.toMatchObject({
      allowed: false,
      unavailable: true,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("uses the in-memory fallback only outside production when the database is absent", async () => {
    vi.stubEnv("NODE_ENV", "test");
    isDatabaseConfigured.mockReturnValue(false);
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 9 });

    await expect(checkDistributedRateLimit("user:123:chat")).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 9,
    });
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid limits without querying the database", async () => {
    await expect(checkDistributedRateLimit("user:123:chat", 0, 60_000)).resolves.toMatchObject({
      allowed: false,
      unavailable: true,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed when the shared store returns no counter row", async () => {
    execute.mockResolvedValue({ rows: [] });

    await expect(checkDistributedRateLimit("user:123:chat")).resolves.toMatchObject({
      allowed: false,
      unavailable: true,
    });
  });
});
