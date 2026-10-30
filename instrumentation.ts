import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function posthogConfigurationError(variableName: string) {
  return new Error(
    `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
  );
}

if (!posthogProjectToken && process.env.NODE_ENV === "development") {
  throw posthogConfigurationError("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
}

if (posthogProjectToken && !posthogHost && process.env.NODE_ENV === "development") {
  throw posthogConfigurationError("NEXT_PUBLIC_POSTHOG_HOST");
}

export const loggerProvider = posthogProjectToken && posthogHost
  ? new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "samura-ai" }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: `${posthogHost.replace(/\/$/, "")}/i/v1/logs`,
            headers: {
              Authorization: `Bearer ${posthogProjectToken}`,
              "Content-Type": "application/json",
            },
          }),
        }),
      ],
    })
  : null;

export function register() {
  // The dedicated logger accesses this provider directly. Do not register it globally:
  // existing application loggers must remain outside this PostHog export.
}
