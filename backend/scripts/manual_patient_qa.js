const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function computeMomentum(progress = {}) {
  const today = new Date();
  let weeklyCompleted = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    weeklyCompleted += Object.values(progress[key] || {}).filter(Boolean).length;
  }

  let streakDays = 0;
  const cursor = new Date(today);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const taskMap = progress[key] || {};
    if (!Object.values(taskMap).some(Boolean)) break;
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { weeklyCompleted, streakDays };
}

function pickFocus(insights = {}) {
  const conditionSummaries = Array.isArray(insights.conditionSummaries) ? insights.conditionSummaries : [];
  const nonNormal = conditionSummaries.find((item) => item.zone === "high" || item.zone === "low");
  if (nonNormal) {
    return {
      focusKey: nonNormal.key,
      title: `${nonNormal.title || "Focused"} action plan`,
      subtitle: nonNormal.summary || "Keep this area easy to review this week.",
      goal: nonNormal.title || nonNormal.key,
      focusTitle: nonNormal.title || nonNormal.key,
      focusSummary: nonNormal.summary || "Keep this area visible this week.",
    };
  }

  const first = conditionSummaries[0];
  if (first) {
    return {
      focusKey: first.key,
      title: `${first.title || "Focused"} action plan`,
      subtitle: first.summary || "Keep this area steady this week.",
      goal: first.title || first.key,
      focusTitle: first.title || first.key,
      focusSummary: first.summary || "Keep this area steady this week.",
    };
  }

  return {
    focusKey: "goal:steady",
    title: "Steady action plan",
    subtitle: "Use one light weekly rhythm even when the report looks calm.",
    goal: "Steady",
    focusTitle: "Steady",
    focusSummary: "Keep one calm health rhythm visible this week.",
  };
}

async function main() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sehatsaathi-manual-qa-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PROVIDER = "sqlite";
  process.env.DATABASE_URL = "";
  process.env.DB_PATH = path.join(tmpRoot, "health.db");
  process.env.UPLOAD_DIR = path.join(tmpRoot, "uploads");
  process.env.FILE_STORAGE_MODE = "local";
  process.env.JWT_SECRET = "manual-qa-jwt-secret";
  process.env.JWT_EXPIRES_IN = "7d";
  process.env.CORS_ORIGINS = "http://localhost:5173";
  process.env.OPENAI_API_KEY = "";
  process.env.GEMINI_API_KEY = "";
  process.env.AI_PROVIDER = "gemini";

  delete require.cache[require.resolve("../src/server")];
  const { fastify, initDb } = require("../src/server");
  await initDb();

  const callJson = async (method, url, body, token) => {
    const response = await fastify.inject({
      method,
      url,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      payload: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.statusCode,
      body: response.json(),
    };
  };

  const uploadReport = async (url, filePath, token) => {
    const form = new FormData();
    const bytes = await fs.readFile(filePath);
    const file = new Blob([bytes], { type: mimeFor(filePath) });
    form.append("record", file, path.basename(filePath));
    const request = new Request("http://local.test/upload", {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const payload = Buffer.from(await request.arrayBuffer());
    const response = await fastify.inject({
      method: "POST",
      url,
      headers: {
        "content-type": request.headers.get("content-type"),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      payload,
    });
    return {
      status: response.statusCode,
      body: response.json(),
    };
  };

  const scenarios = [
    { name: "Aarav Sugar", email: "qa.aarav@example.com", file: "/Users/vedpatel/Desktop/Ops/test-assets/reports/01-hba1c-followup.pdf" },
    { name: "Meera CBC", email: "qa.meera@example.com", file: "/Users/vedpatel/Desktop/Ops/test-assets/reports/02-cbc-panel.pdf" },
    { name: "Kabir Thyroid", email: "qa.kabir@example.com", file: "/Users/vedpatel/Desktop/Ops/test-assets/reports/04-thyroid-profile.pdf" },
    { name: "Riya Lipid", email: "qa.riya@example.com", file: "/Users/vedpatel/Desktop/Ops/test-assets/reports/05-lipid-profile.pdf" },
    { name: "Dev Bundle", email: "qa.dev@example.com", file: "/Users/vedpatel/Desktop/Ops/test-assets/reports/08-comprehensive-bundle.pdf" },
  ];

  const results = [];

  for (const scenario of scenarios) {
    const register = await callJson("POST", "/api/auth/register", {
      name: scenario.name,
      email: scenario.email,
      password: "Patient@123",
    });
    if (register.status !== 200 || !register.body.token) {
      results.push({
        patient: scenario.name,
        issue: `register_failed:${register.status}`,
        detail: register.body.error || "Registration failed.",
      });
      continue;
    }

    const token = register.body.token;

    const upload = await uploadReport("/api/records", scenario.file, token);
    const records = await callJson("GET", "/api/records", null, token);
    const insights = await callJson("GET", "/api/records/insights?months=6", null, token);

    const topSummary = insights.body?.insights?.patientSummary || "";
    const conditions = insights.body?.insights?.conditionSummaries || [];
    const trends = insights.body?.insights?.trends || [];
    const focus = pickFocus(insights.body?.insights);

    const progress = {
      [new Date().toISOString().slice(0, 10)]: {
        walk: true,
        meal: true,
        log: false,
      },
    };

    const savePlan = await callJson("PUT", "/api/health-plan", {
      ...focus,
      progress,
    }, token);

    const logActivity = await callJson("POST", "/api/health-plan/activity", {
      ...focus,
      trackerKey: focus.focusKey.startsWith("goal:") ? "wellbeing_note" : `${focus.focusKey}_note`,
      label: focus.focusKey.startsWith("goal:") ? "Wellbeing note" : `${focus.focusTitle} note`,
      value: "qa-check",
      unit: "",
      loggedAt: new Date().toISOString(),
      progress,
    }, token);

    const plan = await callJson("GET", `/api/health-plan?focusKey=${encodeURIComponent(focus.focusKey)}`, null, token);
    const momentum = computeMomentum(plan.body?.plan?.progress || {});

    results.push({
      patient: scenario.name,
      uploadStatus: upload.status,
      uploadMessage: upload.body?.message || "",
      recordsCount: Array.isArray(records.body?.records) ? records.body.records.length : 0,
      conditions: conditions.map((item) => `${item.title}:${item.zone}`).slice(0, 3),
      trendsCount: trends.length,
      hasSummary: Boolean(topSummary && topSummary.trim()),
      summaryPreview: String(topSummary || "").slice(0, 120),
      chosenFocus: focus.focusKey,
      savedFocus: plan.body?.plan?.focusKey || "",
      planStatus: savePlan.status,
      activityStatus: logActivity.status,
      weeklyCompleted: momentum.weeklyCompleted,
      streakDays: momentum.streakDays,
      activityEntries: Array.isArray(plan.body?.activity) ? plan.body.activity.length : 0,
    });
  }

  await fastify.close();

  const issues = [];
  for (const result of results) {
    if (result.uploadStatus !== 200) issues.push(`${result.patient}: upload failed (${result.uploadStatus})`);
    if (!result.recordsCount) issues.push(`${result.patient}: no records after upload`);
    if (!result.hasSummary) issues.push(`${result.patient}: no patient summary after upload`);
    if (result.planStatus !== 200) issues.push(`${result.patient}: plan save failed (${result.planStatus})`);
    if (result.activityStatus !== 200) issues.push(`${result.patient}: activity save failed (${result.activityStatus})`);
    if (result.weeklyCompleted < 2) issues.push(`${result.patient}: momentum did not reflect saved progress`);
    if (result.streakDays < 1) issues.push(`${result.patient}: streak did not reflect saved progress`);
  }

  console.log(JSON.stringify({ tmpRoot, results, issues }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
