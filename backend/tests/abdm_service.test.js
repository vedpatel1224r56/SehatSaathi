const test = require("node:test");
const assert = require("node:assert/strict");

const { createAbdmService } = require("../src/services/abdmService");

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

test("ABDM stays safely disabled until all sandbox connection fields exist", async () => {
  const service = createAbdmService({
    fetch: async () => {
      throw new Error("fetch should not run");
    },
    enabled: false,
  });

  assert.deepEqual(service.getStatus(), {
    enabled: false,
    configured: false,
    sessionConfigured: false,
    verificationConfigured: false,
    profileFetchConfigured: false,
    baseUrl: "",
    sessionPath: "/v0.5/sessions",
  });

  const result = await service.checkConnection();
  assert.equal(result.ok, false);
  assert.match(result.error, /not fully configured/i);
});

test("ABDM connection diagnostics request a session without exposing credentials", async () => {
  const calls = [];
  const service = createAbdmService({
    fetch: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, { accessToken: "sandbox-token", expiresIn: 1200 });
    },
    nowIso: () => "2026-06-10T10:00:00.000Z",
    enabled: true,
    baseUrl: "https://sandbox.example",
    clientId: "client-id",
    clientSecret: "client-secret",
    sessionPath: "/sessions",
    abhaVerifyUrl: "/verify",
    abhaProfileUrl: "/profile",
  });

  const result = await service.checkConnection();

  assert.equal(result.ok, true);
  assert.equal(result.configured, true);
  assert.equal(result.verificationConfigured, true);
  assert.equal(result.profileFetchConfigured, true);
  assert.equal(result.checkedAt, "2026-06-10T10:00:00.000Z");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://sandbox.example/sessions");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    clientId: "client-id",
    clientSecret: "client-secret",
  });
  assert.equal("clientSecret" in result, false);
  assert.equal("token" in result, false);
});

test("ABDM never marks an identity verified from an ambiguous response", async () => {
  let requestCount = 0;
  const service = createAbdmService({
    fetch: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return jsonResponse(200, { accessToken: "sandbox-token", expiresIn: 1200 });
      }
      return jsonResponse(200, { status: "pending", message: "OTP consent required" });
    },
    enabled: true,
    baseUrl: "https://sandbox.example",
    clientId: "client-id",
    clientSecret: "client-secret",
    sessionPath: "/sessions",
    abhaVerifyUrl: "/verify",
  });

  const result = await service.verifyAbhaIdentity({
    abhaNumber: "12345678901234",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "pending_verification");
  assert.equal(result.source, "abdm_pending");
  assert.match(result.notes, /OTP consent required/i);
});
