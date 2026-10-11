import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns a minimal non-sensitive health payload", async () => {
    const response = GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("samura-web");
    expect(payload.stage).toBe("foundation");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload).not.toHaveProperty("env");
    expect(payload).not.toHaveProperty("credentials");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
