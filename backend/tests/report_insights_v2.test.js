const test = require("node:test");
const assert = require("node:assert/strict");

const { buildReportInsights } = require("../src/services/reportInsightsService");

test("report insights V2 prioritizes multiple moderate issues without overcalling emergency", () => {
  const insights = buildReportInsights({
    analyses: [
      {
        recordId: 1,
        reportType: "multi_panel",
        reportDate: "2026-04-01",
        metrics: [
          { metricKey: "fbs", metricLabel: "Fasting Blood Sugar", valueNum: 165, unit: "mg/dL", confidence: 0.98 },
          { metricKey: "hdl", metricLabel: "HDL", valueNum: 35, unit: "mg/dL", confidence: 0.98 },
          { metricKey: "hemoglobin", metricLabel: "Hemoglobin", valueNum: 13.5, unit: "g/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(insights.healthIssues.status, "Needs attention");
  assert.equal(insights.decision.healthStatus, "Needs attention");
  assert.equal(insights.healthIssues.abnormalCount, 2);
  assert.equal(insights.healthIssues.topIssue.parameter, "Fasting Blood Sugar");
  assert.equal(insights.healthIssues.topIssue.status, "HIGH");
  assert.equal(insights.healthIssues.topIssue.severity, "MODERATE");
  assert.equal(insights.healthIssues.all[0].key, "fbs");
  assert.equal(insights.healthIssues.all[1].key, "hdl");
  assert.equal(insights.healthIssues.all[2].key, "hemoglobin");
  assert.match(insights.decision.recommendedAction, /next routine follow-up|follow-up easier/i);
  assert.ok(insights.decision.fixThisFirst.actions.length >= 2);
  assert.ok(insights.decision.fixThisFirst.doctorQuestions.length >= 2);
  assert.equal(insights.decision.doctorHandoff.title, "Show this to your doctor");
  assert.equal(insights.decision.doctorHandoff.priorityIssues.length, 2);
  assert.match(insights.decision.doctorHandoff.summaryText, /Fasting Blood Sugar/i);
  assert.equal(insights.overview.headline, "A few results may deserve follow-up");
  assert.equal(insights.priorities[0].attentionLevel, "worth_timely_follow_up");
});

test("report insights V2 flags marker-specific critical glucose for doctor review", () => {
  const insights = buildReportInsights({
    analyses: [
      {
        recordId: 3,
        reportType: "glucose",
        reportDate: "2026-04-01",
        metrics: [
          { metricKey: "rbs", metricLabel: "Random Blood Sugar", valueNum: 260, unit: "mg/dL", confidence: 0.98 },
          { metricKey: "hemoglobin", metricLabel: "Hemoglobin", valueNum: 13.5, unit: "g/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(insights.healthIssues.status, "Needs doctor review");
  assert.equal(insights.healthIssues.topIssue.key, "rbs");
  assert.equal(insights.healthIssues.topIssue.severity, "CRITICAL");
  assert.match(insights.decision.recommendedAction, /follow-up may help clarify this result soon/i);
  assert.equal(insights.decision.doctorHandoff.medicationReviewCue, true);
  assert.match(insights.decision.doctorHandoff.topIssue.value, /260/);
  assert.equal(insights.priorities[0].attentionLevel, "needs_prompt_medical_review");
});

test("report insights V2 separates emergency safety from routine plan advice", () => {
  const insights = buildReportInsights({
    analyses: [
      {
        recordId: 4,
        reportType: "glucose",
        reportDate: "2026-04-01",
        metrics: [
          { metricKey: "rbs", metricLabel: "Random Blood Sugar", valueNum: 460, unit: "mg/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(insights.safety.status, "emergency");
  assert.equal(insights.healthIssues.status, "Contact doctor");
  assert.equal(insights.decision.recommendedAction, "A medical follow-up is needed without waiting.");
  assert.equal(insights.safetyLayer.emergencyFlag, true);
});

test("report insights V2 keeps stable reports calm but still produces a next step", () => {
  const insights = buildReportInsights({
    analyses: [
      {
        recordId: 2,
        reportType: "cbc",
        reportDate: "2026-04-01",
        metrics: [
          { metricKey: "hemoglobin", metricLabel: "Hemoglobin", valueNum: 13.2, unit: "g/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(insights.healthIssues.status, "Looks steady");
  assert.equal(insights.healthIssues.abnormalCount, 0);
  assert.equal(insights.healthIssues.topIssue.status, "NORMAL");
  assert.equal(insights.decision.recommendedAction, "Keep routine checks and compare the next report");
});

test("report insights V2 falls back to cautious guidance for partial-review latest reports", () => {
  const insights = buildReportInsights({
    analyses: [
      {
        recordId: 5,
        reportType: "multi_panel",
        reportDate: "2026-04-05",
        qualityGate: "partial_review",
        overallConfidence: 0.96,
        metrics: [
          { metricKey: "hba1c", metricLabel: "HbA1c", valueNum: 7.1, unit: "%", confidence: 0.98 },
          { metricKey: "estimated_average_glucose", metricLabel: "Estimated Average Glucose", valueNum: 157, unit: "mg/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(insights.extractionSafety.fallbackReason, "partial_report");
  assert.equal(insights.carePlan.fallbackReason, "partial_report");
  assert.equal(insights.overview.status, "review_required");
  assert.equal(insights.priorities.length, 0);
  assert.match(insights.patientSummary, /only part of the uploaded report could be read confidently/i);
  assert.match(insights.nextSteps.summary, /review the uploaded report/i);
});

test("report insights V2 avoids strong plans for review-gated or unclear latest extraction", () => {
  const reviewInsights = buildReportInsights({
    analyses: [
      {
        recordId: 6,
        reportType: "glucose",
        reportDate: "2026-04-06",
        qualityGate: "review",
        overallConfidence: 0.95,
        needsReview: true,
        metrics: [
          { metricKey: "rbs", metricLabel: "Random Blood Sugar", valueNum: 245, unit: "mg/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(reviewInsights.carePlan.fallbackReason, "low_confidence");
  assert.equal(reviewInsights.priorities.length, 0);
  assert.match(reviewInsights.patientSummary, /still need review/i);

  const rejectedInsights = buildReportInsights({
    analyses: [
      {
        recordId: 7,
        reportType: "multi_panel",
        reportDate: "2026-04-07",
        qualityGate: "rejected",
        overallConfidence: 0,
        metrics: [],
      },
    ],
  });

  assert.equal(rejectedInsights.carePlan.fallbackReason, "unclear_extraction");
  assert.equal(rejectedInsights.overview.status, "review_required");
  assert.match(rejectedInsights.patientSummary, /could not confidently read the uploaded report/i);
});

test("report insights V2 uses sex-aware ranges for blood counts when context is available", () => {
  const maleInsights = buildReportInsights({
    patientContext: { ageYears: 34, sex: "Male" },
    analyses: [
      {
        recordId: 8,
        reportType: "cbc",
        reportDate: "2026-04-08",
        metrics: [
          { metricKey: "hemoglobin", metricLabel: "Hemoglobin", valueNum: 12.4, unit: "g/dL", confidence: 0.98 },
        ],
      },
    ],
  });
  const femaleInsights = buildReportInsights({
    patientContext: { ageYears: 34, sex: "Female" },
    analyses: [
      {
        recordId: 9,
        reportType: "cbc",
        reportDate: "2026-04-08",
        metrics: [
          { metricKey: "hemoglobin", metricLabel: "Hemoglobin", valueNum: 12.4, unit: "g/dL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(maleInsights.healthIssues.abnormalCount, 1);
  assert.equal(maleInsights.healthIssues.topIssue.status, "LOW");
  assert.equal(femaleInsights.healthIssues.abnormalCount, 0);
  assert.equal(femaleInsights.healthIssues.topIssue.status, "NORMAL");
});

test("report insights V2 threads age, conditions, and allergies into follow-up context", () => {
  const insights = buildReportInsights({
    patientContext: {
      ageYears: 16,
      sex: "Female",
      chronicConditions: ["Type 2 diabetes", "Asthma"],
      allergies: ["Penicillin"],
    },
    analyses: [
      {
        recordId: 10,
        reportType: "multi_panel",
        reportDate: "2026-04-09",
        metrics: [
          { metricKey: "hba1c", metricLabel: "HbA1c", valueNum: 7.1, unit: "%", confidence: 0.98 },
          { metricKey: "estimated_average_glucose", metricLabel: "Estimated Average Glucose", valueNum: 157, unit: "mg/dL", confidence: 0.98 },
          { metricKey: "serum_ige", metricLabel: "Serum IgE", valueNum: 228.09, unit: "IU/mL", confidence: 0.98 },
        ],
      },
    ],
  });

  assert.equal(insights.patientContext.ageYears, 16);
  assert.ok(insights.patientContext.chronicConditions.includes("Type 2 diabetes"));
  assert.ok(insights.patientContext.allergies.includes("Penicillin"));
  assert.ok(insights.overview.limitations.includes("Age-specific lab interpretation may differ"));
  assert.match(insights.overview.summary, /We highlighted what may be most useful to review first\./);
  assert.match(insights.overview.summary, /Existing sugar history was kept in view\./);
  assert.ok(insights.doctorQuestions.some((item) => /existing sugar condition/i.test(item)));
  assert.ok(insights.guidedFollowUp.doctorHandoff.patientContext.some((item) => /Asthma/i.test(item)));
  assert.match(insights.personalizedFollowUp.priorityArea.title, /Sugar/i);
  assert.ok(insights.personalizedFollowUp.secondaryAreas.some((item) => /allergy|immune/i.test(item.title)));
  assert.ok(Array.isArray(insights.personalizedFollowUp.doctorHandoff.mainAreas));
});
