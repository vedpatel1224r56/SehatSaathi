const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-analytics-test-"));
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

test("plan creation records analytics events", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const register = await call("POST", "/api/auth/register", {
      name: "Analytics Patient",
      email: "analytics.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(register.status, 200);
    const token = register.body.token;

    const planSave = await call(
      "PUT",
      "/api/health-plan",
      {
        focusKey: "diabetes",
        title: "Diabetes action plan",
        subtitle: "Stay steady",
        goal: "Walk and log sugar",
        focusTitle: "Diabetes focus",
        focusSummary: "Keep the sugar trend visible",
        progress: {},
      },
      token,
    );
    assert.equal(planSave.status, 200);

    const exportData = await call("GET", "/api/privacy/export", null, token);
    assert.equal(exportData.status, 200);
    const eventNames = (exportData.body.analyticsEvents || []).map((item) => item.eventName || item.event_name);
    assert.ok(eventNames.includes("plan_started"));
  } finally {
    await cleanup();
  }
});
