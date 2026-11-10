import { describe, expect, it } from "vitest";
import { isSensitiveAnalyticsRoute, POSTHOG_DEFAULTS, sanitizeAnalyticsEvent, sanitizeAnalyticsUrlProperties } from "./product-analytics";

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


describe("sanitizeAnalyticsUrlProperties", () => {
  it("removes query strings and fragments from nested SDK URL properties", () => {
    const properties: Record<string, unknown> = {
      "$current_url": "https://samura.test/login?email=private@example.com#reset",
      "$web_vitals_FCP_event": {
        "$current_url": "https://samura.test/login?email=private@example.com",
        "$referrer": "https://example.test/path?token=secret",
        "$pathname": "/login",
      },
    };
    sanitizeAnalyticsUrlProperties(properties);
    expect(properties["$current_url"]).toBe("https://samura.test/login");
    expect(properties["$web_vitals_FCP_event"]).toEqual({
      "$current_url": "https://samura.test/login",
      "$referrer": "https://example.test/path",
      "$pathname": "/login",
    });
  });

  it("sanitizes the complete analytics event, including nested $set_once URLs", () => {
    const event = {
      properties: { "$current_url": "https://samura.test/chat?token=private" },
      $set_once: {
        profile_url: "https://samura.test/profile?email=private@example.com#top",
        nested: { referrer_url: "https://example.test/?access_token=secret" },
      },
    };
    sanitizeAnalyticsEvent(event);
    expect(event.properties["$current_url"]).toBe("https://samura.test/chat");
    expect(event.$set_once).toEqual({
      profile_url: "https://samura.test/profile",
      nested: { referrer_url: "https://example.test/" },
    });
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
