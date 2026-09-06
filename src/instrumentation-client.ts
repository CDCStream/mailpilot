import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, sentryDsn, sentryEnabled, sentryEnvironment } from "@/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || sentryDsn(),
  enabled: sentryEnabled(),
  environment: sentryEnvironment(),
  sendDefaultPii: false,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
    cookies: false,
    stackFrameVariables: false,
    genAI: { inputs: false, outputs: false },
  },
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,
  beforeSend: scrubSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
