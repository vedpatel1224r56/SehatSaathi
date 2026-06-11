const BLOCKED_PATIENT_LANGUAGE = [
  /\bdiagnos(?:e|is|ed|ing)\b/i,
  /\bprescrib(?:e|ed|ing)\b/i,
  /\btreatment plan\b/i,
  /\bguaranteed\b/i,
  /\bdefinitely\b/i,
  /\byou are safe\b/i,
  /\bno risk\b/i,
];

const CRITICAL_VALUE_RULES = [
  {
    metricKeys: ["hemoglobin"],
    test: (value) => value <= 7,
    reason: "Very low hemoglobin needs prompt clinician review.",
  },
  {
    metricKeys: ["platelets"],
    test: (value) => value <= 50,
    reason: "Very low platelet count needs prompt clinician review.",
  },
  {
    metricKeys: ["fbs", "ppbs", "rbs", "estimated_average_glucose"],
    test: (value) => value >= 400 || value <= 54,
    reason: "Very high or very low glucose needs prompt clinician review.",
  },
  {
    metricKeys: ["creatinine"],
    test: (value) => value >= 5,
    reason: "Markedly high creatinine needs prompt clinician review.",
  },
  {
    metricKeys: ["bilirubin_total"],
    test: (value) => value >= 10,
    reason: "Markedly high bilirubin needs prompt clinician review.",
  },
];

function flattenText(value, bucket = []) {
  if (value == null) return bucket;
  if (typeof value === "string" || typeof value === "number") {
    bucket.push(String(value));
    return bucket;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => flattenText(item, bucket));
    return bucket;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => flattenText(item, bucket));
  }
  return bucket;
}

function unique(items = []) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function criticalReasonsFromTrends(trends = []) {
  const reasons = [];
  for (const trend of Array.isArray(trends) ? trends : []) {
    const metricKey = String(trend?.metricKey || "").trim();
    const value = Number(trend?.latestValue);
    if (!metricKey || !Number.isFinite(value)) continue;
    for (const rule of CRITICAL_VALUE_RULES) {
      if (rule.metricKeys.includes(metricKey) && rule.test(value)) {
        reasons.push(rule.reason);
      }
    }
  }
  return unique(reasons);
}

function blockedLanguageHits(payload) {
  const source = flattenText(payload).join("\n");
  return BLOCKED_PATIENT_LANGUAGE
    .filter((pattern) => pattern.test(source))
    .map((pattern) => pattern.source.replace(/\\b/g, "").replace(/\\/g, ""));
}

function buildAiSafetyReview({ insights = {}, agent = null } = {}) {
  const trends = Array.isArray(insights?.trends) ? insights.trends : [];
  const lowConfidenceCount = trends.filter((trend) => trend?.needsReview || Number(trend?.latestConfidence ?? 1) < 0.88).length;
  const criticalReasons = criticalReasonsFromTrends(trends);
  const blockedTerms = blockedLanguageHits({ insights, agent });
  const extractionStatus = String(insights?.extractionSafety?.status || insights?.extractionSafety?.reason || "").toLowerCase();
  const existingSafetyStatus = String(insights?.safetyLayer?.status || insights?.safety?.status || "").toLowerCase();
  const needsManualReview = lowConfidenceCount > 0 || /low|partial|unclear|review/.test(extractionStatus);
  const needsPromptReview = criticalReasons.length > 0 || /emergency|urgent/.test(existingSafetyStatus);

  if (needsPromptReview) {
    return {
      status: "prompt_clinician_review",
      outputMode: "override",
      reasons: criticalReasons.length ? criticalReasons : ["Some values need prompt clinician review."],
      blockedTerms,
      patientLine: "Some values need prompt clinician review. Please contact your doctor or a clinic today.",
      clinicianLine: "Prompt clinician review suggested based on configured safety thresholds or report safety status.",
      displayRules: {
        showNormalSummary: false,
        showDoctorQuestions: true,
        showExtractionReview: needsManualReview,
      },
    };
  }

  if (needsManualReview || blockedTerms.length) {
    return {
      status: "cautious_review",
      outputMode: "cautious",
      reasons: unique([
        needsManualReview ? `${lowConfidenceCount || 1} extracted value needs review context.` : "",
        blockedTerms.length ? "Patient-facing language needs safety review." : "",
      ]),
      blockedTerms,
      patientLine: "Use this as preparation only. A few values may need review context before relying on the summary.",
      clinicianLine: "Cautious summary: extraction confidence, context, or wording review may be needed.",
      displayRules: {
        showNormalSummary: true,
        showDoctorQuestions: true,
        showExtractionReview: true,
      },
    };
  }

  return {
    status: "clear",
    outputMode: "normal",
    reasons: [],
    blockedTerms: [],
    patientLine: "Prepared for discussion, not clinical decision making.",
    clinicianLine: "No safety override triggered by configured checks.",
    displayRules: {
      showNormalSummary: true,
      showDoctorQuestions: true,
      showExtractionReview: false,
    },
  };
}

module.exports = {
  buildAiSafetyReview,
  criticalReasonsFromTrends,
};
