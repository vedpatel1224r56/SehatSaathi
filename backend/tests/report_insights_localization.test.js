const test = require("node:test");
const assert = require("node:assert/strict");

const { buildReportInsights } = require("../src/services/reportInsightsService");
const { buildActionMap } = require("../src/services/actionMapService");
const {
  localizeReportInsights,
  localizeActionMap,
  normalizeLanguage,
} = require("../src/services/reportInsightsLocalizationService");

function buildSugarInsights() {
  return buildReportInsights({
    analyses: [
      {
        recordId: 1,
        reportType: "hba1c",
        reportDate: "2026-06-01",
        metrics: [
          {
            metricKey: "hba1c",
            metricLabel: "HbA1c",
            valueNum: 7.1,
            unit: "%",
            referenceLow: 4,
            referenceHigh: 5.6,
            confidence: 0.98,
          },
          {
            metricKey: "creatinine",
            metricLabel: "Creatinine",
            valueNum: 1,
            unit: "mg/dL",
            referenceLow: 0.7,
            referenceHigh: 1.3,
            confidence: 0.98,
          },
        ],
      },
    ],
    patientContext: {
      chronicConditions: ["Type 2 diabetes"],
    },
  });
}

test("Gujarati report insights localize report-derived summaries and doctor questions", () => {
  const localized = localizeReportInsights(buildSugarInsights(), "gu");

  assert.match(localized.patientSummary, /પરિણામો|ફોલોઅપ/);
  assert.match(localized.overview.headline, /પરિણામો/);
  assert.match(localized.doctorQuestions[0], /કેવી રીતે સમજવું/);
  assert.match(localized.personalizedFollowUp.priorityArea.whatThisMeans, /રેન્જથી ઊંચું/);
  assert.deepEqual(localized.personalizedFollowUp.priorityArea.personalFactors, ["ટાઇપ 2 ડાયાબિટીસ"]);
  assert.match(localized.healthIssues.topIssue.changeOverTime.detail, /બેઝલાઇન/);
  assert.doesNotMatch(localized.patientSummary, /deserve follow-up|highlighted/i);
});

test("Gujarati action map is generated from the actual abnormal report value", () => {
  const source = buildSugarInsights();
  const localized = localizeActionMap(buildActionMap(source.trends, "gu"), "gu");

  assert.equal(localized.metricKey, "hba1c");
  assert.match(localized.headline, /7\.1/);
  assert.match(localized.headline, /રેન્જથી ઊંચું/);
  assert.equal(localized.checkIns.length, 3);
  assert.ok(localized.checkIns.every((item) => /[\u0A80-\u0AFF]/u.test(item.label)));
  assert.match(localized.bringToDoctor, /યોગ્ય લક્ષ્ય/);
});

test("English remains unchanged and unsupported languages safely fall back to English", () => {
  const source = buildSugarInsights();

  assert.equal(localizeReportInsights(source, "en"), source);
  assert.equal(normalizeLanguage("fr"), "en");
  assert.equal(normalizeLanguage("gu"), "gu");
});
