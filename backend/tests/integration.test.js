const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-test-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PROVIDER = "sqlite";
  process.env.DATABASE_URL = "";
  process.env.DB_PATH = path.join(tmpRoot, "health.db");
  process.env.UPLOAD_DIR = path.join(tmpRoot, "uploads");
  process.env.PASSWORD_RESET_OTP_OUTBOX_PATH = path.join(tmpRoot, "outbox", "otp.log");
  process.env.PASSWORD_RESET_OUTBOX_PATH = path.join(tmpRoot, "outbox", "reset.log");
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.CORS_ORIGINS = "http://localhost:5173";

  delete require.cache[require.resolve("../src/server")];
  const { fastify, initDb } = require("../src/server");
  await initDb();
  await fastify.ready();

  const call = async (method, url, payload, token, headers = {}) => {
    const baseHeaders = payload ? { "content-type": "application/json" } : {};
    const response = await fastify.inject({
      method,
      url,
      headers: {
        ...baseHeaders,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      payload: payload ? JSON.stringify(payload) : undefined,
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

test("auth refresh, logout-all invalidation, and idempotent marketplace create", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const register = await call("POST", "/api/auth/register", {
      name: "Test Patient",
      email: "test.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(register.status, 200);
    assert.ok(register.body.token);
    assert.ok(register.body.refreshToken);

    const login = await call("POST", "/api/auth/login", {
      email: "test.patient@example.com",
      password: "Patient@123",
      consentBundle: {
        policyVersion: "2026-04-11",
        items: [
          { consentType: "signup_ai_guidance_notice", accepted: true },
          { consentType: "signup_health_data_processing", accepted: true },
          { consentType: "signup_terms_privacy_age", accepted: true },
        ],
      },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.consentRecorded, 3);
    assert.ok(login.body.token);
    assert.ok(login.body.refreshToken);

    const refresh = await call("POST", "/api/auth/refresh", {
      refreshToken: login.body.refreshToken,
    });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.token);
    assert.ok(refresh.body.refreshToken);
    assert.ok(refresh.body.sessionId);

    const meBefore = await call("GET", "/api/auth/me", null, login.body.token);
    assert.equal(meBefore.status, 200);

    const sessionsBeforeLogout = await call(
      "GET",
      "/api/auth/sessions",
      null,
      refresh.body.token,
      { "x-session-id": String(refresh.body.sessionId) },
    );
    assert.equal(sessionsBeforeLogout.status, 200);
    assert.ok(Array.isArray(sessionsBeforeLogout.body.sessions));
    assert.ok(sessionsBeforeLogout.body.sessions.some((session) => session.isCurrent === true));

    const req1 = await call(
      "POST",
      "/api/marketplace/requests",
      {
        requestType: "pharmacy",
        partnerId: 1,
        serviceName: "Prescription fulfilment",
        fulfillmentMode: "home_delivery",
        listedPrice: 25,
      },
      refresh.body.token,
      { "idempotency-key": "test-marketplace-1", "content-type": "application/json" },
    );
    assert.equal(req1.status, 200);
    assert.ok(req1.body.request?.id);

    const req2 = await call(
      "POST",
      "/api/marketplace/requests",
      {
        requestType: "pharmacy",
        partnerId: 1,
        serviceName: "Prescription fulfilment",
        fulfillmentMode: "home_delivery",
        listedPrice: 25,
      },
      refresh.body.token,
      { "idempotency-key": "test-marketplace-1", "content-type": "application/json" },
    );
    assert.equal(req2.status, 200);
    assert.equal(req1.body.request.id, req2.body.request.id);

    const forbidden = await call("GET", "/api/admin/users", null, refresh.body.token);
    assert.equal(forbidden.status, 403);

    const logoutAll = await call("POST", "/api/auth/logout-all", null, login.body.token);
    assert.equal(logoutAll.status, 200);

    const meAfter = await call("GET", "/api/auth/me", null, login.body.token);
    assert.equal(meAfter.status, 401);
  } finally {
    await cleanup();
  }
});

test("logout revokes one session and refresh rotation exposes active sessions", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const register = await call("POST", "/api/auth/register", {
      name: "Session Patient",
      email: "session.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(register.status, 200);
    assert.ok(register.body.sessionId);

    const refresh = await call("POST", "/api/auth/refresh", {
      refreshToken: register.body.refreshToken,
    });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.sessionId);
    assert.notEqual(refresh.body.sessionId, register.body.sessionId);

    const sessions = await call(
      "GET",
      "/api/auth/sessions",
      null,
      refresh.body.token,
      { "x-session-id": String(refresh.body.sessionId) },
    );
    assert.equal(sessions.status, 200);
    assert.ok(sessions.body.sessions.length >= 2);

    const currentSession = sessions.body.sessions.find((session) => session.isCurrent);
    assert.ok(currentSession);

    const oldSession = sessions.body.sessions.find((session) => Number(session.id) === Number(register.body.sessionId));
    assert.ok(oldSession);
    assert.ok(oldSession.revokedAt);

    const logout = await call("POST", "/api/auth/logout", {
      refreshToken: refresh.body.refreshToken,
    });
    assert.equal(logout.status, 200);

    const refreshAfterLogout = await call("POST", "/api/auth/refresh", {
      refreshToken: refresh.body.refreshToken,
    });
    assert.equal(refreshAfterLogout.status, 401);
  } finally {
    await cleanup();
  }
});

test("policy bundle, support requests, and privacy export include trust data", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const register = await call("POST", "/api/auth/register", {
      name: "Trust Patient",
      email: "trust.patient@example.com",
      password: "Patient@123",
      consentBundle: {
        policyVersion: "2026-04-11",
        acceptedAt: "2026-06-03T10:00:00.000Z",
        items: [
          { consentType: "signup_ai_guidance_notice", accepted: true },
          { consentType: "signup_health_data_processing", accepted: true },
          { consentType: "signup_terms_privacy_age", accepted: true },
        ],
      },
    });
    assert.equal(register.status, 200);
    assert.equal(register.body.consentRecorded, 3);

    const policies = await call("GET", "/api/policies");
    assert.equal(policies.status, 200);
    assert.equal(policies.body.policyVersion, "2026-04-11");
    assert.ok(Array.isArray(policies.body.privacy.points));

    const consent = await call(
      "POST",
      "/api/consent",
      {
        consentType: "platform_safety_notice",
        policyVersion: "2026-04-11",
        accepted: true,
      },
      register.body.token,
    );
    assert.equal(consent.status, 200);

    const support = await call(
      "POST",
      "/api/support/requests",
      {
        category: "reports",
        subject: "Need help with report review",
        message: "The report summary looks cautious and I need help understanding what to do next.",
        sourceScreen: "alerts",
        severity: "normal",
      },
      register.body.token,
    );
    assert.equal(support.status, 200);
    assert.ok(support.body.request?.id);

    const supportList = await call("GET", "/api/support/requests", null, register.body.token);
    assert.equal(supportList.status, 200);
    assert.equal(supportList.body.requests.length, 1);

    const privacyExport = await call("GET", "/api/privacy/export", null, register.body.token);
    assert.equal(privacyExport.status, 200);
    assert.equal(privacyExport.body.consentLogs.length, 4);
    assert.ok(
      privacyExport.body.consentLogs.some((item) => item.consentType === "signup_health_data_processing"),
    );
    assert.equal(privacyExport.body.supportRequests.length, 1);
  } finally {
    await cleanup();
  }
});
