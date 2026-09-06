import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Public DSN for captapi / inbox-wingman (EU ingest). Safe in the client bundle. */
export const SENTRY_DSN =
  "https://e24998105a69243673ff12cfd24547d8@o4511472681091072.ingest.de.sentry.io/4512040738816080";

export function sentryDsn(): string {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || SENTRY_DSN;
}

/** Off only when SENTRY_ENABLED=false. */
export function sentryEnabled(): boolean {
  return process.env.SENTRY_ENABLED !== "false";
}

export function sentryEnvironment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function redactEmails(value: string): string {
  return value.replace(EMAIL_RE, "[email]");
}

/** Drop Gmail bodies, tokens, and addresses before anything leaves the process. */
export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    if (event.request.query_string) event.request.query_string = "[Filtered]";
    if (typeof event.request.url === "string") {
      try {
        const url = new URL(event.request.url);
        url.search = "";
        url.hash = "";
        event.request.url = url.toString();
      } catch {
        event.request.url = "[Filtered]";
      }
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    delete event.user.geo;
  }

  if (typeof event.message === "string") {
    event.message = redactEmails(event.message);
  }

  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactEmails(ex.value);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? redactEmails(crumb.message) : crumb.message,
      data: undefined,
    }));
  }

  return event;
}
