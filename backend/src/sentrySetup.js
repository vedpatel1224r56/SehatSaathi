/**
 * sentrySetup.js
 * Optional Sentry integration — only activates when SENTRY_DSN env var is set.
 * Install with: npm install @sentry/node
 * Then set SENTRY_DSN=https://xxx@sentry.io/yyy in your Render env vars.
 */

let Sentry = null;
let sentryEnabled = false;

const DSN = (process.env.SENTRY_DSN || "").trim();

if (DSN) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: DSN,
      environment: process.env.NODE_ENV || "production",
      release: process.env.npm_package_version || "1.0.0",
      // Capture 20% of traces in production to stay on free tier
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
      integrations: [
        Sentry.httpIntegration(),
      ],
      beforeSend(event) {
        // Strip any health data from Sentry payloads — only send stack traces
        if (event.request?.data) {
          delete event.request.data;
        }
        return event;
      },
    });
    sentryEnabled = true;
    console.log("[Sentry] Initialised with DSN.");
  } catch (err) {
    console.warn("[Sentry] @sentry/node not installed — run: npm install @sentry/node");
    console.warn("[Sentry] Error monitoring falling back to local error_logs table.");
    Sentry = null;
  }
} else {
  console.log("[Sentry] SENTRY_DSN not set — using local error_logs table only.");
}

/**
 * Capture an exception to Sentry (if enabled) + always returns so callers don't break.
 */
function captureException(err, context = {}) {
  if (!sentryEnabled || !Sentry) return;
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: String(context.userId) });
    if (context.requestId) scope.setTag("requestId", String(context.requestId));
    if (context.path) scope.setTag("path", String(context.path));
    scope.setExtras(context);
    Sentry.captureException(err);
  });
}

/**
 * Capture a non-fatal message.
 */
function captureMessage(message, level = "warning", context = {}) {
  if (!sentryEnabled || !Sentry) return;
  Sentry.withScope((scope) => {
    scope.setExtras(context);
    Sentry.captureMessage(message, level);
  });
}

module.exports = { captureException, captureMessage, sentryEnabled };
