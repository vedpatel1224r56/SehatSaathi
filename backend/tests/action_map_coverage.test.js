const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildActionMap,
  METRIC_PLAYBOOKS,
} = require("../src/services/actionMapService");
const { REPORT_CATALOG } = require("../src/services/reportInsightsService");
const { localizeActionMap } = require("../src/services/reportInsightsLocalizationService");

test("every recognized report metric has a deterministic action playbook", () => {
  const metricDefinitions = Object.values(REPORT_CATALOG)
    .flatMap((panel) => panel.metrics || []);
  const recognizedMetricKeys = [...new Set(metricDefinitions.map((metric) => metric.key))].sort();
  const metricByKey = new Map(metricDefinitions.map((metric) => [metric.key, metric]));
  const playbookMetricKeys = Object.keys(METRIC_PLAYBOOKS).sort();

  const missingPlaybooks = recognizedMetricKeys.filter(
    (metricKey) => !playbookMetricKeys.includes(metricKey),
  );
  assert.deepEqual(missingPlaybooks, []);

  for (const metricKey of recognizedMetricKeys) {
    const playbook = METRIC_PLAYBOOKS[metricKey];
    const metric = metricByKey.get(metricKey);
    const zone = typeof playbook.high === "function" ? "high" : "low";
    const plan = buildActionMap([
      {
        metricKey,
        metricLabel: metric.label,
        latestValue: zone === "high" ? 150 : 5,
        previousValue: zone === "high" ? 165 : 4,
        unit: metric.unit || "",
        low: metric.low,
        high: metric.high,
        zone,
      },
    ]);

    assert.ok(plan, `${metricKey} should produce an action map`);
    assert.equal(plan.metricKey, metricKey);
    assert.ok(plan.headline, `${metricKey} should have a headline`);
    assert.ok(Array.isArray(plan.thisWeek), `${metricKey} should have action steps`);
    assert.ok(plan.thisWeek.length >= 2, `${metricKey} should have at least two action steps`);
    assert.ok(plan.bringToDoctor, `${metricKey} should have a doctor question`);
  }
});

test("action maps add safe age, condition, and medication context", () => {
  const plan = buildActionMap(
    [{
      metricKey: "hba1c",
      metricLabel: "HbA1c",
      latestValue: 7.1,
      unit: "%",
      low: 4,
      high: 5.6,
      zone: "high",
    }],
    "en",
    {
      ageYears: 68,
      chronicConditions: ["Type 2 diabetes", "Chronic kidney disease"],
      medications: ["Metformin", "Telmisartan"],
    },
  );

  assert.ok(plan);
  assert.ok(plan.contextNotes.some((note) => /65/i.test(note)));
  assert.ok(plan.contextNotes.some((note) => /sugar history/i.test(note)));
  assert.ok(plan.contextNotes.some((note) => /dose/i.test(note)));
});

test("Gujarati action maps keep action steps as an array", () => {
  const sourcePlan = buildActionMap([{
    metricKey: "serum_ige",
    metricLabel: "Serum IgE",
    latestValue: 228,
    unit: "IU/mL",
    high: 100,
    zone: "high",
  }], "gu", {
    chronicConditions: ["Asthma"],
  });
  const plan = localizeActionMap(sourcePlan, "gu");

  assert.ok(plan);
  assert.ok(Array.isArray(plan.thisWeek));
  assert.ok(plan.thisWeek.length >= 2);
  assert.match(plan.thisWeek[0], /નોંધ|રીડિંગ|લક્ષણ|પાણી|ભોજન|દવા|ચાલ/i);
});
