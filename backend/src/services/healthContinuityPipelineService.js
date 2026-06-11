function stage(status, evidence = "", extra = {}) {
  return {
    status,
    evidence: String(evidence || "").trim(),
    ...extra,
  };
}

function buildFollowUpTestConsiderations({ insights = {}, agent = null } = {}) {
  const trends = Array.isArray(insights?.trends) ? insights.trends : [];
  const priorities = Array.isArray(insights?.priorities) ? insights.priorities : [];
  const fromTrends = trends
    .filter((trend) => trend?.needsReview || String(trend?.zone || "").match(/high|low/i))
    .map((trend) => ({
      marker: trend.metricLabel || trend.metric || trend.metricKey || "Marker",
      reason: "Discuss whether repeat timing or related testing is useful.",
    }));
  const fromPriorities = priorities
    .flatMap((priority) => priority?.includedFindings || [])
    .map((finding) => ({
      marker: finding.label || finding.metricLabel || finding.metricKey || "Finding",
      reason: "Carry into clinician review before deciding next testing.",
    }));
  const combined = [...fromTrends, ...fromPriorities];
  const seen = new Set();
  const considerations = combined.filter((item) => {
    const key = String(item.marker || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);

  if (considerations.length) return considerations;
  if (agent?.reportContinuity?.needsContext?.length) {
    return agent.reportContinuity.needsContext.slice(0, 3).map((marker) => ({
      marker,
      reason: "More history may make comparison clearer.",
    }));
  }
  return [];
}

function buildPipelineFromAgent({
  record = null,
  extractionAssessment = null,
  autoAnalysis = null,
  insightPayload = null,
  agent = null,
  aiSafetyReview = null,
  remindersQueued = false,
} = {}) {
  const insights = insightPayload?.insights || {};
  const reportValidation = agent?.reportValidation || {};
  const capabilities = agent?.capabilities || {};
  const hasRecord = Boolean(record?.id);
  const extractionOk = extractionAssessment?.ok !== false;
  const analysisOk = autoAnalysis?.ok !== false;
  const safetyStatus = aiSafetyReview?.status || agent?.aiSafetyReview?.status || insights?.aiSafetyReview?.status || "clear";
  const safetyBlocksNormal = aiSafetyReview?.displayRules?.showNormalSummary === false;

  const stages = {
    upload: stage(hasRecord ? "active" : "waiting", hasRecord ? `Record ${record.id} saved` : "Waiting for report upload"),
    reportIntelligence: stage(
      hasRecord && extractionOk && analysisOk ? "active" : hasRecord ? "review_needed" : "waiting",
      reportValidation.valuesTracked
        ? `${reportValidation.valuesTracked} structured value${reportValidation.valuesTracked === 1 ? "" : "s"} tracked`
        : extractionAssessment?.error || autoAnalysis?.reason || "Structured values need review",
      {
        confidenceScore: reportValidation.averageConfidence || 0,
        valuesNeedingReview: reportValidation.valuesNeedingReview || 0,
        validation: reportValidation,
      },
    ),
    personalization: stage(
      capabilities.personalization?.status === "active" ? "active" : "needs_profile_context",
      capabilities.personalization?.evidence || agent?.personalization?.line || "Add profile context for stronger personalization",
      { factors: agent?.personalization?.factors || [] },
    ),
    safetyEscalation: stage(
      safetyBlocksNormal ? "blocked" : safetyStatus === "clear" ? "active" : "review_needed",
      aiSafetyReview?.patientLine || insights?.aiSafetyReview?.patientLine || "Safety guard completed",
      {
        safetyStatus,
        outputMode: aiSafetyReview?.outputMode || insights?.aiSafetyReview?.outputMode || "normal",
      },
    ),
    patientResult: stage(
      safetyBlocksNormal ? "safe_override" : hasRecord ? "ready" : "waiting",
      safetyBlocksNormal ? "Patient sees safety-first review message" : "Patient result can be shown",
    ),
    continuity: stage(
      capabilities.continuity?.status === "active" ? "active" : "waiting",
      capabilities.continuity?.evidence || "Continuity memory updates when reports or actions exist",
      { memorySignals: agent?.memorySignals || [] },
    ),
    followUpTestConsiderations: stage(
      "discussion_only",
      "Prepared as clinician-discussion prompts, not lab booking recommendations",
      { items: buildFollowUpTestConsiderations({ insights, agent }) },
    ),
    doctorHandoff: stage(
      capabilities.doctorHandoff?.status === "active" ? "active" : "needs_more_context",
      capabilities.doctorHandoff?.evidence || agent?.doctorHandoff?.primaryFocus || "Add report or question context",
      { handoff: agent?.doctorHandoff || null },
    ),
    engagement: stage(
      capabilities.engagement?.status === "active" ? "active" : "waiting",
      remindersQueued ? "Reminder check completed after upload" : capabilities.engagement?.evidence || "Weekly cue generated when report history exists",
      {
        cue: agent?.engagementCue || null,
        remindersQueued: Boolean(remindersQueued),
      },
    ),
  };

  return {
    identity: "health_continuity_pipeline",
    posture: "preparation_organization_continuity",
    labRecommendationAgent: "excluded_by_strategy",
    complete: Object.values(stages).every((item) => !["waiting"].includes(item.status)),
    stages,
  };
}

module.exports = {
  buildPipelineFromAgent,
  buildFollowUpTestConsiderations,
};
