import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPasswordRecoveryEmailConfigured, sendPasswordResetEmail } from "./auth-email";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RESEND_API_KEY", "test-resend-key");
  vi.stubEnv("SAMURA_EMAIL_FROM", "SAMURA <security@samura.example>");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("password recovery email", () => {
  it("requires the email provider, sender and canonical auth URL", () => {
    expect(isPasswordRecoveryEmailConfigured()).toBe(true);
    vi.stubEnv("RESEND_API_KEY", "");
    expect(isPasswordRecoveryEmailConfigured()).toBe(false);
  });

  it("refuses to send a reset URL with an untrusted origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPasswordResetEmail({
      to: "user@example.com",
      url: "https://attacker.example/reset?token=secret",
    })).rejects.toThrow("untrusted password recovery URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a transactional email through Resend without logging reset data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPasswordResetEmail({
      to: "user@example.com",
      url: "http://localhost:3000/api/auth/reset-password?token=one-time-token",
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-resend-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "SAMURA <security@samura.example>",
      to: ["user@example.com"],
      subject: "Reset your SAMURA password",
    });
    expect(init.cache).toBe("no-store");
  });

  it("rejects non-HTTPS reset links in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPasswordResetEmail({
      to: "user@example.com",
      url: "http://localhost:3000/reset-password?token=secret",
    })).rejects.toThrow("untrusted password recovery URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not include the provider response body in errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("private provider details", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPasswordResetEmail({
      to: "user@example.com",
      url: "http://localhost:3000/reset-password?token=secret",
    })).rejects.toThrow("HTTP 401");
  });
});
