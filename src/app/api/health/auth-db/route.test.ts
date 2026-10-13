import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        limit: async () => [],
      }),
    }),
  })),
  isDatabaseConfigured: vi.fn(() => true),
}));

vi.mock("@/db/schema", () => ({ users: { id: "id" } }));

import { GET } from "./route";
import { isDatabaseConfigured } from "@/db";

const originalSecret = process.env.HEALTH_CHECK_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.HEALTH_CHECK_SECRET;
  else process.env.HEALTH_CHECK_SECRET = originalSecret;
  vi.mocked(isDatabaseConfigured).mockReturnValue(true);
});

describe("GET /api/health/auth-db", () => {
  it("hides readiness details from anonymous callers", async () => {
    process.env.HEALTH_CHECK_SECRET = "test-health-secret-with-at-least-32-characters";
    const response = await GET(new Request("https://example.test/api/health/auth-db"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
  });

  it("hides readiness details when the health secret is missing or too short", async () => {
    delete process.env.HEALTH_CHECK_SECRET;
    const missing = await GET(new Request("https://example.test/api/health/auth-db", {
      headers: { authorization: "Bearer anything" },
    }));
    expect(missing.status).toBe(404);

    process.env.HEALTH_CHECK_SECRET = "short";
    const short = await GET(new Request("https://example.test/api/health/auth-db", {
      headers: { authorization: "Bearer short" },
    }));
    expect(short.status).toBe(404);
  });

  it("allows an authorized monitor to check readiness without returning records", async () => {
    const secret = "test-health-secret-with-at-least-32-characters";
    process.env.HEALTH_CHECK_SECRET = secret;
    const response = await GET(new Request("https://example.test/api/health/auth-db", {
      headers: { authorization: "Bearer " + secret },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns only generic unavailability for authorized monitoring", async () => {
    process.env.HEALTH_CHECK_SECRET = "test-health-secret-with-at-least-32-characters";
    vi.mocked(isDatabaseConfigured).mockReturnValue(false);
    const response = await GET(new Request("https://example.test/api/health/auth-db", {
      headers: { authorization: "Bearer test-health-secret-with-at-least-32-characters" },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
