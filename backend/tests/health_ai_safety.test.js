const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAiSafetyReview, criticalReasonsFromTrends } = require("../src/services/healthAiSafetyService");

test("health AI safety review overrides for configured critical report values", () => {
  const review = buildAiSafetyReview({
    insights: {
      trends: [
        {
          metricKey: "hemoglobin",
          metricLabel: "Hemoglobin",
          latestValue: 6.8,
          latestConfidence: 0.96,
        },
      ],
    },
  });

  assert.equal(review.status, "prompt_clinician_review");
  assert.equal(review.outputMode, "override");
  assert.equal(review.displayRules.showNormalSummary, false);
  assert.match(review.patientLine, /doctor|clinic/i);
});

test("health AI safety review becomes cautious for low confidence and unsafe wording", () => {
  const review = buildAiSafetyReview({
    insights: {
      patientSummary: "This is definitely a diagnosis.",
      trends: [
        {
          metricKey: "hba1c",
          metricLabel: "HbA1c",
          latestValue: 7.1,
          latestConfidence: 0.7,
          needsReview: true,
        },
      ],
    },
  });

  assert.equal(review.status, "cautious_review");
  assert.equal(review.outputMode, "cautious");
  assert.ok(review.blockedTerms.length >= 1);
  assert.equal(review.displayRules.showExtractionReview, true);
});

test("criticalReasonsFromTrends stays quiet for non-critical values", () => {
  assert.deepEqual(
    criticalReasonsFromTrends([
      { metricKey: "hba1c", latestValue: 7.1 },
      { metricKey: "creatinine", latestValue: 1.1 },
    ]),
    [],
  );
});
