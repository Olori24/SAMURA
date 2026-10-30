import "server-only";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { loggerProvider } from "../../instrumentation";

const logger = loggerProvider?.getLogger("samura-posthog-logs");

type ConversationCreateOutcome = "created" | "rate_limited" | "service_unavailable" | "failed";

export function logConversationCreate(outcome: ConversationCreateOutcome, stage?: string) {
  logger?.emit({
    body: "conversation create completed",
    severityNumber: outcome === "failed" ? SeverityNumber.ERROR : SeverityNumber.INFO,
    attributes: {
      event: "conversation_create_completed",
      outcome,
      ...(stage ? { stage } : {}),
    },
  });
}

export async function flushPostHogLogs() {
  if (loggerProvider) {
    await loggerProvider.forceFlush().catch(() => undefined);
  }
}
