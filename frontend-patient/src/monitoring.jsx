import React, { Component } from "react";
import { resolveApiBase } from "./patientOpsConfig";

const API_BASE = resolveApiBase();
const RECENT_REPORTS = new Map();
let monitoringInstalled = false;

const buildFingerprint = (source, message, stack = "") => {
  const base = `${source || "frontend"}:${message || "unknown"}:${String(stack).split("\n")[0] || ""}`;
  return base.trim().slice(0, 255);
};

const shouldSkipDuplicate = (fingerprint) => {
  const now = Date.now();
  const last = RECENT_REPORTS.get(fingerprint) || 0;
  if (now - last < 30_000) {
    return true;
  }
  RECENT_REPORTS.set(fingerprint, now);
  if (RECENT_REPORTS.size > 100) {
    for (const [key, value] of RECENT_REPORTS.entries()) {
      if (now - value > 5 * 60_000) {
        RECENT_REPORTS.delete(key);
      }
    }
  }
  return false;
};

export const captureClientError = async ({
  source = "frontend",
  message,
  stack = "",
  componentStack = "",
  severity = "error",
  metadata = {},
} = {}) => {
  const safeMessage = String(message || "").trim();
  if (!safeMessage) return;

  const payload = {
    source,
    severity,
    message: safeMessage.slice(0, 2000),
    stack: String(stack || "").slice(0, 20000),
    componentStack: String(componentStack || "").slice(0, 20000),
    url: typeof window !== "undefined" ? window.location.href : "",
    fingerprint: buildFingerprint(source, safeMessage, stack || componentStack || ""),
    metadata:
      metadata && typeof metadata === "object"
        ? {
            ...metadata,
            viewport:
              typeof window !== "undefined"
                ? {
                    width: window.innerWidth,
                    height: window.innerHeight,
                  }
                : null,
          }
        : {},
  };

  if (shouldSkipDuplicate(payload.fingerprint)) return;

  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("health_token") || "" : "";
  const requestUrl = `${API_BASE}/api/client-errors`;

  try {
    await fetch(requestUrl, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return;
  } catch (error) {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        navigator.sendBeacon(requestUrl, blob);
      } catch {
        // Final fallback is intentional no-op.
      }
    }
  }
};

export const installGlobalErrorMonitoring = () => {
  if (monitoringInstalled || typeof window === "undefined") return;
  monitoringInstalled = true;

  window.addEventListener("error", (event) => {
    captureClientError({
      source: "window.error",
      message: event.message || "Unhandled browser error",
      stack: event.error?.stack || "",
      metadata: {
        filename: event.filename || "",
        line: event.lineno || null,
        column: event.colno || null,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason?.message || "Unhandled promise rejection";
    captureClientError({
      source: "window.unhandledrejection",
      message,
      stack: reason?.stack || "",
    });
  });
};

export class PatientErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "", errorStack: "" };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    this.setState({
      errorMessage: error?.message || "Unknown render error",
      errorStack: error?.stack || info?.componentStack || "",
    });
    captureClientError({
      source: "react.error_boundary",
      message: error?.message || "React render crash",
      stack: error?.stack || "",
      componentStack: info?.componentStack || "",
    });
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="patient-error-screen">
          <div className="panel patient-error-panel">
            <div className="logo-mark">
              <img src="/sehatsaathi-logo.jpg" alt="SehatSaathi logo" />
            </div>
            <p className="history-headline">Something went wrong</p>
            <p className="micro">
              SehatSaathi hit an unexpected issue. We have logged it and you can safely refresh.
            </p>
            {import.meta.env.DEV && this.state.errorMessage ? (
              <div className="history-card" style={{ marginTop: 12, textAlign: "left" }}>
                <p className="history-headline">Debug details</p>
                <p className="micro">{this.state.errorMessage}</p>
                {this.state.errorStack ? (
                  <pre
                    className="micro"
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 220,
                      overflow: "auto",
                    }}
                  >
                    {this.state.errorStack}
                  </pre>
                ) : null}
              </div>
            ) : null}
            <button type="button" className="primary ghost" onClick={this.handleReload}>
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
