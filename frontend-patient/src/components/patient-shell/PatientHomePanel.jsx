/* ─────────────────────────────────────────────────────────────
   PatientHomePanel — Today Screen
   Design principle: answer 3 questions within 5 seconds.
     1. What changed?   → Health brief
     2. What matters?   → Doctor questions (THE MAGIC MOMENT)
     3. What should I do?  → One clear CTA
   ───────────────────────────────────────────────────────────── */
import { useLang } from "../../i18n.js";
import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";
function apiUrl(path) { return `${String(API_BASE).replace(/\/$/, "")}${path}`; }

function useRetentionSummary(memberId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem("health_token");
    if (!token) return;
    const params = memberId ? `?memberId=${memberId}` : "";
    fetch(apiUrl(`/api/retention-summary${params}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, [memberId]);
  return data;
}

function RetentionBar({ retention, actionMap, records }) {
  const { t } = useLang();
  const items = [];

  // ── 1. Streak ──────────────────────────────────────────────────
  const streak = retention?.streak || 0;
  if (streak >= 2) {
    items.push({
      icon: "🔥",
      label: streak === 1 ? "1 day streak" : `${streak} day streak`,
      sub: "Check-ins completed",
    });
  }

  // ── 2. Improvement badge ────────────────────────────────────────
  const imp = actionMap?.improvement;
  if (imp?.pct >= 3) {
    items.push({
      icon: "📈",
      label: `${imp.pct}% better`,
      sub: `${actionMap.metricLabel} since last report`,
    });
  }

  // ── 3. Next retest countdown ────────────────────────────────────
  const retestDays = actionMap?.retestDays;
  const latestReportDate = retention?.latestReportDate || records?.[0]?.created_at;
  if (retestDays && latestReportDate) {
    const due = new Date(latestReportDate);
    due.setDate(due.getDate() + retestDays);
    const daysLeft = Math.round((due - Date.now()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 30) {
      items.push({ icon: "🗓️", label: `Retest in ${daysLeft}d`, sub: actionMap.metricLabel });
    } else if (daysLeft <= 0) {
      items.push({ icon: "⏰", label: "Retest overdue", sub: `Upload new ${actionMap.metricLabel} report` });
    }
  }

  // ── 4. Healthy baseline nudge (no abnormal metrics) ─────────────
  const daysActive = retention?.daysActive30 || 0;
  if (!actionMap && records?.length > 0) {
    items.push({
      icon: "✅",
      label: "All markers stable",
      sub: daysActive > 0 ? `${daysActive} active days this month` : "Upload next report in 3 months",
    });
  }

  if (!items.length) return null;

  return (
    <div className="ph-retention-bar">
      {items.map((item, i) => (
        <div key={i} className="ph-retention-chip">
          <span className="ph-retention-icon">{item.icon}</span>
          <div className="ph-retention-text">
            <strong>{item.label}</strong>
            <span>{item.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function shorten(text = "", fallback = "") {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  const firstSentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const result = (firstSentenceMatch?.[0] || normalized).trim();
  return result.length > 110 ? `${result.slice(0, 107).trimEnd()}...` : result;
}

function signalLabelFor(key = "", t) {
  const map = {
    diabetes:     t("signal_blood_sugar"),
    lipid:        t("signal_cholesterol"),
    thyroid:      t("signal_thyroid"),
    ckd:          t("signal_kidneys"),
    anemia:       t("signal_blood_count"),
    liver:        t("signal_liver"),
    allergy:      t("signal_allergy"),
    anthropometry:t("signal_weight"),
  };
  return map[key] || t("signal_health_marker");
}

function signalBadge(zone = "normal", t) {
  if (zone === "high") return t("badge_discussing");
  if (zone === "low")  return t("badge_eye_on");
  return t("badge_stable");
}

function buildSignals(reportInsights, records = [], t) {
  const issues = reportInsights?.healthIssues?.all || [];
  if (issues.length) {
    const seen = new Set();
    return issues.reduce((items, issue) => {
      if (items.length >= 3) return items;
      const label = issue.focusLabel || signalLabelFor(issue.focusKey, t);
      const dedupeKey = String(issue.focusKey || label || issue.key || "").trim().toLowerCase();
      if (seen.has(dedupeKey)) return items;
      seen.add(dedupeKey);
      items.push({
        key: issue.focusKey || issue.key,
        label,
        zone: issue.status === "NORMAL" ? "normal" : issue.severity === "CRITICAL" ? "high" : "low",
        badge: issue.status === "NORMAL" ? t("badge_stable") : t("badge_discussing"),
      });
      return items;
    }, []);
  }
  const summaries = reportInsights?.conditionSummaries || [];
  if (!summaries.length) {
    if (Array.isArray(records) && records.length) {
      return [{
        key: "latest", label: t("signal_latest_report"),
        zone: "normal", badge: t("signal_uploaded"),
      }];
    }
    return [];
  }
  return summaries
    .slice().sort((a, b) => { const o = { high: 0, low: 1, normal: 2 }; return (o[a.zone] ?? 2) - (o[b.zone] ?? 2); })
    .slice(0, 3)
    .map((item) => ({
      key:   item.key,
      label: signalLabelFor(item.key, t),
      zone:  item.zone || "normal",
      badge: signalBadge(item.zone, t),
    }));
}

function getQuestions(reportInsights) {
  const qs =
    reportInsights?.personalizedFollowUp?.doctorQuestions?.length
      ? reportInsights.personalizedFollowUp.doctorQuestions
      : reportInsights?.doctorQuestions || reportInsights?.guidedFollowUp?.doctorQuestions || [];
  return Array.from(new Set(qs.map((q) => String(q || "").trim()).filter(Boolean))).slice(0, 3);
}

function timeGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t("greeting_morning") || "Good morning";
  if (h < 17) return t("greeting_afternoon") || "Good afternoon";
  return t("greeting_evening") || "Good evening";
}

/* ─── Empty state ─────────────────────────────────────────────── */
function EmptyToday({ onUpload }) {
  const { t } = useLang();
  return (
    <div>
      <div className="ph-empty-card">
        <div className="ph-empty-mark">🩺</div>
        <h2>{t("empty_upload_headline") || "Upload one report. Understand it clearly."}</h2>
        <p>{t("upload_prompt_sub")}</p>
        <button type="button" className="ph-empty-cta" onClick={onUpload}>
          {t("upload_cta")}
        </button>
      </div>

      <div className="ph-empty-steps" style={{ marginTop: 12 }}>
        <div className="ph-empty-step">
          <div className="ph-empty-step-num">1</div>
          <strong>{t("how_understand_title")}</strong>
          <span>{t("empty_step1") || "What the numbers actually mean for you."}</span>
        </div>
        <div className="ph-empty-step">
          <div className="ph-empty-step-num">2</div>
          <strong>{t("what_matters")}</strong>
          <span>{t("empty_step2") || "One clear area to keep an eye on."}</span>
        </div>
        <div className="ph-empty-step">
          <div className="ph-empty-step-num">3</div>
          <strong>{t("doctor_questions")}</strong>
          <span>{t("empty_step3") || "3 questions, already written for you."}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
export function PatientHomePanel({
  profileForm,
  records = [],
  setActivePatientTab,
  reportInsights,
  user,
}) {
  const { t } = useLang();
  const hasReports = Array.isArray(records) && records.length > 0;
  const firstName  = String(profileForm?.name || profileForm?.firstName || "").split(" ")[0] || "";
  const greeting   = timeGreeting(t);
  const memberId   = user?.activeMemberId || null;
  const retention  = useRetentionSummary(memberId);

  if (!hasReports) {
    return (
      <section className="patient-home-panel">
        <div className="ph-greeting">
          <p className="ph-greeting-time">{greeting}</p>
          <h1>{firstName ? <>{firstName}.</> : <>{t("upload_prompt")}</>}</h1>
        </div>
        <EmptyToday onUpload={() => setActivePatientTab("reports")} />
      </section>
    );
  }

  /* ── Derive content ─────────────────────────────────────────── */
  const signals   = buildSignals(reportInsights, records, t);
  const questions = getQuestions(reportInsights);
  const topSignal = signals[0] || null;

  const briefHeadline = (() => {
    if (!topSignal) return t("reports_ready") || "Your reports are ready to review.";
    if (topSignal.zone === "high")
      return `${topSignal.label} ${t("needs_attention") || "needs attention."} ${t("else_stable") || "Everything else looks stable."}`;
    if (topSignal.zone === "low")
      return `${topSignal.label} ${t("worth_eye") || "is worth keeping an eye on."} ${t("else_fine") || "Everything else looks fine."}`;
    return t("all_stable") || "All your key markers look stable right now.";
  })();

  const briefSub = shorten(
    reportInsights?.overview?.summary ||
    reportInsights?.decision?.fixThisFirst?.body ||
    reportInsights?.patientSummary ||
    "",
    hasReports ? t("open_reports_cta") || "Open Reports to see the full picture." : ""
  );

  const isAttention = topSignal?.zone === "high";
  const headlineClass = `ph-brief-headline${isAttention ? " is-high" : ""}`;

  return (
    <section className="patient-home-panel">

      {/* ── Greeting ─────────────────────────────────────────── */}
      <div className="ph-greeting">
        <p className="ph-greeting-time">{greeting}{firstName ? `, ${firstName}` : ""}</p>
        <h1>{t("your_health_today") || <>Your health, <strong>today.</strong></>}</h1>
      </div>

      {/* ── Health Brief ─────────────────────────────────────── */}
      <div className="ph-brief-card">
        <p className={headlineClass}>
          {isAttention
            ? <>{topSignal.label} {t("needs_attention") || "needs attention."} <strong>{t("else_stable") || "Everything else looks stable."}</strong></>
            : briefHeadline}
        </p>
        {briefSub && <p className="ph-brief-sub">{briefSub}</p>}
        <button
          type="button"
          className="ph-brief-cta"
          onClick={() => setActivePatientTab("reports")}
        >
          {t("see_full_report") || "See your full report"} <span className="ph-brief-cta-arrow">→</span>
        </button>
      </div>

      {/* ── Retention bar ────────────────────────────────────── */}
      <RetentionBar
        retention={retention}
        actionMap={reportInsights?.actionMap}
        records={records}
      />

      {/* ── Doctor Questions — THE MAGIC MOMENT ──────────────── */}
      {questions.length > 0 ? (
        <div className="ph-questions-card">
          <div className="ph-questions-header">
            <div className="ph-questions-icon">💬</div>
            <div>
              <p className="ph-questions-title">{t("for_next_visit") || "For your next visit"}</p>
              <p className="ph-questions-count">
                {questions.length} {questions.length === 1 ? t("question_single") || "question" : t("questions_label") || "questions"} {t("ready_for_doctor") || "ready for your doctor"}
              </p>
            </div>
          </div>
          <ol className="ph-questions-list">
            {questions.map((q, i) => (
              <li key={`q-${i}`} className="ph-questions-item">
                <span className="ph-questions-num">{i + 1}</span>
                <span className="ph-questions-text">{q}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        /* Nudge to generate questions by uploading */
        <div
          className="ph-nudge"
          role="button"
          tabIndex={0}
          onClick={() => setActivePatientTab("reports")}
          onKeyDown={(e) => e.key === "Enter" && setActivePatientTab("reports")}
        >
          <div className="ph-nudge-icon">💬</div>
          <div className="ph-nudge-body">
            <strong>{t("no_questions_yet") || "No questions saved yet"}</strong>
            <p>{t("open_report_questions") || "Open your report to find questions worth taking to your doctor."}</p>
          </div>
          <span className="ph-nudge-arrow">›</span>
        </div>
      )}

      {/* ── Markers at a glance ──────────────────────────────── */}
      {signals.length > 0 && (
        <div className="ph-markers-card">
          <p className="ph-markers-label">{t("results_glance") || "Your results at a glance"}</p>
          {signals.map((s) => (
            <div key={s.key} className="ph-marker-row">
              <span className={`ph-marker-dot is-${s.zone}`} aria-hidden="true" />
              <span className="ph-marker-name">{s.label}</span>
              <span className={`ph-marker-badge is-${s.zone}`}>{s.badge}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload next report nudge ──────────────────────────── */}
      <div
        className="ph-nudge"
        role="button"
        tabIndex={0}
        onClick={() => setActivePatientTab("reports")}
        onKeyDown={(e) => e.key === "Enter" && setActivePatientTab("reports")}
      >
        <div className="ph-nudge-icon">📋</div>
        <div className="ph-nudge-body">
          <strong>{t("add_next_report") || "Add your next report"}</strong>
          <p>{t("focus_grouped") || "Focus on the grouped findings first."}</p>
        </div>
        <span className="ph-nudge-arrow">›</span>
      </div>

    </section>
  );
}
