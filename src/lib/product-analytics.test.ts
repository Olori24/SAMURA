import { describe, expect, it } from "vitest";
import { isSensitiveAnalyticsRoute, POSTHOG_DEFAULTS } from "./product-analytics";

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


describe("POSTHOG_DEFAULTS", () => {
  it("captures pageleave and web vitals without enabling broad autocapture or session replay", () => {
    expect(POSTHOG_DEFAULTS).toMatchObject({
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      capture_performance: { web_vitals: true },
      disable_session_recording: true,
      capture_exceptions: false,
    });
  });
});
