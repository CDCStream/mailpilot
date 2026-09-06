import * as Sentry from "@sentry/nextjs";
import {
  scrubSentryEvent,
  sentryDsn,
  sentryEnabled,
  sentryEnvironment,
} from "@/lib/sentry";

Sentry.init({
  dsn: sentryDsn(),
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
