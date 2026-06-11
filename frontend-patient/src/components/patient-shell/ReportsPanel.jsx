import { useMemo, useState } from "react";
import { ReportTrendChart } from "./ReportTrendChart";
import { useLang } from "../../i18n.js";

function getReportGroups(t) {
  return [
    { key: "diabetes", title: t("group_diabetes"), metricKeys: ["hba1c", "estimated_average_glucose", "fbs", "ppbs", "rbs"] },
    { key: "thyroid", title: t("group_thyroid"), metricKeys: ["tsh", "t3", "t4"] },
    { key: "liver", title: t("group_liver"), metricKeys: ["bilirubin_total", "sgpt_alt", "sgot_ast"] },
    { key: "lipid", title: t("group_lipid"), metricKeys: ["total_cholesterol", "ldl", "hdl", "triglycerides"] },
    { key: "ckd", title: t("group_ckd"), metricKeys: ["creatinine", "urea", "uric_acid"] },
    { key: "anemia", title: t("group_anemia"), metricKeys: ["hemoglobin", "rbc_count", "pcv", "mcv", "mch", "mchc", "rdw", "wbc", "esr", "platelets"] },
    { key: "anthropometry", title: t("group_anthropometry"), metricKeys: ["weight", "bmi"] },
  ];
}

function buildNextSteps(reportInsights, t) {
  if (reportInsights?.nextSteps?.actions?.length) {
    return reportInsights.nextSteps.actions.slice(0, 4).map((action, index) => ({
      key: `guided-next-${index}`,
      title: t("action_plan_title"),
      body: action,
      tone: "normal",
    }));
  }
  const fixThisFirst = reportInsights?.decision?.fixThisFirst || reportInsights?.healthIssues?.fixThisFirst;
  const recommendedAction = reportInsights?.decision?.recommendedAction || reportInsights?.healthIssues?.recommendedAction;
  if (fixThisFirst?.actions?.length) {
    const steps = fixThisFirst.actions.slice(0, 3).map((action, index) => ({
      key: `fix-first-${index}`,
      title: index === 0 ? t("start_here") : index === 1 ? t("keep_it_practical") : t("use_for_review"),
      body: action,
      tone: fixThisFirst.severity === "CRITICAL" ? "high" : fixThisFirst.severity === "MODERATE" ? "low" : "normal",
    }));
    if (recommendedAction && !/upload a clear report/i.test(recommendedAction)) {
      steps.push({
        key: "recommended-action",
        title: t("recommended_label"),
        body: recommendedAction,
        tone: fixThisFirst.severity === "CRITICAL" ? "high" : "low",
      });
    }
    return steps.slice(0, 4);
  }

  const summaries = reportInsights?.conditionSummaries || [];
  const trends = reportInsights?.trends || [];
  const badges = reportInsights?.badges || [];
  const steps = [];
  const reviewCount = trends.filter((trend) => trend.needsReview).length;
  const highFocus = summaries.filter((item) => item.zone === "high");
  const lowFocus = summaries.filter((item) => item.zone === "low");

  if (reviewCount) {
    steps.push({
      key: "review-values",
      title: t ? t("double_check_title") : "Review extracted values",
      body: t ? t("double_check_body", { n: reviewCount, s: reviewCount === 1 ? "" : "s" }) : `Double-check ${reviewCount} extracted value${reviewCount === 1 ? "" : "s"} before relying on the summary.`,
      tone: "low",
    });
  }

  if (highFocus.length) {
    steps.push({
      key: "focus-now",
      title: "Focus on the strongest change",
      body: `${highFocus[0].title} looks like the main area to review first.`,
      tone: "high",
    });
  } else if (lowFocus.length) {
    steps.push({
      key: "watch-trend",
      title: "Keep a closer eye on the trend",
      body: `${lowFocus[0].title} is worth tracking with another report if symptoms continue.`,
      tone: "low",
    });
  }

  if (badges.length || trends.length) {
    steps.push({
      key: "start-plan",
      title: "Start a follow-up plan",
      body: "Turn your report findings into a few simple follow-up steps and notes for this week.",
      tone: "normal",
    });
  }

  if (!steps.length) {
    steps.push({
      key: "upload-more",
      title: "Upload another report to begin",
      body: "Once you add structured values, SehatSaathi can show trends, summaries, and next-step guidance.",
      tone: "normal",
    });
  }

  return steps.slice(0, 3);
}

function toSentence(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function shortenInsight(text = "", fallback = "") {
  const normalized = toSentence(text);
  if (!normalized) return fallback;
  const firstSentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const cleaned = (firstSentenceMatch?.[0] || normalized).trim();
  return cleaned.length > 140 ? `${cleaned.slice(0, 137).trimEnd()}...` : cleaned;
}

function normalizeLabel(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildKeyFindings(reportInsights) {
  const issueFindings = (reportInsights?.healthIssues?.all || [])
    .slice(0, 4)
    .map((issue) => ({
      key: `issue-${issue.key}`,
      label: issue.parameter,
      tone: issue.status === "NORMAL" ? "normal" : issue.severity === "CRITICAL" ? "high" : "low",
      status: issue.status,
      severity: issue.severity,
      body: `${issue.status}${issue.severity !== "NORMAL" ? ` • ${issue.severity}` : ""}${issue.range ? ` • Range ${issue.range}` : ""}`,
    }));

  if (issueFindings.length) return issueFindings;

  const conditionFindings = (reportInsights?.conditionSummaries || [])
    .sort((a, b) => {
      const score = { high: 0, low: 1, normal: 2 };
      return (score[a.zone] ?? 3) - (score[b.zone] ?? 3);
    })
    .slice(0, 4)
    .map((item) => ({
      key: `condition-${item.key}`,
      label: item.title,
      tone: item.zone,
      body: shortenInsight(item.summary, "This area is ready for review."),
    }));

  if (conditionFindings.length) return conditionFindings;

  return (reportInsights?.trends || []).slice(0, 3).map((trend) => ({
    key: `trend-${trend.metricKey}`,
    label: trend.metricLabel,
    tone: trend.zone,
    body: shortenInsight(trend.summary, `${trend.metricLabel} has been added to your report summary.`),
  }));
}

function buildTopInsight({ patientSummary, focusSummary, safety, reviewTrendCount, fallbackText, decision }) {
  if (patientSummary && /deserve follow-up|looks mostly steady/i.test(patientSummary)) {
    return patientSummary;
  }
  if (decision?.healthStatus && decision.healthStatus !== "No report yet") {
    if (/needs attention/i.test(decision.healthStatus)) return "Worth attention";
    if (/needs doctor review/i.test(decision.healthStatus)) return "Medical review may help here";
    return decision.healthStatus;
  }
  if (safety?.status === "emergency") {
    return "One or more report values may need urgent medical attention.";
  }
  if (safety?.status === "urgent_review") {
    return "A medical follow-up may help clarify one or more results soon.";
  }
  if (reviewTrendCount) {
    return `Some extracted values still need review before you rely fully on this summary.`;
  }
  if (focusSummary?.zone === "high") {
    return shortenInsight(focusSummary.summary, "One area in this report may deserve closer follow-up.");
  }
  if (focusSummary?.zone === "low") {
    return shortenInsight(focusSummary.summary, "One area in this report is worth tracking.");
  }
  return shortenInsight(patientSummary, fallbackText || "Your report summary is ready.");
}

function buildInsightsFallback(records = [], reportInsightsStatus = "") {
  if (reportInsightsStatus && /processing|still being prepared/i.test(reportInsightsStatus)) {
    if (Array.isArray(records) && records.length) {
      return "Your report is saved. The summary will appear shortly.";
    }
    return "Your summary is still being prepared.";
  }
  if (Array.isArray(records) && records.length) {
    return "Your reports are ready. Open one to review the latest values.";
  }
  return "No report added yet. Upload one clear report to begin.";
}

function softenHealthStatus(status = "") {
  const text = String(status || "").trim();
  if (!text) return text;
  if (/needs doctor review/i.test(text)) return "Medical review may help here";
  if (/needs attention/i.test(text)) return "Worth attention";
  return text;
}

function buildReliefSupport({ focusSummary, reportInsights, fallbackText }) {
  if (focusSummary?.zone === "high") {
    return "This is the part worth your attention first. You do not need to decode the whole report alone.";
  }
  if (focusSummary?.zone === "low") {
    return "Nothing here looks like panic. This is simply the part worth watching next.";
  }
  if ((reportInsights?.trends || []).length) {
    return "Your report has already been reduced to the clearest signal, so you can start from what matters without extra clutter.";
  }
  return fallbackText || "Your report summary will turn into one clear signal, one calm explanation, and one next step.";
}

function buildNextStepTone({ nextSteps = [], focusSummary }) {
  if (nextSteps[0]) return nextSteps[0];
  if (focusSummary?.zone === "high") {
    return {
      title: "Start with one focused plan",
      body: "Let SehatSaathi turn this strongest signal into a lighter weekly routine.",
    };
  }
  return {
    title: "Keep the next step light",
    body: "A clear upload here becomes a calmer summary and a simpler weekly plan.",
  };
}

function buildMagicSummaryItems({ fixThisFirst, recommendedAction, changeOverTime, insightsFallback }) {
  if (!fixThisFirst || fixThisFirst.status === "NO_REPORT") {
      return [
      { key: "signal", label: "Top signal", value: "Waiting for report", detail: insightsFallback },
      { key: "seriousness", label: "Seriousness", value: "Not ready yet", detail: "Upload a clear report first." },
      { key: "next", label: "Do now", value: "Upload report", detail: "A clear PDF or sharp image works best." },
    ];
  }
  return [
    {
      key: "signal",
      label: "Top signal",
      value: fixThisFirst.title,
      detail: fixThisFirst.body,
    },
    {
      key: "seriousness",
      label: "Seriousness",
      value: fixThisFirst.severity === "CRITICAL" ? "Medical review may help here" : fixThisFirst.severity === "MODERATE" ? "Worth attention" : "Steady",
      detail: recommendedAction,
    },
    {
      key: "next",
      label: "Do now",
      value: fixThisFirst.actions?.[0] || "Start with the top issue",
      detail: "Keep this practical and review the original report before clinical decisions.",
    },
    {
      key: "change",
      label: "Since last report",
      value: changeOverTime?.label || "First tracked reading",
      detail: changeOverTime?.detail || "This report becomes your baseline for the next comparison.",
    },
  ];
}

function buildDoctorHandoffText({ doctorHandoff, healthStatus, recommendedAction, doctorQuestions }) {
  const handoff = doctorHandoff || {};
  if (handoff?.extractedData?.length || handoff?.aiObservations?.length) {
    const lines = [
      "SehatSaathi doctor handoff summary",
      "Extracted report values:",
      ...((handoff.extractedData || []).slice(0, 6).map((item) => `- ${item.label}: ${item.formattedValue || `${item.value}${item.unit ? ` ${item.unit}` : ""}`}`)),
      handoff.aiObservations?.length ? "AI observations:" : null,
      ...((handoff.aiObservations || []).slice(0, 4).map((line) => `- ${line}`)),
      handoff.trendNotes?.length ? "Trend comparison:" : null,
      ...((handoff.trendNotes || []).slice(0, 4).map((line) => `- ${line}`)),
      handoff.patientContext?.length ? "Patient context:" : null,
      ...((handoff.patientContext || []).slice(0, 3).map((line) => `- ${line}`)),
      handoff.discussionIdeas?.length ? "Doctor discussion ideas:" : null,
      ...((handoff.discussionIdeas || []).slice(0, 3).map((line) => `- ${line}`)),
      "This summary supports follow-up planning and is not a diagnosis.",
    ];
    return lines.filter(Boolean).join("\n");
  }
  const topIssue = handoff.topIssue;
  const priorityIssues = handoff.priorityIssues || [];
  const lines = [
    "SehatSaathi doctor-ready summary",
    `Current read: ${handoff.status || healthStatus}`,
    topIssue ? `Top issue: ${topIssue.parameter} - ${topIssue.value} (${topIssue.status}, ${topIssue.severity})` : "Top issue: not available yet",
    topIssue?.range ? `Reference range: ${topIssue.range}` : null,
    topIssue?.change ? `Change: ${topIssue.change}` : null,
    `Recommended next step: ${handoff.recommendedAction || recommendedAction}`,
    priorityIssues.length ? "Other values to review:" : null,
    ...priorityIssues.slice(0, 4).map((issue) => `- ${issue.parameter}: ${issue.value}, ${issue.status}/${issue.severity}, range ${issue.range}`),
    doctorQuestions?.length ? "Questions to ask:" : null,
    ...(doctorQuestions || []).slice(0, 3).map((question) => `- ${question}`),
    handoff.medicationReviewCue ? "Medication/repeat-test review may be needed. Do not self-start or change medicines without clinician advice." : null,
    handoff.disclaimer || "This is not a medical diagnosis. Use it as a conversation aid with a licensed clinician.",
  ];
  return lines.filter(Boolean).join("\n");
}

function toneFromAttention(attentionLevel = "") {
  if (attentionLevel === "needs_prompt_medical_review") return "high";
  if (attentionLevel === "worth_timely_follow_up") return "low";
  return "normal";
}

function priorityFromBadge(badge = {}) {
  const zone = badge.zone === "high" ? "high" : badge.zone === "low" ? "low" : "normal";
  return {
    id: `badge-priority-${badge.key || badge.label}`,
    title: badge.label || "Extracted value needs review",
    summary:
      zone === "normal"
        ? "This extracted value is visible from your report."
        : "This extracted value may be outside range. Confirm it against the original report before relying on the summary.",
    attentionLevel: zone === "high" ? "worth_timely_follow_up" : "discuss_in_next_appointment",
    attentionLabel: zone === "high" ? "Worth discussing" : "Needs review",
    whyHighlighted: ["Auto-read found this value, but it may need manual confirmation."],
    includedFindings: [],
    isBadgeFallback: true,
  };
}

function labelForTrendState(state = "", t = (key) => key) {
  if (state === "improving") return t("improving");
  if (state === "stable") return t("stable");
  if (state === "worsening") return "Higher than prior report";
  if (state === "needs_recheck") return "Needs recheck";
  if (state === "higher_than_prior") return "Higher than prior report";
  if (state === "lower_than_prior") return "Lower than prior report";
  if (state === "mixed") return "Mixed";
  return t("needs_more_history");
}

function formatReportMonth(value = "") {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function friendlyReportName(record = {}, catalogMap = new Map()) {
  const analysis = record.analysis || (Array.isArray(record.analyses) ? record.analyses[0] : null);
  const suggestedType = record.extraction?.suggested_report_type || "";
  const typeKey = analysis?.reportType || suggestedType || "";
  const typeLabel = catalogMap.get(typeKey)?.label || analysis?.reportType || suggestedType || "";
  const monthLabel = formatReportMonth(analysis?.reportDate || record.report_date || record.created_at || record.uploaded_at);
  if (typeLabel && monthLabel) return `${typeLabel} • ${monthLabel}`;
  if (typeLabel) return typeLabel;
  if (monthLabel) return `Lab report • ${monthLabel}`;
  return "Lab report";
}

function iconForPriority(priority = {}) {
  const title = String(priority.title || priority.findingLabel || "").toLowerCase();
  if (title.includes("sugar")) return "🩸";
  if (title.includes("red-cell") || title.includes("cbc")) return "🧪";
  if (title.includes("weight") || title.includes("metabolic")) return "⚖️";
  if (title.includes("allergy") || title.includes("immune")) return "🌿";
  if (title.includes("kidney")) return "💧";
  if (title.includes("thyroid")) return "🦋";
  return "◎";
}

function buildChangeDetector(reportInsights, t) {
  const trendItems = reportInsights?.guidedTrends?.items || reportInsights?.decision?.changeOverTime?.items || [];
  const rawTrends = Array.isArray(reportInsights?.trends) ? reportInsights.trends : [];
  const trendStatus = String(reportInsights?.guidedTrends?.status || reportInsights?.decision?.changeOverTime?.status || "").toLowerCase();
  const extractedCount = Array.isArray(reportInsights?.extractedValues) ? reportInsights.extractedValues.length : 0;
  const improved = trendItems.find((item) => /improv|better|lower|down/i.test(`${item.label || ""} ${item.state || ""}`))
    || rawTrends.find((trend) => /improv|better|lower|down/i.test(`${trend.direction || ""} ${trend.status || ""}`));
  const worsened = trendItems.find((item) => /worse|higher|up|review/i.test(`${item.label || ""} ${item.state || ""}`))
    || rawTrends.find((trend) => trend.needsReview || /worse|higher|up|review/i.test(`${trend.direction || ""} ${trend.status || ""}`));
  const stable = trendItems.find((item) => /stable|same|steady/i.test(`${item.label || ""} ${item.state || ""}`))
    || rawTrends.find((trend) => /stable|same|steady/i.test(`${trend.direction || ""} ${trend.status || ""}`));

  return [
    {
      key: "improved",
      mark: "↑",
      label: t("improving"),
      value: improved?.metric || improved?.metricLabel || improved?.parameter || t("none_yet"),
    },
    {
      key: "worsened",
      mark: "!",
      label: t("worth_discussing"),
      value: worsened?.metric || worsened?.metricLabel || worsened?.parameter || "No clear change",
    },
    {
      key: "stable",
      mark: "→",
      label: t("stable"),
      value: stable?.metric || stable?.metricLabel || stable?.parameter || "Not enough history",
    },
    {
      key: "context",
      mark: "?",
      label: t("needs_more_history"),
      value: /not enough|limited|manual|review/.test(trendStatus) || !extractedCount ? t("add_next_report") : t("health_notes"),
    },
  ];
}

export function ReportsPanel({
  records,
  reportCatalog,
  reportExtractionCapabilities,
  reportInsights,
  reportInsightsStatus,
  reportInsightsMonths,
  setReportInsightsMonths,
  activeAnalysisRecordId,
  setActiveAnalysisRecordId,
  recordAnalysisDrafts,
  updateRecordAnalysisDraft,
  autoSuggestRecordAnalysis,
  saveRecordAnalysis,
  openRecordUploader,
  recordsInputRef,
  uploadRecord,
  recordStatus,
  apiBase,
  deleteRecord,
  onStartPlan,
  onBookFollowup,
  onBookLabs,
  t,
}) {
  const { t: langT } = useLang();
  // eslint-disable-next-line no-param-reassign
  if (!t) t = langT;
  const catalogMap = new Map((reportCatalog || []).map((item) => [item.key, item]));
  const [reportViewMode, setReportViewMode] = useState("condition");
  const [reportSurfaceTab, setReportSurfaceTab] = useState("overview");
  const [focusReviewFields, setFocusReviewFields] = useState({});
  const hasReports = records.length > 0;
  const effectiveReportInsights = hasReports ? reportInsights : null;
  const groupedPanels = useMemo(() => {
    const trendMap = new Map((effectiveReportInsights?.trends || []).map((trend) => [trend.metricKey, trend]));
    const summaryMap = new Map((effectiveReportInsights?.conditionSummaries || []).map((item) => [item.key, item]));
    return getReportGroups(t).map((group) => {
      const trends = group.metricKeys.map((metricKey) => trendMap.get(metricKey)).filter(Boolean);
      return {
        ...group,
        trends,
        summary: summaryMap.get(group.key) || null,
      };
    }).filter((group) => group.trends.length || group.summary);
  }, [effectiveReportInsights, t]);
  const latestRecordDate = hasReports && records[0]?.created_at
    ? new Date(records[0].created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : t("none_yet");
  const reviewTrendCount = (effectiveReportInsights?.trends || []).filter((trend) => trend.needsReview).length;
  const keyFindings = useMemo(() => buildKeyFindings(effectiveReportInsights), [effectiveReportInsights]);
  const insightsFallback = useMemo(
    () => buildInsightsFallback(records, reportInsightsStatus),
    [records, reportInsightsStatus],
  );
  const focusSummary =
    (effectiveReportInsights?.conditionSummaries || []).find((item) => item.zone === "high") ||
    (effectiveReportInsights?.conditionSummaries || []).find((item) => item.zone === "low") ||
    effectiveReportInsights?.conditionSummaries?.[0] ||
    null;
  const highPriorityCount = (effectiveReportInsights?.conditionSummaries || []).filter((item) => item.zone === "high").length;
  const premiumSummaryLabel = highPriorityCount
    ? `${highPriorityCount} follow-up area${highPriorityCount === 1 ? "" : "s"} highlighted`
    : reviewTrendCount
      ? `${reviewTrendCount} value${reviewTrendCount === 1 ? "" : "s"} need review`
      : `${(effectiveReportInsights?.trends || []).length} tracked trend${(effectiveReportInsights?.trends || []).length === 1 ? "" : "s"}`;
  const guidedFollowUp = effectiveReportInsights?.guidedFollowUp || null;
  const overview = effectiveReportInsights?.overview || guidedFollowUp?.overview || null;
  const priorities = effectiveReportInsights?.priorities || guidedFollowUp?.priorities || [];
  const canWait = effectiveReportInsights?.canWait || guidedFollowUp?.canWait || [];
  const badgeFallbackPriorities = useMemo(
    () => (effectiveReportInsights?.badges || [])
      .filter((badge) => badge.zone === "high" || badge.zone === "low")
      .slice(0, 6)
      .map(priorityFromBadge),
    [effectiveReportInsights],
  );
  const displayPriorities = priorities.length ? priorities : badgeFallbackPriorities;
  const usingBadgeFallback = !priorities.length && badgeFallbackPriorities.length > 0;
  const guidedNextSteps = effectiveReportInsights?.nextSteps || guidedFollowUp?.nextSteps || null;
  const guidedDoctorQuestions = effectiveReportInsights?.doctorQuestions || guidedFollowUp?.doctorQuestions || [];
  const guidedTrends = effectiveReportInsights?.guidedTrends || guidedFollowUp?.trends || null;
  const safetyLayer = effectiveReportInsights?.safetyLayer || guidedFollowUp?.safety || null;
  const personalizedFollowUp = effectiveReportInsights?.personalizedFollowUp || null;
  const decision = effectiveReportInsights?.decision || {};
  const healthIssues = effectiveReportInsights?.healthIssues || {};
  const fixThisFirst = decision.fixThisFirst || healthIssues.fixThisFirst || null;
  const changeOverTime = decision.changeOverTime || healthIssues.changeOverTime || null;
  const doctorQuestions =
    personalizedFollowUp?.doctorQuestions?.length
      ? personalizedFollowUp.doctorQuestions
      : guidedDoctorQuestions.length
        ? guidedDoctorQuestions
        : (fixThisFirst?.doctorQuestions || []);
  const visibleDoctorQuestions = Array.from(
    new Set(doctorQuestions.map((question) => String(question || "").trim()).filter(Boolean)),
  ).slice(0, 3);
  const healthStatus = softenHealthStatus(decision.healthStatus || healthIssues.status || (records.length ? "Preparing summary" : "No report yet"));
  const recommendedAction = decision.recommendedAction || healthIssues.recommendedAction || "Upload a clear report";
  const magicSummaryItems = useMemo(
    () => buildMagicSummaryItems({ fixThisFirst, recommendedAction, changeOverTime, insightsFallback }),
    [fixThisFirst, recommendedAction, changeOverTime, insightsFallback],
  );
  const topInsight = buildTopInsight({
    patientSummary: overview?.headline || effectiveReportInsights?.patientSummary,
    focusSummary,
    safety: effectiveReportInsights?.safety,
    reviewTrendCount,
    fallbackText: insightsFallback,
    decision,
  });
  const reliefSupport = buildReliefSupport({
    focusSummary,
    reportInsights: effectiveReportInsights,
    fallbackText: "Upload one clear report and SehatSaathi will turn it into a calmer read.",
  });
  const primaryReportActionLabel = hasReports ? t("save_one_update") : t("upload_first_report");
  const reportGlanceItems = [
    {
      key: "attention",
      icon: hasReports ? iconForPriority(priorities[0]) : "📄",
      label: t("matters"),
      value: hasReports ? displayPriorities[0]?.title || t("one_attention_item") : t("upload_first_report"),
    },
    {
      key: "questions",
      icon: "🩺",
      label: t("doctor_questions"),
      value: hasReports && visibleDoctorQuestions.length
        ? t("questions_ready_visit", { n: visibleDoctorQuestions.length, s: visibleDoctorQuestions.length === 1 ? "" : "s" })
        : t("questions_to_ask"),
    },
    {
      key: "trend",
      icon: "📈",
      label: t("trend"),
      value: labelForTrendState(guidedTrends?.status, t),
    },
  ];
  const changeDetectorItems = hasReports ? buildChangeDetector(reportInsights, t) : buildChangeDetector(null, t);
  const handlePrimaryReportAction = () => {
    if (hasReports) {
      onStartPlan?.();
      return;
    }
    openRecordUploader();
  };

  return (
    <section className="panel">
      <div className="report-shell-hero">
        <div>
          <p className="eyebrow">{t("reports_eyebrow")}</p>
          <h2>{hasReports ? overview?.headline || t("reports_default_title") : t("reports_start_title")}</h2>
          <p className="panel-sub">{t("reports_subtitle")}</p>
        </div>
        <div className="report-shell-stats">
          <article className="report-shell-stat">
            <span className="mini-label">{t("reports_count")}</span>
            <strong>{records.length}</strong>
            <span className="micro">{t("uploaded_label")}</span>
          </article>
          <article className="report-shell-stat">
            <span className="mini-label">{t("latest_upload")}</span>
            <strong>{latestRecordDate}</strong>
            <span className="micro">{t("latest_label")}</span>
          </article>
        </div>
      </div>
      <div className="report-insights-topbar">
        <div className="action-row">
          <button type="button" className="primary" onClick={handlePrimaryReportAction}>{primaryReportActionLabel}</button>
          {hasReports ? (
            <button type="button" className="primary" onClick={openRecordUploader}>
              {t("upload_report")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="report-change-detector" aria-label="What changed in reports">
        {changeDetectorItems.map((item) => (
          <article key={item.key} className={`report-change-signal is-${item.key}`}>
            <span>{item.mark}</span>
            <strong>{item.label}</strong>
            <small>{item.value}</small>
          </article>
        ))}
      </div>
      <div className="surface-story-strip surface-story-strip-reports">
        {reportGlanceItems.map((item) => (
          <article key={item.key} className="surface-story-pill">
            <div className="surface-story-pill-head">
              <span className="surface-story-icon" aria-hidden="true">{item.icon}</span>
              <span className="surface-story-label">{item.label}</span>
            </div>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
      <input
        ref={recordsInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif,application/pdf,.pdf"
        onChange={uploadRecord}
        style={{ display: "none" }}
      />
      {recordStatus && <p className="micro">{recordStatus}</p>}
      {reportInsightsStatus && !/processing/i.test(reportInsightsStatus) && <p className="micro">{reportInsightsStatus}</p>}
      <div className="report-surface-switch" role="tablist" aria-label="Report sections">
        <button
          type="button"
          className={reportSurfaceTab === "overview" ? "active" : ""}
          onClick={() => setReportSurfaceTab("overview")}
        >
          {t("overview_tab")}
        </button>
        <button
          type="button"
          className={reportSurfaceTab === "trends" ? "active" : ""}
          onClick={() => setReportSurfaceTab("trends")}
        >
          {t("trends_tab")}
        </button>
        <button
          type="button"
          className={reportSurfaceTab === "records" ? "active" : ""}
          onClick={() => setReportSurfaceTab("records")}
        >
          {t("my_reports_tab")}
        </button>
      </div>

      {reportSurfaceTab === "overview" ? (
        <div className="report-insight-summary panel-subsection">
          <div className="report-ai-shell compact-shell">

            {/* ── Doctor questions — hero position ── */}
            <section className="report-doctor-questions-hero">
              <div className="report-dqh-header">
                <p className="mini-label">{t("ask_your_doctor")}</p>
                <h3>{visibleDoctorQuestions.length
                  ? t("questions_ready_visit", { n: visibleDoctorQuestions.length, s: visibleDoctorQuestions.length === 1 ? "" : "s" })
                  : t("questions_to_ask")}</h3>
                <p className="micro">
                  {visibleDoctorQuestions.length
                    ? t("questions_save_hint")
                    : t("question_fallback")}
                </p>
              </div>
              <ol className="report-dqh-list">
                {visibleDoctorQuestions.length ? visibleDoctorQuestions.map((question, index) => (
                  <li key={`dqh-${index}`} className="report-dqh-item">
                    <span className="report-dqh-num">{index + 1}</span>
                    <span className="micro">{question}</span>
                  </li>
                )) : (
                  <li className="report-dqh-item">
                    <span className="report-dqh-num">🩺</span>
                    <span className="micro">{t("question_fallback")}</span>
                  </li>
                )}
              </ol>
              {visibleDoctorQuestions.length > 0 && (
                <button
                  type="button"
                  className="report-dqh-share"
                  onClick={() => {
                    const text = `Questions for my doctor:\n${visibleDoctorQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  📱 {t("send_doctor_whatsapp")}
                </button>
              )}
            </section>

            {personalizedFollowUp?.priorityArea ? (
              <section className="report-doctor-questions-cta">
                <div>
                  <p className="mini-label">{t("what_matters_most")}</p>
                  <h3>{personalizedFollowUp.priorityArea.title}</h3>
                  {personalizedFollowUp.priorityArea.findingLabel ? (
                    <p className="micro">
                      {personalizedFollowUp.priorityArea.findingLabel}
                      {personalizedFollowUp.priorityArea.findingValue ? ` • ${personalizedFollowUp.priorityArea.findingValue}` : ""}
                    </p>
                  ) : null}
                  <p className="micro">{personalizedFollowUp.priorityArea.whatThisMeans}</p>
                  {personalizedFollowUp.priorityArea.personalFactors?.length ? (
                    <p className="micro">
                      {t("because_you_have", { items: personalizedFollowUp.priorityArea.personalFactors.join(" • ") })}
                    </p>
                  ) : null}
                </div>
                <div className="history-list compact-list">
                  {personalizedFollowUp.priorityArea.whyThisMatters?.length ? (
                    <article className="history-card">
                      <p className="history-headline">{t("why_matters_you")}</p>
                      <p className="micro">{personalizedFollowUp.priorityArea.whyThisMatters.slice(0, 3).join(" • ")}</p>
                    </article>
                  ) : null}
                  {personalizedFollowUp.priorityArea.urgencyNote ? (
                    <article className="history-card">
                      <p className="history-headline">{t("followup_read")}</p>
                      <p className="micro">{personalizedFollowUp.priorityArea.urgencyNote}</p>
                    </article>
                  ) : null}
                </div>
              </section>
            ) : null}

            {personalizedFollowUp?.secondaryAreas?.length ? (
              <section className="report-doctor-questions-cta">
                <div>
                  <p className="mini-label">{t("also_worth_knowing")}</p>
                  <h3>{t("other_report_items")}</h3>
                </div>
                <div className="history-list compact-list">
                  {personalizedFollowUp.secondaryAreas.slice(0, 3).map((item, index) => {
                    const findingLine = (item.findings || []).join(" • ");
                    const hideFindingLine =
                      !findingLine ||
                      normalizeLabel(findingLine) === normalizeLabel(item.title) ||
                      ((item.findings || []).length === 1 && normalizeLabel(item.findings[0]) === normalizeLabel(item.title));
                    return (
                    <article key={`secondary-area-${index}`} className="history-card">
                      <p className="history-headline">{item.title}</p>
                      {!hideFindingLine ? <p className="micro">{findingLine}</p> : null}
                      <p className="micro">{item.summary}</p>
                    </article>
                  )})}
                </div>
              </section>
            ) : null}

            {personalizedFollowUp?.stableAreas?.length || personalizedFollowUp?.oneClearFocus ? (
              <section className="report-doctor-questions-cta">
                <div>
                  <p className="mini-label">{t("where_to_start")}</p>
                  <h3>{personalizedFollowUp?.oneClearFocus || t("one_attention_item")}</h3>
                  <p className="micro">{t("focus_first_stable")}</p>
                </div>
                <div className="history-list compact-list">
                  {personalizedFollowUp?.stableAreas?.length ? (
                    <article className="history-card">
                      <p className="history-headline">{t("stable_areas")}</p>
                      <p className="micro">{personalizedFollowUp.stableAreas.join(" • ")}</p>
                    </article>
                  ) : null}
                  {personalizedFollowUp?.doctorHandoff?.suggestedFocus ? (
                    <article className="history-card">
                      <p className="history-headline">{t("for_your_doctor")}</p>
                      <p className="micro">{personalizedFollowUp.doctorHandoff.suggestedFocus}</p>
                    </article>
                  ) : null}
                </div>
              </section>
            ) : null}

            <div className="report-ai-hero">
              <div className="report-ai-summary">
                <p className="micro strong">
                  {personalizedFollowUp?.priorityArea ? t("full_details") : t("your_results")}
                </p>
                {!personalizedFollowUp?.priorityArea ? (
                  <>
                    <h3>{displayPriorities[0]?.title || (usingBadgeFallback ? t("auto_read_review") : t("results_after_review"))}</h3>
                    <p className="micro report-ai-summary-brief">
                      {displayPriorities[0]?.summary || t("important_findings")}
                    </p>
                    <p className="micro report-ai-relief-copy">
                      {displayPriorities[0]?.whyHighlighted?.[0] || t("grouped_relevant")}
                    </p>
                  </>
                ) : (
                  <p className="micro report-ai-summary-brief">
                    {t("important_findings")}
                  </p>
                )}
                <div className="report-ai-findings">
                  <div className="report-ai-findings-head">
                    <span className="mini-label">{t("your_results")}</span>
                    <span className="micro">{displayPriorities.length ? displayPriorities.length : t("reviewing")}</span>
                  </div>
                  <div className="report-ai-finding-list">
                    {displayPriorities.length ? displayPriorities.map((finding) => (
                      <div key={finding.id} className="report-ai-finding">
                        <span className={`report-ai-step-dot is-${toneFromAttention(finding.attentionLevel)}`} aria-hidden="true" />
                        <div>
                          <p className="history-headline">
                            {finding.title || finding.findingLabel}
                            <span className={`report-v2-inline-status is-${toneFromAttention(finding.attentionLevel)}`}> {finding.attentionLabel}</span>
                          </p>
                          <p className="micro">{finding.summary}</p>
                          {finding.includedFindings?.length ? (
                            <p className="micro">{finding.includedFindings.map((item) => item.label).join(" • ")}</p>
                          ) : null}
                          <p className="micro">{finding.whyHighlighted?.[0] || finding.suggestedTimeframeLabel}</p>
                        </div>
                      </div>
                    )) : (
                      <article className="report-empty-state-card">
                        <strong>{t("results_after_review")}</strong>
                        <p className="micro">
                          {hasReports
                            ? t("results_saved_empty")
                            : t("upload_clear_empty")}
                        </p>
                      </article>
                    )}
                  </div>
                </div>
              </div>

              {!personalizedFollowUp?.secondaryAreas?.length ? (
                <div className="report-ai-focus">
                  <p className="mini-label">{canWait[0] ? t("stable_right_now") : usingBadgeFallback ? t("other_flags") : t("stable_right_now")}</p>
                  <strong>{canWait[0]?.title || canWait[0]?.findingLabel || (usingBadgeFallback ? t("confirm_against_report") : t("everything_stable"))}</strong>
                  <p className={`micro ${canWait[0] ? `report-zone-${toneFromAttention(canWait[0].attentionLevel)}` : ""}`}>
                    {canWait[0]?.summary || (usingBadgeFallback ? t("extracted_flags_note") : t("stable_explanation"))}
                  </p>
                  {canWait[1] ? (
                    <div className="report-next-step-cue">
                      <p className="mini-label">{t("also_stable")}</p>
                      <strong>{canWait[1].title || canWait[1].findingLabel}</strong>
                      <p className="micro">{canWait[1].summary}</p>
                    </div>
                  ) : null}
                  <div className="report-ai-badge-row">
                    {(effectiveReportInsights?.badges || []).slice(0, 6).map((badge) => (
                      <div key={badge.key} className={`report-badge report-zone-${badge.zone}`}>{badge.label}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Doctor questions shown at top — not repeated here */}

            <div className="report-mobile-accordion-grid">
              <details className="report-mobile-disclosure">
                <summary>
                  <span>{t("trends_over_time")}</span>
                  <span className="micro">{labelForTrendState(guidedTrends?.status, t)}</span>
                </summary>
                <div className="report-ai-context-row report-ai-context-row-compact">
                  <article className="report-ai-context-card">
                    <p className="mini-label">{t("trend_read")}</p>
                    <strong>{guidedTrends?.summary || t("more_reports_needed")}</strong>
                    <p className="micro">
                      {(guidedTrends?.items || []).slice(0, 3).map((item) => `${item.metric}: ${item.label}`).join(" • ") || t("one_report_no_trend")}
                    </p>
                  </article>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : null}

      {reportSurfaceTab === "trends" ? (
        <div className="report-insight-summary panel-subsection">
          <div className="report-trends-toolbar">
            <label className="report-month-filter">
              {t("trend_window")}
              <select value={String(reportInsightsMonths)} onChange={(event) => setReportInsightsMonths(Number(event.target.value))}>
                <option value="3">{t("months_3")}</option>
                <option value="6">{t("months_6")}</option>
                <option value="12">{t("months_12")}</option>
              </select>
            </label>
          </div>
          <div className="report-view-switch">
            <button
              type="button"
              className={reportViewMode === "condition" ? "active" : ""}
              onClick={() => setReportViewMode("condition")}
            >
              {t("condition_view")}
            </button>
            <button
              type="button"
              className={reportViewMode === "metrics" ? "active" : ""}
              onClick={() => setReportViewMode("metrics")}
            >
              {t("all_metrics_view")}
            </button>
          </div>
          {reportViewMode === "condition" ? (
            <div className="report-condition-stack">
              {groupedPanels.length ? groupedPanels.map((panel) => (
                <article key={panel.key} className="report-condition-panel">
                  <div className="report-condition-head">
                    <div>
                      <p className="micro strong">{panel.title}</p>
                      <h3>{panel.summary?.title || panel.title}</h3>
                    </div>
                    {panel.summary ? (
                      <span className={`report-badge report-zone-${panel.summary.zone}`}>{panel.summary.zone === "high" ? t("worth_attention") : panel.summary.zone === "low" ? t("monitor_over_time") : t("stable")}</span>
                    ) : null}
                  </div>
                  <p className="micro report-panel-summary">{panel.summary?.summary || "Tracked metrics grouped together for easier comparison."}</p>
                  <div className="report-trend-grid report-trend-grid-condensed">
                    {panel.trends.map((trend) => (
                      <ReportTrendChart
                        key={trend.metricKey}
                        title={trend.metricLabel}
                        unit={trend.unit}
                        points={trend.points}
                        zone={trend.zone}
                        needsReview={trend.needsReview}
                      />
                    ))}
                  </div>
                </article>
              )) : <p className="micro">{t("grouped_trends_empty")}</p>}
            </div>
          ) : (
            <div className="report-trend-grid">
              {(effectiveReportInsights?.trends || []).map((trend) => (
                <ReportTrendChart
                  key={trend.metricKey}
                  title={trend.metricLabel}
                  unit={trend.unit}
                  points={trend.points}
                  zone={trend.zone}
                  needsReview={trend.needsReview}
                />
              ))}
              {!(effectiveReportInsights?.trends || []).length ? <p className="micro">{t("trends_empty")}</p> : null}
            </div>
          )}
        </div>
      ) : null}

      {reportSurfaceTab === "records" ? (
      <div className="history-list">
        {records.length === 0 ? (
          <p className="micro">{t("no_reports_uploaded")}</p>
        ) : (
          records.map((r) => {
            const draft = recordAnalysisDrafts[r.id] || { reportType: "", reportDate: "", notes: "", metrics: {} };
            const hasStructuredAnalysis = Boolean(r.analysis || (Array.isArray(r.analyses) && r.analyses.length > 0));
            const primaryAnalysis = r.analysis || (Array.isArray(r.analyses) ? r.analyses[0] : null);
            const selectedCatalog = catalogMap.get(draft.reportType);
            const isOpen = activeAnalysisRecordId === r.id;
            const fileTypeLabel = String(r.mimetype || "").includes("pdf") ? t("file_pdf") : String(r.mimetype || "").startsWith("image/") ? t("file_image") : t("file_generic");
            const reportDisplayName = friendlyReportName(r, catalogMap);
            const statusLabel = hasStructuredAnalysis
              ? t("report_reviewed")
              : primaryAnalysis || r.extraction?.suggested_report_type
                ? t("report_needs_values")
                : t("report_uploaded");
            const reviewMetricKeys = new Set(
              (selectedCatalog?.metrics || [])
                .filter((metric) => {
                  const confidence = Number(draft.autoSuggestionMeta?.metricConfidences?.[metric.key]);
                  const hasValue =
                    draft.metrics?.[metric.key] !== "" &&
                    draft.metrics?.[metric.key] !== null &&
                    draft.metrics?.[metric.key] !== undefined;
                  return !hasValue || !Number.isFinite(confidence) || confidence < 0.88;
                })
                .map((metric) => metric.key),
            );
            const metricsToRender =
              focusReviewFields[r.id] && reviewMetricKeys.size
                ? (selectedCatalog?.metrics || []).filter((metric) => reviewMetricKeys.has(metric.key))
                : selectedCatalog?.metrics || [];
            return (
              <div key={r.id} className="history-card report-record-card">
                <div className="report-record-head">
                  <div>
                    <div className="report-record-meta-row">
                      <span className="report-record-file-chip">{fileTypeLabel}</span>
                      {r.source_label ? <span className="report-record-source-chip">{r.source_label}</span> : null}
                      <span className="micro">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="history-headline">{reportDisplayName}</p>
                    <p className="micro">
                      {primaryAnalysis
                        ? `${catalogMap.get(primaryAnalysis.reportType)?.label || primaryAnalysis.reportType}${primaryAnalysis.reportDate ? ` • ${primaryAnalysis.reportDate}` : ""}`
                        : t("safely_saved_record")}
                    </p>
                  </div>
                  <span className={`report-record-status ${hasStructuredAnalysis ? "is-processed" : "is-pending"}`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="micro report-record-support-copy">
                  {hasStructuredAnalysis
                    ? t("report_ready_trends")
                    : statusLabel === t("report_needs_values")
                      ? t("report_review_values")
                      : t("report_private_saved")}
                </p>
                <div className="action-row">
                  <button type="button" className="primary" onClick={() => setActiveAnalysisRecordId(isOpen ? null : r.id)}>
                    {isOpen ? t("close_details") : hasStructuredAnalysis ? t("review_report") : t("add_values")}
                  </button>
                  {r.downloadUrl ? (
                    <a className="secondary" href={`${apiBase}${r.downloadUrl}`} target="_blank" rel="noreferrer">{t("download")}</a>
                  ) : null}
                  <button type="button" className="ghost" onClick={() => deleteRecord(r.id)}>
                    {t("removeRecord")}
                  </button>
                </div>
                {isOpen ? (
                  <div className="report-analysis-editor">
                    {draft.autoSuggestionMeta ? (
                      <div className="history-card">
                        <p className="history-headline">{t("extraction_review")}</p>
                        {r.source_label ? <p className="micro report-record-source-note">{t("uploaded_by", { source: r.source_label.toLowerCase() })}</p> : null}
                        <p className="micro">
                          {t("confidence")}: {draft.autoSuggestionMeta.overallConfidence != null ? `${Math.round(Number(draft.autoSuggestionMeta.overallConfidence) * 100)}%` : t("not_available")}
                          {draft.autoSuggestionMeta.detectedLabSource ? ` • ${draft.autoSuggestionMeta.detectedLabSource}` : ""}
                        </p>
                        <p className={`micro ${draft.autoSuggestionMeta.needsReview ? "report-zone-low" : "report-zone-normal"}`}>
                          {draft.autoSuggestionMeta.needsReview
                            ? t("extraction_needs_review")
                            : t("extraction_strong")}
                        </p>
                        {draft.autoSuggestionMeta.needsReview ? (
                          <p className="micro">{t("partial_report_help")}</p>
                        ) : null}
                        {(draft.autoSuggestionMeta.detectedSections || []).length ? (
                          <div className="history-list compact-list">
                            {draft.autoSuggestionMeta.detectedSections.map((section) => (
                              <div key={`${r.id}-${section.key}`} className="history-card">
                                <p className="history-headline">{section.label}</p>
                                <p className="micro">
                                  {section.metricCount} matched value{section.metricCount === 1 ? "" : "s"}
                                  {section.matchedMetrics?.length ? ` • ${section.matchedMetrics.join(", ")}` : ""}
                                </p>
                                <p className="micro">{section.excerpt || "No section preview available."}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="report-analysis-grid">
                      <label>
                        {t("report_type")}
                        <select
                          value={draft.reportType}
                          onChange={(event) => updateRecordAnalysisDraft(r.id, { reportType: event.target.value })}
                        >
                          <option value="">{t("select_report_type")}</option>
                          {(reportCatalog || []).map((item) => (
                            <option key={`report-type-${item.key}`} value={item.key}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Report date
                        <input
                          type="date"
                          value={draft.reportDate}
                          onChange={(event) => updateRecordAnalysisDraft(r.id, { reportDate: event.target.value })}
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(event) => updateRecordAnalysisDraft(r.id, { notes: event.target.value })}
                          placeholder="Optional report note"
                        />
                      </label>
                      <label className="report-analysis-wide">
                        Paste report text / OCR text
                        <textarea
                          value={draft.extractedText || ""}
                          onChange={(event) => updateRecordAnalysisDraft(r.id, { extractedText: event.target.value })}
                          placeholder="Paste report text here, or leave blank and use the file auto-detect path."
                          rows={5}
                        />
                      </label>
                    </div>
                    {selectedCatalog ? (
                    <div className="report-analysis-grid report-metric-grid">
                        {reviewMetricKeys.size ? (
                          <div className="report-analysis-wide history-card">
                            <p className="history-headline">{t("review_fields")}</p>
                            <p className="micro">
                              {reviewMetricKeys.size} field{reviewMetricKeys.size === 1 ? "" : "s"} need review because the value is missing or OCR confidence is low.
                            </p>
                            <div className="action-row">
                              <button
                                type="button"
                                className={focusReviewFields[r.id] ? "primary" : "secondary"}
                                onClick={() =>
                                  setFocusReviewFields((prev) => ({
                                    ...prev,
                                    [r.id]: !prev[r.id],
                                  }))
                                }
                              >
                                {focusReviewFields[r.id] ? "Show all fields" : "Focus review fields"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {metricsToRender.map((metric) => (
                          <label key={`${r.id}-${metric.key}`}>
                            {metric.label} ({metric.unit})
                            <input
                              type="number"
                              step="any"
                              value={draft.metrics?.[metric.key] ?? ""}
                              onChange={(event) =>
                                updateRecordAnalysisDraft(r.id, {
                                  metrics: {
                                    ...(draft.metrics || {}),
                                    [metric.key]: event.target.value,
                                  },
                                })
                              }
                            />
                            {draft.autoSuggestionMeta?.metricConfidences?.[metric.key] != null ? (
                              <span className={`micro ${Number(draft.autoSuggestionMeta.metricConfidences[metric.key]) < 0.88 ? "report-zone-low" : "report-zone-normal"}`}>
                                Confidence: {Math.round(Number(draft.autoSuggestionMeta.metricConfidences[metric.key]) * 100)}%
                                {Number(draft.autoSuggestionMeta.metricConfidences[metric.key]) < 0.88 ? " • Needs review" : ""}
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <div className="action-row">
                      <button type="button" className="secondary" onClick={() => autoSuggestRecordAnalysis(r.id)}>
                        Auto-detect values
                      </button>
                      <button type="button" className="primary" onClick={() => saveRecordAnalysis(r.id)}>
                        Save report values
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      ) : null}
    </section>
  );
}
