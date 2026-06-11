const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-lab-desk-test-"));
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
    const hasJsonBody = payload !== undefined && payload !== null && !(payload instanceof Buffer);
    const response = await fastify.inject({
      method,
      url,
      headers: {
        ...(hasJsonBody ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      payload: hasJsonBody ? JSON.stringify(payload) : payload,
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

const buildMultipartPdfPayload = () => {
  const boundary = "----SehatSaathiLabDeskBoundary";
  const pdf = "%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="lab-report.pdf"\r\n` +
    `Content-Type: application/pdf\r\n\r\n` +
    `${pdf}\r\n` +
    `--${boundary}--\r\n`;
  return {
    body: Buffer.from(body, "utf8"),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

test("lab desk can upload a patient report into the shared record pipeline", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const adminLogin = await call("POST", "/api/auth/login", {
      email: "admin@sehatsaathi.local",
      password: "Admin@12345",
    });
    assert.equal(adminLogin.status, 200);

    const patientRegister = await call("POST", "/api/auth/register", {
      name: "Lab Desk Patient",
      email: "lab.desk.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(patientRegister.status, 200);
    const patientToken = patientRegister.body.token;
    const patientId = patientRegister.body.user.id;

    const patientSearch = await call(
      "GET",
      "/api/admin/patients?q=lab.desk.patient@example.com",
      null,
      adminLogin.body.token,
    );
    assert.equal(patientSearch.status, 200);
    assert.ok(patientSearch.body.patients.some((item) => Number(item.id) === Number(patientId)));

    const batchMap = await call(
      "POST",
      "/api/admin/lab-desk/patient-matches",
      {
        rows: [{ name: "Lab Desk Patient", email: "lab.desk.patient@example.com" }],
      },
      adminLogin.body.token,
    );
    assert.equal(batchMap.status, 200);
    assert.equal(batchMap.body.results[0].status, "matched");

    const multipart = buildMultipartPdfPayload();
    const upload = await call(
      "POST",
      `/api/admin/lab-desk/patients/${patientId}/records`,
      multipart.body,
      adminLogin.body.token,
      { "content-type": multipart.contentType },
    );
    assert.equal(upload.status, 200);
    assert.equal(upload.body.ok, true);
    assert.equal(upload.body.patient.id, patientId);

    const records = await call("GET", "/api/records", null, patientToken);
    assert.equal(records.status, 200);
    assert.equal(records.body.records.length, 1);
    assert.equal(records.body.records[0].source, "lab_upload");
    assert.equal(records.body.records[0].source_label, "Lab upload");

    const uploads = await call("GET", "/api/admin/lab-desk/uploads", null, adminLogin.body.token);
    assert.equal(uploads.status, 200);
    assert.ok(uploads.body.uploads.some((item) => Number(item.patient.id) === Number(patientId)));

    const createdFromDesk = await call(
      "POST",
      "/api/admin/lab-desk/patients",
      {
        name: "Desk Created Patient",
        phone: "9898989898",
      },
      adminLogin.body.token,
    );
    assert.equal(createdFromDesk.status, 200);
    assert.ok(createdFromDesk.body.patient.patient_uid);
  } finally {
    await cleanup();
  }
});
