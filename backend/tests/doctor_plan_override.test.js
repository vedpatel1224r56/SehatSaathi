const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

const bootstrap = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "health-app-doctor-plan-test-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PROVIDER = "sqlite";
  process.env.DATABASE_URL = "";
  process.env.DB_PATH = path.join(tmpRoot, "health.db");
  process.env.UPLOAD_DIR = path.join(tmpRoot, "uploads");
  process.env.PASSWORD_RESET_OTP_OUTBOX_PATH = path.join(tmpRoot, "outbox", "otp.log");
  process.env.PASSWORD_RESET_OUTBOX_PATH = path.join(tmpRoot, "outbox", "reset.log");
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.CORS_ORIGINS = "http://localhost:5173,http://localhost:5174";

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

const nextIndiaSlotIso = ({ weekday, hour, minute = 0 }) => {
  const now = new Date();
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const parts = Object.fromEntries(nowParts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentWeekday = weekdayMap[parts.weekday];
  const [year, month, day] = [parts.year, parts.month, parts.day].map(Number);
  const indiaTodayUtc = new Date(Date.UTC(year, month - 1, day));
  let delta = (weekday - currentWeekday + 7) % 7;
  if (delta === 0) delta = 7;
  indiaTodayUtc.setUTCDate(indiaTodayUtc.getUTCDate() + delta);
  const targetYear = indiaTodayUtc.getUTCFullYear();
  const targetMonth = String(indiaTodayUtc.getUTCMonth() + 1).padStart(2, "0");
  const targetDay = String(indiaTodayUtc.getUTCDate()).padStart(2, "0");
  const targetHour = String(hour).padStart(2, "0");
  const targetMinute = String(minute).padStart(2, "0");
  return new Date(`${targetYear}-${targetMonth}-${targetDay}T${targetHour}:${targetMinute}:00+05:30`).toISOString();
};

test("doctor override keeps AI-only plans independent and returns the adjusted version back to the patient", async () => {
  const { call, cleanup } = await bootstrap();
  try {
    const adminLogin = await call("POST", "/api/auth/login", {
      email: "admin@sehatsaathi.local",
      password: "Admin@12345",
    });
    assert.equal(adminLogin.status, 200);

    const departmentsResponse = await call("GET", "/api/departments");
    assert.equal(departmentsResponse.status, 200);
    const generalDepartment = departmentsResponse.body.departments[0];
    assert.ok(generalDepartment?.id);

    const createDoctor = await call(
      "POST",
      "/api/admin/doctors",
      {
        name: "Plan Review Doctor",
        email: "plan.review.doctor@example.com",
        password: "Doctor@12345",
        departmentId: generalDepartment.id,
        qualification: "MBBS",
        inPersonFee: 300,
        chatFee: 250,
        videoFee: 400,
        audioFee: 350,
      },
      adminLogin.body.token,
    );
    assert.equal(createDoctor.status, 201);
    const doctorId = createDoctor.body.doctor.id;

    const setAvailability = await call(
      "PUT",
      `/api/doctors/${doctorId}/availability`,
      {
        schedules: [{ weekday: 1, startTime: "10:00", endTime: "12:00", slotMinutes: 30 }],
      },
      adminLogin.body.token,
    );
    assert.equal(setAvailability.status, 200);

    const patientRegister = await call("POST", "/api/auth/register", {
      name: "Plan Review Patient",
      email: "plan.review.patient@example.com",
      password: "Patient@123",
    });
    assert.equal(patientRegister.status, 200);
    const patientToken = patientRegister.body.token;

    const initialPlanSave = await call(
      "PUT",
      "/api/health-plan",
      {
        focusKey: "diabetes",
        title: "Sugar action plan",
        subtitle: "Keep your follow-up practical",
        goal: "Keep one useful sugar update visible",
        focusTitle: "Sugar-related follow-up",
        focusSummary: "This plan focuses first on sugar-related findings while keeping the other report areas visible.",
        progress: {},
      },
      patientToken,
    );
    assert.equal(initialPlanSave.status, 200);
    assert.equal(initialPlanSave.body.plan.planSource, "ai");
    assert.deepEqual(initialPlanSave.body.plan.doctorOverride, {});

    const appointmentCreate = await call(
      "POST",
      "/api/appointments",
      {
        doctorId,
        departmentId: generalDepartment.id,
        reason: "Need help reviewing sugar-related report follow-up",
        scheduledAt: nextIndiaSlotIso({ weekday: 1, hour: 10, minute: 0 }),
      },
      patientToken,
    );
    assert.equal(appointmentCreate.status, 200);
    const appointmentId = appointmentCreate.body.appointment.id;

    const doctorLogin = await call("POST", "/api/auth/login", {
      email: "plan.review.doctor@example.com",
      password: "Doctor@12345",
    });
    assert.equal(doctorLogin.status, 200);
    const doctorToken = doctorLogin.body.token;

    const doctorLoadsDraft = await call(
      "GET",
      `/api/appointments/${appointmentId}/health-plan`,
      null,
      doctorToken,
    );
    assert.equal(doctorLoadsDraft.status, 200);
    assert.equal(doctorLoadsDraft.body.plan.planSource, "ai");

    const adjustedTasks = [
      {
        id: "doctor_task_1",
        label: "Bring prior HbA1c or glucose reports",
        note: "Prior reports can help compare whether this result is stable or changing.",
        origin: "doctor",
        editedByDoctor: true,
      },
      {
        id: "doctor_task_2",
        label: "Keep one recent sugar reading visible",
        note: "If available, keep one recent sugar reading ready for follow-up.",
        origin: "doctor",
        editedByDoctor: true,
      },
    ];

    const doctorAdjustsPlan = await call(
      "PATCH",
      `/api/appointments/${appointmentId}/health-plan`,
      {
        reviewStatus: "doctor_adjusted",
        doctorNotes: "Focus on the sugar-related follow-up first.",
        reviewTimingNote: "A medical follow-up may help when you have one or two fresh readings ready.",
        tasks: adjustedTasks,
      },
      doctorToken,
    );
    assert.equal(doctorAdjustsPlan.status, 200);
    assert.equal(doctorAdjustsPlan.body.planSource, "doctor_adjusted");
    assert.equal(doctorAdjustsPlan.body.doctorOverride.tasks.length, 2);

    const patientSeesAdjustedPlan = await call(
      "GET",
      "/api/health-plan?focusKey=diabetes",
      null,
      patientToken,
    );
    assert.equal(patientSeesAdjustedPlan.status, 200);
    assert.equal(patientSeesAdjustedPlan.body.plan.planSource, "doctor_adjusted");
    assert.equal(patientSeesAdjustedPlan.body.plan.doctorNotes, "Focus on the sugar-related follow-up first.");
    assert.equal(
      patientSeesAdjustedPlan.body.plan.doctorOverride.reviewTimingNote,
      "A medical follow-up may help when you have one or two fresh readings ready.",
    );
    assert.deepEqual(
      patientSeesAdjustedPlan.body.plan.doctorOverride.tasks.map((task) => task.label),
      adjustedTasks.map((task) => task.label),
    );

    const patientSavesProgress = await call(
      "PUT",
      "/api/health-plan",
      {
        focusKey: "diabetes",
        title: "Sugar action plan",
        subtitle: "Keep your follow-up practical",
        goal: "Keep one useful sugar update visible",
        focusTitle: "Sugar-related follow-up",
        focusSummary: "This plan focuses first on sugar-related findings while keeping the other report areas visible.",
        progress: {
          "2026-05-05": {
            doctor_task_1: true,
          },
        },
      },
      patientToken,
    );
    assert.equal(patientSavesProgress.status, 200);
    assert.equal(patientSavesProgress.body.plan.planSource, "doctor_adjusted");
    assert.equal(patientSavesProgress.body.plan.doctorOverride.tasks.length, 2);
    assert.equal(patientSavesProgress.body.plan.progress["2026-05-05"].doctor_task_1, true);
  } finally {
    await cleanup();
  }
});
