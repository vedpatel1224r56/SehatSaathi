const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-notification-test-"));
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

test("notification settings and plan reminders work end to end", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const register = await call("POST", "/api/auth/register", {
      name: "Reminder Patient",
      email: "reminder.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(register.status, 200);
    const token = register.body.token;

    const defaultSettings = await call("GET", "/api/notification-settings", null, token);
    assert.equal(defaultSettings.status, 200);
    assert.equal(defaultSettings.body.settings.planReminders, true);

    const updatedSettings = await call(
      "PUT",
      "/api/notification-settings",
      {
        dailyReminderTime: "00:00",
        planReminders: true,
        followupNudges: false,
        visitReminders: false,
        labReminders: false,
      },
      token,
    );
    assert.equal(updatedSettings.status, 200);
    assert.equal(updatedSettings.body.settings.dailyReminderTime, "00:00");
    assert.equal(updatedSettings.body.settings.followupNudges, false);

    const plan = await call(
      "PUT",
      "/api/health-plan",
      {
        focusKey: "diabetes",
        title: "Diabetes action plan",
        subtitle: "Stay steady this week",
        goal: "Walk and log sugar",
        focusTitle: "Diabetes focus",
        focusSummary: "Keep the sugar trend visible",
        progress: {},
      },
      token,
    );
    assert.equal(plan.status, 200);

    const notifications = await call("GET", "/api/notifications?limit=20", null, token);
    assert.equal(notifications.status, 200);
    const planReminder = notifications.body.notifications.find((item) => item.type === "plan_reminder");
    assert.ok(planReminder);
    assert.equal(planReminder.title, "Plan reminder");
  } finally {
    await cleanup();
  }
});
