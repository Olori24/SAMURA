import * as Sentry from "@sentry/nextjs";
import { initializeProductAnalytics, isSensitiveAnalyticsRoute } from "@/lib/product-analytics";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Never initialize analytics while a bearer token is present in the URL.
// The app can initialize after navigation to a clean route.
if (typeof window !== "undefined" && !isSensitiveAnalyticsRoute(window.location.pathname, window.location.search)) {
  initializeProductAnalytics();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
