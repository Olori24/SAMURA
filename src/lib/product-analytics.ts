"use client";

import posthog from "posthog-js";

export type ProductEvent =
  | "user_signed_in"
  | "user_signed_up"
  | "conversation_created"
  | "chat_message_sent"
  | "image_generated"
  | "document_saved"
  | "github_repository_inspected"
  | "github_patch_generated"
  | "github_patch_published"
  | "connector_action_completed";

type EventProperties = Record<string, string | number | boolean>;

const POSTHOG_DEFAULTS = {
  defaults: "2026-08-30" as const,
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_exceptions: false,
  disable_session_recording: true,
  person_profiles: "identified_only" as const,
};

export function isSensitiveAnalyticsRoute(pathname: string, search = "") {
  const normalizedPath = pathname.toLowerCase();
  const params = new URLSearchParams(search);
  const sensitiveQueryKeys = new Set(["token", "access_token", "refresh_token", "reset_token", "code", "state", "secret", "key"]);
  const hasSensitiveQuery = Array.from(params.keys()).some(key => sensitiveQueryKeys.has(key.toLowerCase()));
  return normalizedPath === "/reset-password"
    || normalizedPath.startsWith("/reset-password/")
    || hasSensitiveQuery;
}

export function initializeProductAnalytics() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host || posthog.__loaded) return;
  posthog.init(token, { api_host: host, ...POSTHOG_DEFAULTS });
}

function isReady() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && posthog.__loaded);
}

export function captureProductEvent(event: ProductEvent, properties?: EventProperties) {
  if (!isReady()) return;
  posthog.capture(event, properties);
}

export function identifyProductUser(userId: string) {
  if (!userId || !isReady()) return;
  posthog.identify(userId);
}

export function resetProductIdentity() {
  if (!isReady()) return;

  const wasOptedOut = posthog.has_opted_out_capturing();
  const wasOptedIn = posthog.has_opted_in_capturing();
  posthog.reset();

  if (wasOptedOut) posthog.opt_out_capturing();
  else if (wasOptedIn) posthog.opt_in_capturing();
}
