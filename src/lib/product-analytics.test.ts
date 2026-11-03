import { describe, expect, it } from "vitest";
import { isSensitiveAnalyticsRoute } from "./product-analytics";

describe("isSensitiveAnalyticsRoute", () => {
  it("blocks the password reset route", () => {
    expect(isSensitiveAnalyticsRoute("/reset-password")).toBe(true);
    expect(isSensitiveAnalyticsRoute("/reset-password/confirm")).toBe(true);
  });

  it("blocks URLs carrying credentials or OAuth callback parameters", () => {
    expect(isSensitiveAnalyticsRoute("/login", "?token=secret-value")).toBe(true);
    expect(isSensitiveAnalyticsRoute("/callback", "?access_token=secret-value")).toBe(true);
    expect(isSensitiveAnalyticsRoute("/callback", "?Code=temporary-value&state=opaque-value")).toBe(true);
  });

  it("allows ordinary application routes and non-secret query parameters", () => {
    expect(isSensitiveAnalyticsRoute("/chat")).toBe(false);
    expect(isSensitiveAnalyticsRoute("/studio/connect", "?github=connected")).toBe(false);
  });
});
