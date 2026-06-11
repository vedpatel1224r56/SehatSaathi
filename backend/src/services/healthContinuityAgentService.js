const MS_PER_DAY = 24 * 60 * 60 * 1000;

const FORBIDDEN_WORDS = [
  ["diagnose", "explain"],
  ["diagnosis", "summary"],
  ["prescribe", "suggest"],
  ["prescription", "medicine note"],
  ["treatment", "follow-up"],
  ["emergency", "medical review"],
  ["danger", "concern"],
  ["dangerous", "needs context"],
  ["safe", "reassuring"],
  ["urgent", "timely"],
  ["urgency", "timing"],
];

function compactText(value = "", fallback = "") {
  let text = String(value || fallback || "").replace(/\s+/g, " ").trim();
  for (const [blocked, replacement] of FORBIDDEN_WORDS) {
    text = text.replace(new RegExp(`\\b${blocked}\\b`, "gi"), replacement);
  }
  return text;
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysSince(value) {
  const parsed = safeDate(value);
  if (!parsed) return null;
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / MS_PER_DAY));
}

function shortDate(value) {
  const parsed = safeDate(value);
  if (!parsed) return "";
  return parsed.toISOString().slice(0, 10);
}

function dedupe(items = []) {
  const seen = new Set();
  return items
    .map((item) => compactText(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function firstNonEmpty(...values) {
  return values.find((value) => compactText(value)) || "";
}

function normalizeActivity(entry = {}) {
  return {
    ...entry,
    trackerKey: entry.trackerKey || entry.tracker_key || "",
    label: entry.label || "",
    value: entry.value || entry.value_text || "",
    unit: entry.unit || "",
    loggedAt: entry.loggedAt || entry.logged_at || entry.created_at || "",
    focusKey: entry.focusKey || entry.focus_key || "",
  };
}

function trendLabel(trend = {}) {
  return compactText(
    trend.metricLabel || trend.metric || trend.parameter || trend.label || trend.metricKey || "Marker",
  );
}

function hasEnoughTrend(trend = {}) {
  const points = Array.isArray(trend.points) ? trend.points : [];
  return points.length >= 2 || trend.previousValue != null || trend.delta != null;
}

function splitReportContinuity(insights = {}) {
  const trends = Array.isArray(insights?.trends) ? insights.trends : [];
  const improved = [];
  const needsAttention = [];
  const stable = [];
  const needsContext = [];

  for (const trend of trends) {
    const label = trendLabel(trend);
    const direction = String(trend.direction || trend.changeDirection || trend.status || "").toLowerCase();
    const needsReview = Boolean(trend.needsReview);
    if (!hasEnoughTrend(trend)) {
      needsContext.push(label);
    } else if (/improv|better|down.*good|up.*good/.test(direction)) {
      improved.push(label);
    } else if (needsReview || /worse|high|low|review|outside|changed/.test(direction)) {
      needsAttention.push(label);
    } else {
      stable.push(label);
    }
  }

  const conditionSummaries = Array.isArray(insights?.conditionSummaries) ? insights.conditionSummaries : [];
  if (!trends.length && conditionSummaries.length) {
    for (const item of conditionSummaries.slice(0, 4)) {
      const label = compactText(item.title || item.label || item.key || "Follow-up area");
      if (item.zone === "normal") stable.push(label);
      else needsContext.push(label);
    }
  }

  return {
    improved: dedupe(improved).slice(0, 3),
    needsAttention: dedupe(needsAttention).slice(0, 3),
    stable: dedupe(stable).slice(0, 3),
    needsContext: dedupe(needsContext).slice(0, 4),
  };
}

function extractQuestions({ insights = {}, activity = [] }) {
  const fromInsights = [
    ...(Array.isArray(insights?.personalizedFollowUp?.doctorQuestions) ? insights.personalizedFollowUp.doctorQuestions : []),
    ...(Array.isArray(insights?.doctorQuestions) ? insights.doctorQuestions : []),
    ...(Array.isArray(insights?.guidedFollowUp?.doctorQuestions) ? insights.guidedFollowUp.doctorQuestions : []),
    ...(Array.isArray(insights?.decision?.fixThisFirst?.doctorQuestions) ? insights.decision.fixThisFirst.doctorQuestions : []),
  ];
  const fromActivity = activity
    .map(normalizeActivity)
    .filter((item) => String(item.trackerKey).toLowerCase() === "question")
    .map((item) => item.value);
  const open = dedupe([...fromActivity, ...fromInsights]).slice(0, 5);
  return {
    open,
    unresolvedCount: open.length,
    latestQuestion: open[0] || "",
    repeated: [],
  };
}

function buildMemorySignals({ records = [], activity = [], questionMemory, continuity }) {
  const normalizedActivity = activity.map(normalizeActivity);
  const latestActivity = normalizedActivity[0] || null;
  const latestRecord = records[0] || null;
  const latestDays = daysSince(latestActivity?.loggedAt || latestRecord?.created_at);
  const continuityCount =
    continuity.improved.length + continuity.needsAttention.length + continuity.stable.length + continuity.needsContext.length;

  return [
    {
      key: "memory",
      label: "Memory",
      value: records.length ? `${records.length} report${records.length === 1 ? "" : "s"}` : "Start",
      status: records.length ? "remembered" : "missing",
    },
    {
      key: "questions",
      label: "Questions",
      value: questionMemory.unresolvedCount ? `${questionMemory.unresolvedCount} open` : "Clear",
      status: questionMemory.unresolvedCount ? "open_loop" : "clear",
    },
    {
      key: "update",
      label: "Last update",
      value: latestDays == null ? "None" : latestDays === 0 ? "Today" : `${latestDays}d ago`,
      status: latestDays == null || latestDays >= 14 ? "stale" : "fresh",
    },
    {
      key: "continuity",
      label: "Continuity",
      value: continuityCount ? "Linked" : "Needs history",
      status: continuityCount ? "linked" : "context",
    },
  ];
}

function buildVisitPrep({ continuity, questionMemory, records = [], activity = [] }) {
  const changed = dedupe([...continuity.improved, ...continuity.needsAttention]).slice(0, 4);
  const stable = continuity.stable.slice(0, 3);
  const openQuestions = questionMemory.open.slice(0, 4);
  const missingContext = [];
  if (records.length < 2) missingContext.push("another report for comparison");
  if (!activity.map(normalizeActivity).length) missingContext.push("one recent reading or symptom note");
  if (!openQuestions.length) missingContext.push("one question for the next review");

  const clinicianBriefLines = dedupe([
    changed.length ? `Changed or needs review context: ${changed.join(", ")}` : "",
    stable.length ? `Stable in available history: ${stable.join(", ")}` : "",
    openQuestions.length ? `Questions carried forward: ${openQuestions.join(" | ")}` : "",
    missingContext.length ? `Useful context to add: ${missingContext.join(", ")}` : "",
  ]);

  return {
    title: openQuestions.length ? "Question ready" : changed.length ? "Review ready" : "Context ready",
    changed,
    stable,
    openQuestions,
    missingContext,
    clinicianBriefLines,
  };
}

function buildHealthStory({ records = [], activity = [], continuity }) {
  const events = [];
  for (const record of records.slice(0, 4)) {
    events.push({
      at: shortDate(record.created_at),
      label: "Report added",
      body: compactText(record.label || record.display_label || record.original_file_name || "Lab report"),
      type: "report",
    });
  }
  for (const entry of activity.map(normalizeActivity).slice(0, 4)) {
    events.push({
      at: shortDate(entry.loggedAt),
      label: compactText(entry.label || "Health note"),
      body: compactText([entry.value, entry.unit].filter(Boolean).join(" ")),
      type: entry.trackerKey || "memory",
    });
  }
  if (continuity.needsAttention[0]) {
    events.push({
      at: "",
      label: "Carry forward",
      body: `${continuity.needsAttention[0]} needs review context`,
      type: "continuity",
    });
  }
  return events
    .filter((item) => item.body || item.label)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 8);
}

function buildReturnReason({ questionMemory, continuity, activity = [], records = [] }) {
  const latestActivityDays = daysSince(activity.map(normalizeActivity)[0]?.loggedAt);
  if (questionMemory.latestQuestion) return `Carry forward: ${questionMemory.latestQuestion}`;
  if (latestActivityDays == null && records.length) return "Save one signal before the next review";
  if (latestActivityDays != null && latestActivityDays >= 7) return `No signal saved in ${latestActivityDays} days`;
  if (continuity.needsContext[0]) return `Add context for ${continuity.needsContext[0]}`;
  if (continuity.needsAttention[0]) return `Keep ${continuity.needsAttention[0]} ready for review`;
  return records.length ? "Your health memory is up to date" : "Upload one report to start memory";
}

function buildReportValidation(insights = {}) {
  const trends = Array.isArray(insights?.trends) ? insights.trends : [];
  const lowConfidence = trends.filter((trend) => trend?.needsReview || Number(trend?.latestConfidence ?? 1) < 0.88);
  const averageConfidence = trends.length
    ? Math.round((trends.reduce((sum, trend) => sum + Number(trend?.latestConfidence ?? 0), 0) / trends.length) * 100)
    : 0;
  return {
    confidenceLabel: !trends.length ? "No structured values" : lowConfidence.length ? "Needs review" : "Readable",
    averageConfidence,
    valuesTracked: trends.length,
    valuesNeedingReview: lowConfidence.length,
    reviewFields: lowConfidence.map((trend) => trendLabel(trend)).slice(0, 5),
  };
}

function buildPersonalization({ insights = {}, profile = {} }) {
  const context = insights?.patientContext || {};
  const conditions = Array.isArray(context.chronicConditions) ? context.chronicConditions : [];
  const allergies = Array.isArray(context.allergies) ? context.allergies : [];
  const age = Number(context.ageYears || profile.ageYears || profile.age || null);
  const factors = [
    Number.isFinite(age) ? `${age}y` : "",
    context.sex || profile.sex || "",
    ...conditions.slice(0, 3),
    ...allergies.slice(0, 2).map((item) => `${item} allergy`),
  ].filter(Boolean);
  const primary = insights?.personalizedFollowUp?.priorityArea || insights?.priorities?.[0] || null;
  return {
    used: Boolean(factors.length || primary),
    factors,
    line: factors.length
      ? `Read with your context: ${factors.join(" • ")}`
      : "Add conditions, medicines, or allergies to make this more personal.",
  };
}

function buildEngagementCue({ questionMemory, continuity, activity = [], records = [] }) {
  const latestActivityDays = daysSince(activity.map(normalizeActivity)[0]?.loggedAt);
  if (questionMemory.latestQuestion) {
    return {
      type: "question",
      label: "Question waiting",
      action: "Keep this ready",
      text: questionMemory.latestQuestion,
    };
  }
  if (latestActivityDays == null && records.length) {
    return {
      type: "first_signal",
      label: "Add context",
      action: "Save one signal",
      text: "One BP, glucose, weight, symptom, medicine, or question is enough.",
    };
  }
  if (latestActivityDays != null && latestActivityDays >= 7) {
    return {
      type: "stale_signal",
      label: "Update missing",
      action: "Save one signal",
      text: `No health signal saved in ${latestActivityDays} days.`,
    };
  }
  if (continuity.needsContext[0]) {
    return {
      type: "more_history",
      label: "Needs history",
      action: "Compare next report",
      text: continuity.needsContext[0],
    };
  }
  return {
    type: "steady",
    label: "Memory current",
    action: "Keep ready",
    text: "Your latest context is saved.",
  };
}

function buildDoctorHandoff({ visitPrep, continuity, questionMemory, insights = {}, records = [] }) {
  const primaryFocus =
    insights?.personalizedFollowUp?.priorityArea?.title ||
    insights?.priorities?.[0]?.title ||
    continuity.needsAttention[0] ||
    continuity.needsContext[0] ||
    "General follow-up";
  return {
    format: "clinician_scan_30_seconds",
    primaryFocus: compactText(primaryFocus),
    recentReports: records.slice(0, 3).map((record) => ({
      label: compactText(record.label || record.display_label || record.original_file_name || "Report"),
      date: shortDate(record.created_at),
    })),
    changed: visitPrep.changed,
    stable: visitPrep.stable,
    openQuestions: questionMemory.open.slice(0, 4),
    missingContext: visitPrep.missingContext,
    shareableLines: visitPrep.clinicianBriefLines,
  };
}

function buildAgentCapabilities({ records = [], insights = {}, activity = [], doctorHandoff = {}, aiSafetyReview = null } = {}) {
  const trends = Array.isArray(insights?.trends) ? insights.trends : [];
  const context = insights?.patientContext || {};
  const hasProfileContext = Boolean(
    context.ageYears || context.sex || context.chronicConditions?.length || context.allergies?.length,
  );
  return {
    reportIntelligence: {
      status: trends.length ? "active" : "waiting_for_report",
      evidence: `${trends.length} structured value${trends.length === 1 ? "" : "s"} tracked`,
    },
    personalization: {
      status: hasProfileContext || insights?.personalizedFollowUp ? "active" : "needs_profile_context",
      evidence: hasProfileContext ? "Profile context used" : "Add conditions, allergies, age, or sex for stronger context",
    },
    continuity: {
      status: records.length || activity.length ? "active" : "waiting_for_memory",
      evidence: `${records.length} report${records.length === 1 ? "" : "s"}, ${activity.length} saved signal${activity.length === 1 ? "" : "s"}`,
    },
    engagement: {
      status: records.length ? "active" : "waiting_for_report",
      evidence: records.length ? "Return cue generated from current memory" : "Upload a report to start return cues",
    },
    doctorHandoff: {
      status: doctorHandoff?.shareableLines?.length || doctorHandoff?.openQuestions?.length ? "active" : "needs_more_context",
      evidence: doctorHandoff?.primaryFocus || "Add report or question context",
    },
    safetyEscalation: {
      status: aiSafetyReview?.status || insights?.aiSafetyReview?.status || "clear",
      evidence: aiSafetyReview?.patientLine || insights?.aiSafetyReview?.patientLine || "Safety guard available",
    },
  };
}

function formatDoctorHandoffText(handoff = {}, safetyReview = null) {
  const lines = [
    "SEHATSAATHI VISIT BRIEF",
    "",
    `Main focus: ${compactText(handoff.primaryFocus || "General follow-up")}`,
    safetyReview?.patientLine ? `Safety note: ${compactText(safetyReview.patientLine)}` : "",
    "",
    handoff.changed?.length ? `Changed / review context: ${handoff.changed.join(", ")}` : "",
    handoff.stable?.length ? `Stable in available history: ${handoff.stable.join(", ")}` : "",
    handoff.missingContext?.length ? `Useful missing context: ${handoff.missingContext.join(", ")}` : "",
    "",
    handoff.openQuestions?.length ? "Questions carried forward:" : "",
    ...(handoff.openQuestions || []).slice(0, 5).map((question) => `- ${compactText(question)}`),
    "",
    handoff.recentReports?.length ? "Recent reports:" : "",
    ...(handoff.recentReports || []).slice(0, 5).map((report) => `- ${compactText(report.label)}${report.date ? ` (${report.date})` : ""}`),
    "",
    "Use for preparation and continuity only. Clinical decisions stay with the clinician.",
  ];
  return lines.filter((line, index, list) => line || list[index - 1]).join("\n").trim();
}

function buildHealthContinuityAgent({ records = [], insights = {}, activity = [], appointments = [], profile = {}, aiSafetyReview = null } = {}) {
  const normalizedActivity = activity.map(normalizeActivity);
  const continuity = splitReportContinuity(insights);
  const questionMemory = extractQuestions({ insights, activity: normalizedActivity });
  const memorySignals = buildMemorySignals({ records, activity: normalizedActivity, questionMemory, continuity });
  const visitPrep = buildVisitPrep({ continuity, questionMemory, records, activity: normalizedActivity });
  const reportValidation = buildReportValidation(insights);
  const personalization = buildPersonalization({ insights, profile });
  const engagementCue = buildEngagementCue({ questionMemory, continuity, activity: normalizedActivity, records });
  const doctorHandoff = buildDoctorHandoff({ visitPrep, continuity, questionMemory, insights, records });
  const capabilities = buildAgentCapabilities({ records, insights, activity: normalizedActivity, doctorHandoff, aiSafetyReview });
  const latestAppointment = appointments[0] || null;
  const headline = firstNonEmpty(
    questionMemory.unresolvedCount ? `${questionMemory.unresolvedCount} question${questionMemory.unresolvedCount === 1 ? "" : "s"} carried forward` : "",
    continuity.needsAttention[0] ? `${continuity.needsAttention[0]} needs review context` : "",
    continuity.needsContext[0] ? `${continuity.needsContext[0]} needs more history` : "",
    records.length ? "Your health memory is active" : "Start your health memory",
  );

  return {
    identity: "health_continuity_agent",
    posture: "preparation_organization_continuity",
    completion: {
      labRecommendationAgent: "excluded_by_strategy",
      includedAgents: [
        "report_intelligence",
        "personalization",
        "continuity",
        "engagement",
        "doctor_handoff",
        "safety_escalation",
      ],
    },
    capabilities,
    summary: {
      headline: compactText(headline),
      subline: latestAppointment?.scheduled_at
        ? `Next review context ready for ${shortDate(latestAppointment.scheduled_at)}`
        : compactText(buildReturnReason({ questionMemory, continuity, activity: normalizedActivity, records })),
      statusChips: memorySignals.slice(0, 4),
    },
    memorySignals,
    reportValidation,
    personalization,
    questionMemory,
    reportContinuity: {
      primaryStatus: continuity.needsAttention.length
        ? "Needs review context"
        : continuity.improved.length
          ? "Some improvement"
          : continuity.stable.length
            ? "Mostly stable"
            : "Needs more history",
      ...continuity,
    },
    engagementCue,
    doctorHandoff,
    visitPrep,
    healthStory: buildHealthStory({ records, activity: normalizedActivity, continuity }),
    familySupport: {
      sharePrompt: questionMemory.latestQuestion || visitPrep.clinicianBriefLines[0] || "Share this brief only with someone you choose.",
      privacyLine: "Family sharing stays user-controlled.",
    },
    legalSafety: {
      line: "For preparation and organization only, not clinical decision making.",
    },
    returnReason: compactText(buildReturnReason({ questionMemory, continuity, activity: normalizedActivity, records })),
    profileContext: {
      hasConditions: Boolean(compactText(profile.conditions)),
      hasAllergies: Boolean(compactText(profile.allergies)),
    },
  };
}

module.exports = {
  buildHealthContinuityAgent,
  buildAgentCapabilities,
  compactText,
  formatDoctorHandoffText,
};
