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
