const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildHealthContinuityAgent,
  compactText,
  formatDoctorHandoffText,
} = require("../src/services/healthContinuityAgentService");
const {
  buildPipelineFromAgent,
  buildFollowUpTestConsiderations,
} = require("../src/services/healthContinuityPipelineService");

test("health continuity agent builds memory, questions, continuity, and visit prep without clinical overreach", () => {
  const agent = buildHealthContinuityAgent({
    records: [
      { id: 2, label: "May HbA1c report", created_at: "2026-05-13T10:00:00.000Z" },
      { id: 1, label: "February HbA1c report", created_at: "2026-02-13T10:00:00.000Z" },
    ],
    insights: {
      doctorQuestions: [
        "Do these sugar-related markers fit with my existing sugar condition or current routine?",
        "When should HbA1c or glucose-related testing be repeated?",
      ],
      trends: [
        {
          metricKey: "hba1c",
          metricLabel: "HbA1c",
          points: [{ valueNum: 7.8 }, { valueNum: 7.1 }],
          direction: "improved",
        },
        {
          metricKey: "mch",
          metricLabel: "MCH",
          points: [{ valueNum: 25 }, { valueNum: 24 }],
          needsReview: true,
        },
      ],
    },
    activity: [
      {
        tracker_key: "question",
        label: "Question",
        value_text: "Could sugar changes affect my skin flare pattern?",
        logged_at: "2026-05-20T10:00:00.000Z",
      },
      {
        tracker_key: "bloodSugar",
        label: "Glucose",
        value_text: "142",
        unit: "mg/dL",
        logged_at: "2026-05-19T10:00:00.000Z",
      },
    ],
  });

  assert.equal(agent.identity, "health_continuity_agent");
  assert.equal(agent.posture, "preparation_organization_continuity");
  assert.equal(agent.completion.labRecommendationAgent, "excluded_by_strategy");
  assert.equal(agent.capabilities.reportIntelligence.status, "active");
  assert.equal(agent.capabilities.continuity.status, "active");
  assert.equal(agent.capabilities.engagement.status, "active");
  assert.equal(agent.capabilities.doctorHandoff.status, "active");
  assert.equal(agent.memorySignals[0].value, "2 reports");
  assert.equal(agent.reportValidation.valuesTracked, 2);
  assert.equal(agent.personalization.used, true);
  assert.equal(agent.questionMemory.unresolvedCount, 3);
  assert.deepEqual(agent.reportContinuity.improved, ["HbA1c"]);
  assert.deepEqual(agent.reportContinuity.needsAttention, ["MCH"]);
  assert.equal(agent.engagementCue.type, "question");
  assert.equal(agent.doctorHandoff.primaryFocus, "MCH");
  assert.ok(agent.visitPrep.openQuestions[0].includes("skin flare"));
  assert.ok(agent.visitPrep.clinicianBriefLines.some((line) => line.includes("HbA1c")));
  assert.match(agent.legalSafety.line, /preparation and organization/i);

  const serialized = JSON.stringify(agent).toLowerCase();
  assert.doesNotMatch(serialized, /\burgent\b|\bemergency\b|\bdanger\b|\bprescribe\b|\bdiagnose\b/);
});

test("doctor handoff text is shareable and non-diagnostic", () => {
  const text = formatDoctorHandoffText(
    {
      primaryFocus: "Sugar control",
      changed: ["HbA1c"],
      stable: ["Kidney function"],
      openQuestions: ["What should my realistic HbA1c target be?"],
      recentReports: [{ label: "May report", date: "2026-05-13" }],
      missingContext: ["one recent glucose reading"],
    },
    { patientLine: "Prepared for discussion, not clinical decision making." },
  );

  assert.match(text, /SEHATSAATHI VISIT BRIEF/);
  assert.match(text, /Main focus: Sugar control/);
  assert.match(text, /Questions carried forward/);
  assert.doesNotMatch(text.toLowerCase(), /\bdiagnose\b|\bprescribe\b|\btreatment plan\b/);
});

test("compactText softens unsafe clinical wording", () => {
  const text = compactText("This is urgent and dangerous. Do not diagnose or prescribe treatment.");
  assert.equal(text, "This is timely and needs context. Do not explain or suggest follow-up.");
});

test("health continuity pipeline exposes every upload-to-engagement stage without lab recommendations", () => {
  const insights = {
    trends: [
      {
        metricKey: "hba1c",
        metricLabel: "HbA1c",
        latestValue: 7.1,
        latestConfidence: 0.94,
        needsReview: true,
        zone: "high",
      },
    ],
    patientContext: {
      ageYears: 42,
      chronicConditions: ["Type 2 diabetes"],
    },
    doctorQuestions: ["When should HbA1c be repeated?"],
  };
  const agent = buildHealthContinuityAgent({
    records: [{ id: 1, label: "HbA1c report", created_at: "2026-05-13T10:00:00.000Z" }],
    insights,
    activity: [],
    aiSafetyReview: { status: "clear", outputMode: "normal", patientLine: "Prepared for discussion." },
  });
  const pipeline = buildPipelineFromAgent({
    record: { id: 1 },
    extractionAssessment: { ok: true },
    autoAnalysis: { ok: true },
    insightPayload: { insights },
    agent,
    aiSafetyReview: { status: "clear", outputMode: "normal", patientLine: "Prepared for discussion." },
    remindersQueued: true,
  });

  assert.equal(pipeline.identity, "health_continuity_pipeline");
  assert.equal(pipeline.labRecommendationAgent, "excluded_by_strategy");
  assert.equal(pipeline.stages.upload.status, "active");
  assert.equal(pipeline.stages.reportIntelligence.status, "active");
  assert.equal(pipeline.stages.personalization.status, "active");
  assert.equal(pipeline.stages.safetyEscalation.status, "active");
  assert.equal(pipeline.stages.patientResult.status, "ready");
  assert.equal(pipeline.stages.continuity.status, "active");
  assert.equal(pipeline.stages.followUpTestConsiderations.status, "discussion_only");
  assert.equal(pipeline.stages.doctorHandoff.status, "active");
  assert.equal(pipeline.stages.engagement.status, "active");
  assert.equal(pipeline.stages.engagement.remindersQueued, true);
  assert.ok(pipeline.stages.followUpTestConsiderations.items.some((item) => item.marker === "HbA1c"));
});

test("follow-up test considerations stay discussion-only", () => {
  const items = buildFollowUpTestConsiderations({
    insights: {
      trends: [{ metricKey: "mch", metricLabel: "MCH", needsReview: true }],
    },
  });

  assert.deepEqual(items, [
    {
      marker: "MCH",
      reason: "Discuss whether repeat timing or related testing is useful.",
    },
  ]);
});
