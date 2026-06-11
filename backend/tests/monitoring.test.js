const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-monitoring-test-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PROVIDER = "sqlite";
  process.env.DATABASE_URL = "";
  process.env.DB_PATH = path.join(tmpRoot, "health.db");
  process.env.UPLOAD_DIR = path.join(tmpRoot, "uploads");
  process.env.PASSWORD_RESET_OTP_OUTBOX_PATH = path.join(tmpRoot, "outbox", "otp.log");
  process.env.PASSWORD_RESET_OUTBOX_PATH = path.join(tmpRoot, "outbox", "reset.log");
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.CORS_ORIGINS = "http://localhost:5173";

  const { fastify, initDb } = require("../src/server");
  await initDb();
  await fastify.ready();

  const call = async (method, url, payload, token) => {
    const hasJsonBody = payload !== undefined && payload !== null;
    const response = await fastify.inject({
      method,
      url,
      headers: {
        ...(hasJsonBody ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      payload: hasJsonBody ? JSON.stringify(payload) : undefined,
    });

    return {
      status: response.statusCode,
      body: response.json(),
    };
  };

  const cleanup = async () => {
    await fastify.close();
  };

  return { call, cleanup };
};

test("client error monitoring endpoint accepts reports", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const first = await call("POST", "/api/client-errors", {
      source: "react.error_boundary",
      message: "Widget crashed",
      stack: "Error: Widget crashed\n    at Widget",
      componentStack: "\n    at Widget",
      fingerprint: "react.error_boundary:Widget crashed",
      metadata: { screen: "home" },
    });
    assert.equal(first.status, 202);
    assert.equal(first.body.ok, true);

    const invalid = await call("POST", "/api/client-errors", {
      source: "window.error",
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "Error message is required.");
  } finally {
    await cleanup();
  }
});
