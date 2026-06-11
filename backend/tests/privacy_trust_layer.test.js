const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-privacy-trust-test-"));
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
    const hasJsonBody = payload !== undefined && payload !== null;
    const response = await fastify.inject({
      method,
      url,
      headers: {
        ...(hasJsonBody ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      payload: hasJsonBody ? JSON.stringify(payload) : undefined,
    });

    let body = {};
    try {
      body = response.json();
    } catch {
      body = { raw: response.body };
    }

    return {
      status: response.statusCode,
      body,
    };
  };

  const cleanup = async () => {
    await fastify.close();
  };

  return { call, cleanup };
};

test("privacy export includes ABHA history and account deletion revokes access cleanly", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const register = await call("POST", "/api/auth/register", {
      name: "Privacy Patient",
      email: "privacy.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(register.status, 200);
    const token = register.body.token;
    const refreshToken = register.body.refreshToken;

    const saveProfile = await call(
      "POST",
      "/api/profile",
      {
        userId: register.body.user.id,
        fullName: "Privacy Patient",
        email: "privacy.patient@example.com",
        sex: "female",
        phone: "9876543210",
        maritalStatus: "single",
        dateOfBirth: "1995-04-06",
        bloodGroup: "O+",
        medications: ["Metformin 500 mg"],
        addressLine1: "42 Health Street",
        city: "Ahmedabad",
        state: "Gujarat",
        pinCode: "380001",
        abhaNumber: "12345678901234",
      },
      token,
    );
    assert.equal(saveProfile.status, 200);

    const savedProfile = await call(
      "GET",
      `/api/profile/${register.body.user.id}`,
      null,
      token,
    );
    assert.equal(savedProfile.status, 200);
    assert.deepEqual(savedProfile.body.profile.medications, ["Metformin 500 mg"]);

    const abhaStatus = await call("GET", "/api/abha/status", null, token);
    assert.equal(abhaStatus.status, 200);
    assert.equal(abhaStatus.body.mode, "self_reported");
    assert.equal(abhaStatus.body.verificationAvailable, false);

    const requestVerification = await call(
      "POST",
      "/api/abha/request-verification",
      null,
      token,
    );
    assert.equal(requestVerification.status, 503);
    assert.match(requestVerification.body.message, /saved as self-reported/i);

    const exportResponse = await call("GET", "/api/privacy/export", null, token);
    assert.equal(exportResponse.status, 200);
    assert.ok(Array.isArray(exportResponse.body.abhaHistory));
    assert.ok(exportResponse.body.abhaHistory.length >= 1);
    assert.equal(exportResponse.body.abhaHistory[0].action, "profile_updated");
    assert.ok(Array.isArray(exportResponse.body.medicalRecords));

    const deleteMe = await call("DELETE", "/api/privacy/me", null, token);
    assert.equal(deleteMe.status, 200);
    assert.equal(deleteMe.body.ok, true);

    const meAfterDelete = await call("GET", "/api/auth/me", null, token);
    assert.equal(meAfterDelete.status, 401);

    const refreshAfterDelete = await call("POST", "/api/auth/refresh", { refreshToken });
    assert.equal(refreshAfterDelete.status, 401);
  } finally {
    await cleanup();
  }
});
