import { useState, useRef, useEffect } from "react";
import { useLang } from "../../i18n.js";

/* ── Tracker definitions — labels/hints/quick-options come from i18n ── */
function getTRACKERS(t) {
  return [
    {
      key: "bloodSugar",    thread: "sugar",    icon: "🩸",
      accent: "#D4781A", accentBg: "#FEF3E2",
      label: t("blood_sugar"),    short: t("blood_sugar"),
      unit: "mg/dL",  placeholder: t("ph_sugar"),   inputMode: "decimal",
      hint: t("hint_sugar"),
      quick: ["90", "110", "130", "150", "180"],
    },
    {
      key: "bloodPressure", thread: "heart",    icon: "🫀",
      accent: "#C0393E", accentBg: "#FEF0F0",
      label: t("blood_pressure"), short: t("blood_pressure"),
      unit: "mmHg",   placeholder: t("ph_bp"),       inputMode: "text",
      hint: t("hint_bp"),
      quick: ["110/70", "120/80", "130/85", "140/90"],
    },
    {
      key: "walking",       thread: "activity", icon: "🚶",
      accent: "#059669", accentBg: "#ECFDF5",
      label: t("activity"),       short: t("activity"),
      unit: "min",    placeholder: t("ph_walking"),  inputMode: "decimal",
      hint: t("hint_walking"),
      quick: ["10", "20", "30", "45", "60"],
    },
    {
      key: "medication",    thread: "medicine", icon: "💊",
      accent: "#1B7A4E", accentBg: "#EDF7F2",
      label: t("medicine"),       short: t("medicine"),
      unit: "",       placeholder: t("ph_medicine"), inputMode: "text",
      hint: t("hint_medicine"),
      quick: [t("quick_taken_time"), t("quick_missed_dose"), t("quick_took_late"), t("quick_changed_dose")],
    },
    {
      key: "weight",        thread: "weight",   icon: "⚖️",
      accent: "#2563EB", accentBg: "#EFF6FF",
      label: t("weight"),         short: t("weight"),
      unit: "kg",     placeholder: t("ph_weight"),  inputMode: "decimal",
      hint: t("hint_weight"),
      quick: [t("quick_same"), t("quick_slightly_up"), t("quick_slightly_down")],
    },
    {
      key: "symptoms",      thread: "symptom",  icon: "😌",
      accent: "#7C3AED", accentBg: "#F5F3FF",
      label: t("how_i_feel"),     short: t("how_i_feel"),
      unit: "",       placeholder: t("ph_symptoms"), inputMode: "text",
      hint: t("hint_symptoms"),
      quick: [t("quick_feeling_good"), t("quick_tired"), t("quick_headache"), t("quick_dizzy"), t("quick_no_symptoms")],
    },
  ];
}

function getDayShort(t) {
  return [t("day_sun"), t("day_mon"), t("day_tue"), t("day_wed"), t("day_thu"), t("day_fri"), t("day_sat")];
}

/* ── Utility functions ─────────────────────────────────────────────────── */
function todayKey() { return new Date().toISOString().slice(0, 10); }
function pastDays(n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}
function timeAgoShort(iso, t) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (isNaN(m)) return "";
  if (m < 2)  return t("just_now");
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? t("yesterday_label") : d < 7 ? `${d}d ago` : "";
}
function timeAgoTone(iso) {
  if (!iso) return "none";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "recent";
  return "old";
}
function formatLogTime(iso, t) {
  if (!iso) return t("saved_label");
  const relative = timeAgoShort(iso, t);
  if (relative) return relative;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("saved_label");
  return date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
function isNumericValue(value = "") {
  return /^-?\d+(\.\d+)?$/.test(String(value).trim());
}
function isBloodPressureValue(value = "") {
  return /^\d{2,3}\s*\/\s*\d{2,3}$/.test(String(value).trim());
}
function formatEntryValue(entry = {}, tracker = null, t) {
  const value = String(entry.value || "").trim();
  if (!value) return t("saved_label");
  const unit = entry.unit || tracker?.unit || "";
  if (!unit) return value;
  if (tracker?.key === "bloodPressure" && isBloodPressureValue(value)) return `${value} ${unit}`;
  if (isNumericValue(value)) return `${value} ${unit}`;
  return value;
}
function compareEntryValues(latest = {}, previous = {}, tracker = null, t) {
  const latestValue  = String(latest.value   || "").trim();
  const previousValue = String(previous.value || "").trim();
  if (!latestValue || !previousValue) return t("need_one_reading");
  if (tracker?.key === "bloodPressure" && isBloodPressureValue(latestValue) && isBloodPressureValue(previousValue)) {
    return `${previousValue} → ${latestValue}`;
  }
  if (isNumericValue(latestValue) && isNumericValue(previousValue)) {
    const diff = Number(latestValue) - Number(previousValue);
    if (Math.abs(diff) < 0.05) return t("no_change_label");
    const rounded = Math.abs(diff) >= 10 ? Math.round(Math.abs(diff)) : Math.abs(diff).toFixed(1).replace(/\.0$/, "");
    return `${diff > 0 ? t("up_label") : t("down_label")} ${rounded}${tracker?.unit ? ` ${tracker.unit}` : ""}`;
  }
  return latestValue === previousValue ? t("repeated_label") : t("changed_label");
}
function normalizeKey(key = "") {
  const c = String(key).toLowerCase().replace(/[\s_-]+/g, "");
  if (["glucose","sugar","bloodglucose","bloodsugar"].includes(c)) return "bloodSugar";
  if (["bp","bloodpressure"].includes(c)) return "bloodPressure";
  if (["medicine","medicines","med","meds","medication"].includes(c)) return "medication";
  if (["symptom","feeling","feelings","symptoms"].includes(c)) return "symptoms";
  return String(key).trim();
}
function normalizeEntry(e = {}) {
  return {
    ...e,
    trackerKey: normalizeKey(e.trackerKey || e.tracker_key || ""),
    label: e.label || "", value: String(e.value || e.value_text || ""),
    unit: e.unit || "", loggedAt: e.loggedAt || e.logged_at || "",
  };
}

/* ── Tracker row ── */
function TrackerRow({ tracker, lastEntry, isOpen, isLinked, onToggle, onSave, t }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const tone = lastEntry ? timeAgoTone(lastEntry.loggedAt) : "none";

  useEffect(() => { if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 80); }, [isOpen]);

  const handleSave = async (val) => {
    const v = String(val || draft).trim();
    if (!v) return;
    setSaving(true);
    await onSave(tracker, v);
    setDraft(""); setSaving(false);
  };

  return (
    <div className={`tracker-row ${isOpen ? "is-open" : ""} tone-${tone} ${isLinked ? "is-linked" : ""}`}
      style={isOpen ? { "--tr-accent": tracker.accent, "--tr-bg": tracker.accentBg } : {}}
    >
      <button type="button" className="tracker-row-head" onClick={onToggle} aria-expanded={isOpen}>
        <span className="tracker-row-icon">{tracker.icon}</span>
        <span className="tracker-row-name">{tracker.short}</span>
        <span className="tracker-row-reading">
          {lastEntry?.value
            ? <><strong>{formatEntryValue(lastEntry, tracker, t)}</strong><small className={`tone-${tone}`}>{timeAgoShort(lastEntry.loggedAt, t)}</small></>
            : <span className="tracker-row-empty">{t("not_yet_logged")}</span>
          }
        </span>
        {tone === "today"
          ? <span className="tracker-row-badge done">{t("done_badge")}</span>
          : <span className="tracker-row-badge log">{t("log_badge")}</span>
        }
        <span className="tracker-row-chevron">{isOpen ? "▾" : "›"}</span>
      </button>
      {isOpen && (
        <div className="tracker-row-body" style={{ background: tracker.accentBg, borderTop: `1px solid ${tracker.accent}22` }}>
          {tracker.hint && <p className="tracker-row-hint">{tracker.hint}</p>}
          <div className="tracker-row-pills">
            {tracker.quick.map((q) => (
              <button key={q} type="button" className="tracker-pill" style={{ "--pill-accent": tracker.accent }} onClick={() => handleSave(q)}>{q}</button>
            ))}
          </div>
          <div className="tracker-row-input-row">
            <input ref={inputRef} className="tracker-row-input" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={tracker.placeholder} inputMode={tracker.inputMode === "decimal" ? "decimal" : "text"}
              onKeyDown={(e) => e.key === "Enter" && handleSave()} style={{ "--inp-accent": tracker.accent }} />
            <button type="button" className={`tracker-row-save ${saving ? "is-saving" : ""}`} style={{ background: tracker.accent }} onClick={() => handleSave()} disabled={saving}>
              {saving ? "✓" : t("save_btn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── No-report empty state ── */
function NoReportState({ onGoToReports, t }) {
  return (
    <div className="am-empty">
      <div className="am-empty-visual">
        <div className="am-empty-preview">
          <div className="am-empty-preview-row">
            <span className="am-empty-preview-dot red" />
            <div className="am-empty-preview-bar" style={{ width: "68%" }} />
          </div>
          <div className="am-empty-preview-row">
            <span className="am-empty-preview-dot green" />
            <div className="am-empty-preview-bar" style={{ width: "82%" }} />
          </div>
          <div className="am-empty-preview-row">
            <span className="am-empty-preview-dot amber" />
            <div className="am-empty-preview-bar" style={{ width: "54%" }} />
          </div>
        </div>
        <div className="am-empty-lock">🔒</div>
      </div>

      <h3 className="am-empty-title">{t("upload_prompt")}</h3>
      <p className="am-empty-body">{t("upload_prompt_sub")}</p>

      <div className="am-empty-preview-cards">
        <div className="am-empty-card">
          <span>🩸</span>
          <span>{t("empty_hba1c")}<br /><small>{t("empty_hba1c_sub")}</small></span>
        </div>
        <div className="am-empty-card">
          <span>🚶</span>
          <span>{t("empty_walk")}<br /><small>{t("empty_walk_sub")}</small></span>
        </div>
        <div className="am-empty-card">
          <span>🔁</span>
          <span>{t("empty_retest")}<br /><small>{t("empty_retest_sub")}</small></span>
        </div>
      </div>

      <button type="button" className="am-empty-cta" onClick={() => onGoToReports?.()}>
        {t("upload_cta")}
      </button>
    </div>
  );
}

/* ── Secondary plan card ── */
function SecondaryPlanCard({ plan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`am-secondary-card ${open ? "is-open" : ""}`}>
      <button type="button" className="am-secondary-head" onClick={() => setOpen(p => !p)}>
        <span className="am-secondary-zone-dot" data-zone={plan.zone} />
        <span className="am-secondary-label">{plan.metricLabel}</span>
        <span className="am-secondary-value">{plan.value}{plan.unit ? ` ${plan.unit}` : ""}</span>
        <span className="am-secondary-chevron">{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div className="am-secondary-body">
          <p className="am-secondary-headline">{plan.headline}</p>
          <ul className="am-secondary-steps">
            {(plan.thisWeek || []).map((step, i) => (
              <li key={i}><span>{i + 1}</span>{step}</li>
            ))}
          </ul>
          {plan.bringToDoctor && (
            <p className="am-secondary-doctor">💬 {plan.bringToDoctor}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Action map hero ── */
function ActionMapHero({ actionMap, onCopy, copied, apiFetch, memberId, t }) {
  const secondary = actionMap.secondary || [];
  const imp = actionMap.improvement;
  return (
    <div className="am-hero">
      {imp && (
        <div className="am-improvement-banner">
          <span className="am-improvement-icon">🎉</span>
          <div className="am-improvement-body">
            <strong>{imp.message}</strong>
            <span>{actionMap.metricLabel}: {imp.previousValue} → {actionMap.value} {actionMap.unit}</span>
          </div>
        </div>
      )}

      <div className="am-hero-eyebrow">
        <span className="am-hero-tag">{imp ? t("keep_it_up") : t("action_plan_title")}</span>
        <button type="button" className="am-hero-copy" onClick={onCopy}>
          {copied ? t("copied_done") : t("copy_all")}
        </button>
      </div>

      <p className="am-hero-headline">{actionMap.headline}</p>

      {actionMap.contextNotes?.length > 0 && (
        <p className="am-context-note">{actionMap.contextNotes.join(" ")}</p>
      )}

      <ul className="am-steps">
        {(actionMap.thisWeek || []).map((step, i) => (
          <li key={i} className="am-step">
            <span className="am-step-num">{i + 1}</span>
            <span className="am-step-text">{step}</span>
          </li>
        ))}
      </ul>

      {actionMap.checkIns?.length > 0 && (
        <ActionCheckIns actionMap={actionMap} apiFetch={apiFetch} memberId={memberId} t={t} />
      )}

      <div className="am-hero-footer">
        <RetestChip key={actionMap.metricKey} actionMap={actionMap} apiFetch={apiFetch} memberId={memberId} t={t} />
        <p className="am-bring-to-doctor">{actionMap.bringToDoctor}</p>
      </div>

      {secondary.length > 0 && (
        <div className="am-secondary-plans">
          <p className="am-secondary-title">{t("also_needs")}</p>
          {secondary.map(plan => (
            <SecondaryPlanCard key={plan.metricKey} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 7-day strip (used in WeeklyTrend) ── */
function WeekStrip({ activity, t }) {
  const DAY_SHORT = getDayShort(t);
  const days = pastDays(7);
  const loggedDays = new Set(activity.map((e) => String(e.loggedAt || "").slice(0, 10)));
  const today = todayKey();
  return (
    <div className="week-strip">
      {days.map((d) => {
        const logged = loggedDays.has(d);
        const isToday = d === today;
        const dow = DAY_SHORT[new Date(d + "T12:00:00").getDay()];
        const date = new Date(d + "T12:00:00").getDate();
        return (
          <div key={d} className={`week-day ${logged ? "is-logged" : ""} ${isToday ? "is-today" : ""}`}>
            <div className="week-day-dot">{logged ? "✓" : ""}</div>
            <div className="week-day-label">{isToday ? t("today_label") : dow}</div>
            <div className="week-day-date">{date}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Retest / check-in persistence helpers ── */
const RETEST_KEY  = (metricKey) => `ssp_retest_${metricKey}`;
const CHECKIN_KEY = (metricKey, checkInId, dateKey) => `ssp_ci_${metricKey}_${checkInId}_${dateKey}`;

function saveRetestReminderLocal(metricKey, retestDays, label) {
  if (!metricKey || !retestDays) return null;
  const dueDate = new Date(Date.now() + retestDays * 86400000).toISOString().slice(0, 10);
  const data = { dueDate, label, metricKey, setAt: todayKey() };
  try { localStorage.setItem(RETEST_KEY(metricKey), JSON.stringify(data)); } catch {}
  return dueDate;
}
async function saveRetestReminder(metricKey, retestDays, label, apiFetch, memberId) {
  const dueDate = saveRetestReminderLocal(metricKey, retestDays, label);
  if (apiFetch && dueDate) {
    try {
      await apiFetch("/api/retest-reminder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricKey, dueDate, label, memberId: memberId || undefined }),
      });
    } catch {}
  }
  return dueDate;
}
function loadRetestReminder(metricKey) {
  try { return JSON.parse(localStorage.getItem(RETEST_KEY(metricKey)) || "null"); } catch { return null; }
}
function seedRetestRemindersFromBackend(reminders = []) {
  reminders.forEach(r => {
    if (!r?.metricKey) return;
    const existing = loadRetestReminder(r.metricKey);
    if (!existing || (r.setAt && r.setAt > (existing.setAt || ""))) {
      try { localStorage.setItem(RETEST_KEY(r.metricKey), JSON.stringify(r)); } catch {}
    }
  });
}
function getCheckInValue(metricKey, checkInId, dateKey) {
  try { return localStorage.getItem(CHECKIN_KEY(metricKey, checkInId, dateKey)) || null; } catch { return null; }
}
function setCheckInValue(metricKey, checkInId, dateKey, value) {
  try { localStorage.setItem(CHECKIN_KEY(metricKey, checkInId, dateKey), value); } catch {}
}
function seedCheckInsFromBackend(checkins = []) {
  checkins.forEach(({ checkInId, value, dateKey, metricKey }) => {
    if (!checkInId || !dateKey || !metricKey) return;
    const key = CHECKIN_KEY(metricKey, checkInId, dateKey);
    try { if (!localStorage.getItem(key) && value) localStorage.setItem(key, value); } catch {}
  });
}
async function syncCheckInToBackend(metricKey, checkInId, dateKey, value, apiFetch, memberId) {
  if (!apiFetch) return;
  try {
    await apiFetch("/api/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metricKey, checkInId, dateKey, value, memberId: memberId || undefined }),
    });
  } catch {}
}

/* ── Retest banner ── */
function RetestBanner({ metricKey, metricLabel, t }) {
  if (!metricKey) return null;
  const reminder = loadRetestReminder(metricKey);
  if (!reminder) return null;
  const today = todayKey();
  const daysLeft = Math.ceil((new Date(reminder.dueDate) - new Date(today)) / 86400000);
  if (daysLeft > 3 || daysLeft < -7) return null;
  const urgent = daysLeft <= 0;
  const titleStr = urgent
    ? t("retest_due", { metric: metricLabel })
    : daysLeft === 1
      ? t("retest_soon",        { metric: metricLabel, n: daysLeft })
      : t("retest_soon_plural", { metric: metricLabel, n: daysLeft });
  return (
    <div className={`am-retest-banner ${urgent ? "am-retest-banner--due" : ""}`}>
      <span className="am-retest-banner-icon">{urgent ? "🔔" : "📅"}</span>
      <div className="am-retest-banner-body">
        <strong>{titleStr}</strong>
        <span>{t("retest_banner_body")}</span>
      </div>
    </div>
  );
}

/* ── Daily action check-ins ── */
function ActionCheckIns({ actionMap, apiFetch, memberId, t }) {
  const { metricKey, checkIns = [] } = actionMap;
  const today = todayKey();
  const [ticks, setTicks] = useState(() => {
    const init = {};
    checkIns.forEach((ci) => { init[ci.id] = getCheckInValue(metricKey, ci.id, today) || null; });
    return init;
  });

  useEffect(() => {
    if (!apiFetch || !metricKey) return;
    apiFetch(`/api/checkins?metricKey=${encodeURIComponent(metricKey)}${memberId ? `&memberId=${memberId}` : ""}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.checkins?.length) return;
        seedCheckInsFromBackend(data.checkins.map(c => ({ ...c, metricKey })));
        setTicks(prev => {
          const updated = { ...prev };
          checkIns.forEach(ci => {
            const v = getCheckInValue(metricKey, ci.id, today);
            if (v && !updated[ci.id]) updated[ci.id] = v;
          });
          return updated;
        });
      })
      .catch(() => {});
  }, [apiFetch, metricKey, memberId]); // eslint-disable-line

  const toggle = (id, value) => {
    const currentDay = todayKey();
    const next = ticks[id] === value ? null : value;
    setCheckInValue(metricKey, id, currentDay, next || "");
    setTicks((prev) => ({ ...prev, [id]: next }));
    syncCheckInToBackend(metricKey, id, currentDay, next || "", apiFetch, memberId);
  };

  const DAY_SHORT = getDayShort(t);
  const days7 = pastDays(7);
  const doneToday = checkIns.filter((ci) => ticks[ci.id] === "yes").length;

  return (
    <div className="am-checkins">
      <div className="am-checkins-head">
        <span className="am-checkins-label">{t("todays_checkin")}</span>
        <span className="am-checkins-score">{t("checkin_score", { n: doneToday, m: checkIns.length })}</span>
      </div>

      <div className="am-checkins-list">
        {checkIns.map((ci) => {
          const done    = ticks[ci.id] === "yes";
          const skipped = ticks[ci.id] === "skip";
          const activeDays7 = days7.filter((d) => getCheckInValue(metricKey, ci.id, d) === "yes").length;
          return (
            <div key={ci.id} className={`am-ci-row ${done ? "am-ci-done" : skipped ? "am-ci-skip" : ""}`}>
              <div className="am-ci-main">
                <span className="am-ci-icon">{ci.icon}</span>
                <span className="am-ci-label">{ci.label}</span>
              </div>
              <div className="am-ci-actions">
                {activeDays7 > 0 && (
                  <span className="am-ci-streak" title={`${activeDays7}/7`}>{activeDays7}/7</span>
                )}
                <button type="button" className={`am-ci-btn am-ci-yes ${done ? "active" : ""}`}
                  onClick={() => toggle(ci.id, "yes")} aria-pressed={done}>
                  {t("done_badge")}
                </button>
                <button type="button" className={`am-ci-btn am-ci-skip-btn ${skipped ? "active" : ""}`}
                  onClick={() => toggle(ci.id, "skip")} aria-pressed={skipped}>
                  {t("skip")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="am-checkins-heatmap">
        {days7.map((d) => {
          const dayDone  = checkIns.filter((ci) => getCheckInValue(metricKey, ci.id, d) === "yes").length;
          const dayTotal = checkIns.length;
          const pct = dayTotal ? dayDone / dayTotal : 0;
          const isToday = d === today;
          const dow = DAY_SHORT[new Date(d + "T12:00:00").getDay()];
          return (
            <div key={d} className="am-heatmap-col">
              <div className={`am-heatmap-cell ${isToday ? "am-heatmap-today" : ""}`}
                style={{ "--heat": pct }}
                title={`${dow}: ${dayDone}/${dayTotal}`} />
              <span className="am-heatmap-label">{isToday ? t("today_label")[0] : dow[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Retest chip ── */
function RetestChip({ actionMap, apiFetch, memberId, t }) {
  const [saved, setSaved] = useState(() => !!loadRetestReminder(actionMap?.metricKey)?.dueDate);
  if (!actionMap?.retest) return null;

  const handleSet = async () => {
    const dueDate = await saveRetestReminder(
      actionMap.metricKey, actionMap.retestDays, actionMap.metricLabel, apiFetch, memberId
    );
    if (dueDate) setSaved(true);
  };

  return (
    <button type="button"
      className={`am-retest-chip-btn ${saved ? "am-retest-chip-saved" : ""}`}
      onClick={!saved ? handleSet : undefined}
      aria-label={saved ? t("reminder_set") : t("remind_me")}
    >
      <span>{saved ? "🔔" : "🔁"}</span>
      <span>{t("retest_label")} <strong>{actionMap.retest}</strong></span>
      {saved
        ? <span className="am-retest-chip-tag">{t("reminder_set")}</span>
        : <span className="am-retest-chip-tag">{t("remind_me")}</span>}
    </button>
  );
}

/* ── Sparkline SVG ── */
function Sparkline({ points, color = "#1A5C48", height = 52 }) {
  if (!points || points.length < 2) {
    if (points?.length === 1) {
      return (
        <svg viewBox="0 0 120 52" preserveAspectRatio="none" className="am-spark-svg" aria-hidden="true">
          <circle cx="60" cy="26" r="4" fill={color} />
        </svg>
      );
    }
    return null;
  }
  const W = 120, H = height, pad = 6;
  const vals  = points.map((p) => p.v);
  const minV  = Math.min(...vals);
  const maxV  = Math.max(...vals);
  const rangeV = maxV - minV || 1;
  const toX = (i) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const toY = (v) => H - pad - ((v - minV) / rangeV) * (H - pad * 2);
  const d    = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.v).toFixed(1)}`).join(" ");
  const fillD = `${d} L ${toX(points.length - 1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`;
  const gradId = `spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="am-spark-svg" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradId})`} />
      <path d={d}     fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.v)} r={i === points.length - 1 ? 4.5 : 3}
          fill={color} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/* ── Trend card ── */
function TrendCard({ tracker, entries, actionMap, t }) {
  const DAY_SHORT = getDayShort(t);
  const numericEntries = entries
    .filter((e) => {
      const v = String(e.value || "").trim();
      if (tracker.key === "bloodPressure") return /^\d{2,3}\s*\/\s*\d{2,3}$/.test(v);
      return /^-?\d+(\.\d+)?$/.test(v);
    })
    .sort((a, b) => new Date(a.loggedAt || 0) - new Date(b.loggedAt || 0));

  if (!numericEntries.length) return null;

  const toNum = (e) => {
    const v = String(e.value || "").trim();
    if (tracker.key === "bloodPressure") return Number(v.split("/")[0]);
    return Number(v);
  };

  const last7      = numericEntries.slice(-7);
  const uniqueDates = new Set(last7.map(e => String(e.loggedAt || "").slice(0, 10)));
  const sameDay    = uniqueDates.size <= 1;
  const points     = last7.map((e, i) => {
    const d = new Date(e.loggedAt || Date.now());
    let label;
    if (sameDay) {
      const h = d.getHours();
      label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
    } else {
      const dayName = DAY_SHORT[d.getDay()];
      const prevSameDay = last7.slice(0, i).filter(
        pe => DAY_SHORT[new Date(pe.loggedAt || 0).getDay()] === dayName
      ).length;
      label = prevSameDay > 0 ? `${d.getDate()}` : dayName;
    }
    return { v: toNum(e), label, date: String(e.loggedAt || "").slice(0, 10) };
  });

  const latest  = numericEntries[numericEntries.length - 1];
  const prev    = numericEntries.length > 1 ? numericEntries[numericEntries.length - 2] : null;
  const latestNum = toNum(latest);
  const prevNum   = prev ? toNum(prev) : null;
  const diff = prevNum != null ? latestNum - prevNum : null;
  const trendIcon = diff == null ? null : Math.abs(diff) < 0.5 ? "→" : diff > 0 ? "↑" : "↓";
  const trendColor = diff == null ? "var(--ss-ink-3)"
    : Math.abs(diff) < 0.5 ? "var(--ss-ink-3)"
    : tracker.key === "bloodSugar" && diff > 0 ? "#b45309"
    : tracker.key === "weight"     && diff > 0 ? "#b45309"
    : diff < 0 ? "#1B7A4E" : "#b45309";

  const isLinked = actionMap?.linkedTrackers?.includes(tracker.key);
  let correlationHint = null;
  if (isLinked && numericEntries.length >= 2) {
    const half       = Math.ceil(numericEntries.length / 2);
    const recentHalf = numericEntries.slice(-half).map(toNum);
    const olderHalf  = numericEntries.slice(0, half).map(toNum);
    const recentAvg  = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg   = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
    const delta    = recentAvg - olderAvg;
    const absDelta = Math.abs(delta);
    if (absDelta >= 2) {
      const improving = (tracker.key === "bloodSugar" || tracker.key === "weight") ? delta < 0 : delta > 0;
      const n    = Math.round(absDelta);
      const unit = tracker.unit ? ` ${tracker.unit}` : "";
      correlationHint = improving
        ? t("avg_down", { n, unit })
        : t("avg_up",   { n, unit });
    }
  }

  const readingLabel = numericEntries.length === 1 ? t("reading_single") : t("readings_label");

  return (
    <div className="am-trend-card">
      <div className="am-trend-header">
        <span className="am-trend-icon" style={{ background: tracker.accentBg }}>{tracker.icon}</span>
        <div className="am-trend-meta">
          <span className="am-trend-label">{tracker.label}</span>
          <span className="am-trend-count">{numericEntries.length} {readingLabel}</span>
        </div>
      </div>
      <div className="am-trend-value-row">
        <strong className="am-trend-value">
          {tracker.key === "bloodPressure"
            ? String(latest.value || "").trim()
            : `${latestNum}${tracker.unit ? ` ${tracker.unit}` : ""}`}
        </strong>
        {trendIcon && (
          <span className="am-trend-delta" style={{ color: trendColor }}>
            {trendIcon} {diff != null && Math.abs(diff) >= 0.5
              ? `${Math.abs(diff) >= 10 ? Math.round(Math.abs(diff)) : Math.abs(diff).toFixed(1).replace(/\.0$/, "")}${tracker.unit ? ` ${tracker.unit}` : ""}`
              : t("stable_label")}
          </span>
        )}
        <span className="am-trend-time">{timeAgoShort(latest.loggedAt, t)}</span>
      </div>
      <div className="am-trend-chart">
        <Sparkline points={points} color={tracker.accent} />
        <div className="am-spark-labels">
          {points.map((p, i) => (
            <span key={i} className={i === points.length - 1 ? "am-spark-label-today" : ""}>{p.label}</span>
          ))}
        </div>
      </div>
      {correlationHint && (
        <p className={`am-correlation-hint ${correlationHint.startsWith("↓") ? "am-hint-good" : "am-hint-warn"}`}>
          {correlationHint}
        </p>
      )}
    </div>
  );
}

/* ── Weekly trends section ── */
function WeeklyTrend({ activity, actionMap, t }) {
  const numericKeys = ["bloodSugar", "bloodPressure", "weight"];
  const noteKeys    = ["medication", "symptoms"];
  const TRACKERS    = getTRACKERS(t);
  const TRACKER_BY_KEY = new Map(TRACKERS.map((tr) => [tr.key, tr]));

  const grouped = {};
  for (const e of activity) {
    if (!grouped[e.trackerKey]) grouped[e.trackerKey] = [];
    grouped[e.trackerKey].push(e);
  }

  const trendCards = numericKeys
    .map((key) => ({ key, tracker: TRACKER_BY_KEY.get(key), entries: grouped[key] || [] }))
    .filter(({ entries }) => entries.length > 0);

  const recentNotes = noteKeys
    .flatMap((key) => (grouped[key] || []).map((e) => ({ ...e, tracker: TRACKER_BY_KEY.get(key) })))
    .sort((a, b) => new Date(b.loggedAt || 0) - new Date(a.loggedAt || 0))
    .slice(0, 4);

  if (!trendCards.length && !recentNotes.length) return null;

  return (
    <div className="am-section am-trends-section">
      <div className="am-section-head">
        <span className="am-section-label">{t("your_readings")}</span>
      </div>

      {trendCards.length > 0 ? (
        <div className="am-trend-grid">
          {trendCards.map(({ key, tracker, entries }) => (
            <TrendCard key={key} tracker={tracker} entries={entries} actionMap={actionMap} t={t} />
          ))}
        </div>
      ) : (
        <p className="am-log-empty">{t("log_empty_hint")}</p>
      )}

      {recentNotes.length > 0 && (
        <div className="am-notes-list">
          <p className="am-notes-title">{t("notes_questions")}</p>
          {recentNotes.map((entry, i) => (
            <div key={entry.id || `note-${i}`} className="am-note-row">
              <span className="am-note-icon" style={{ background: entry.tracker?.accentBg }}>{entry.tracker?.icon}</span>
              <div className="am-note-body">
                <strong>{entry.value || entry.label}</strong>
                <span>{entry.tracker?.label} · {formatLogTime(entry.loggedAt, t)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main export ── */
export function ActionsPanel({
  activeMemberId,
  apiFetch,
  apiBase,
  reportInsights,
  healthPlanActivity = [],
  onActivitySaved,
  onGoToReports,
}) {
  const { t } = useLang();
  const TRACKERS = getTRACKERS(t);

  const [localActivity, setLocalActivity] = useState([]);
  const [openTracker, setOpenTracker]     = useState(null);
  const [saveError, setSaveError]         = useState("");
  const [copied, setCopied]               = useState(false);

  const actionMap = reportInsights?.actionMap || null;

  // Seed retest reminders from backend on mount
  useEffect(() => {
    if (!apiFetch || !actionMap) return;
    apiFetch("/api/retest-reminders" + (activeMemberId ? `?memberId=${activeMemberId}` : ""))
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.reminders?.length) seedRetestRemindersFromBackend(data.reminders); })
      .catch(() => {});
  }, [apiFetch, activeMemberId]);

  const activity = [...localActivity, ...(Array.isArray(healthPlanActivity) ? healthPlanActivity : [])]
    .map(normalizeEntry)
    .filter((e) => e.loggedAt || e.value)
    .sort((a, b) => new Date(b.loggedAt || 0).getTime() - new Date(a.loggedAt || 0).getTime());

  const today = todayKey();
  const allDays = new Set(activity.map((e) => String(e.loggedAt || "").slice(0, 10)).filter(Boolean));
  let streak = 0;
  const cur = new Date();
  if (!allDays.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  while (allDays.has(cur.toISOString().slice(0, 10))) { streak++; cur.setDate(cur.getDate() - 1); }

  const latestPerTracker = {};
  for (const e of activity) { if (!latestPerTracker[e.trackerKey]) latestPerTracker[e.trackerKey] = e; }

  const handleSave = async (tracker, value) => {
    const loggedAt = new Date().toISOString();
    const entry = {
      id: `${tracker.key}-${Date.now()}`, trackerKey: tracker.key,
      label: tracker.label, value, unit: tracker.unit, loggedAt,
    };
    try {
      const response = await apiFetch("/api/health-plan/activity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: activeMemberId || null,
          focusKey: tracker.thread === "sugar" ? "diabetes" : tracker.thread,
          title: "Health note", subtitle: "One update saved for follow-up.",
          goal: "Keep small health details easy to remember.",
          focusTitle: tracker.label, focusSummary: value, progress: {},
          trackerKey: tracker.key, label: tracker.label, value, unit: tracker.unit, loggedAt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save.");
      const persistedActivity = Array.isArray(data.activity)
        ? data.activity.map(normalizeEntry).filter((item) => item.loggedAt || item.value)
            .sort((a, b) => new Date(b.loggedAt || 0).getTime() - new Date(a.loggedAt || 0).getTime())
        : [];
      if (persistedActivity.length) {
        setLocalActivity([]);
        onActivitySaved?.(persistedActivity, data.plan || null);
      } else {
        setLocalActivity((prev) => [entry, ...prev]);
      }
      setOpenTracker(null);
      setSaveError("");
    } catch (err) {
      setSaveError(err?.message || "Unable to save right now");
    }
  };

  const handleCopy = () => {
    if (!actionMap) return;
    const text = [
      actionMap.headline, "",
      ...(actionMap.thisWeek || []).map((a, i) => `${i + 1}. ${a}`),
      "", `${t("retest_label")}: ${actionMap.retest}`, actionMap.bringToDoctor,
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };

  return (
    <div className="actions-root">
      {actionMap && <RetestBanner metricKey={actionMap.metricKey} metricLabel={actionMap.metricLabel} t={t} />}

      {actionMap
        ? <ActionMapHero actionMap={actionMap} onCopy={handleCopy} copied={copied} apiFetch={apiFetch} memberId={activeMemberId} t={t} />
        : <NoReportState onGoToReports={onGoToReports} t={t} />
      }

      {actionMap && (
        <div className="am-section am-trackers">
          <div className="am-section-head">
            <span className="am-section-label">{t("log_reading")}</span>
            {actionMap?.linkedTrackers?.length > 0 && (
              <span className="am-section-sub">{t("track_plan")}</span>
            )}
          </div>
          {TRACKERS.map((tracker) => (
            <TrackerRow
              key={tracker.key}
              tracker={tracker}
              lastEntry={latestPerTracker[tracker.key]}
              isOpen={openTracker === tracker.key}
              isLinked={actionMap?.linkedTrackers?.includes(tracker.key)}
              onToggle={() => { setOpenTracker((p) => p === tracker.key ? null : tracker.key); setSaveError(""); }}
              onSave={handleSave}
              t={t}
            />
          ))}
          {saveError && <p className="actions-save-error">{saveError}</p>}
        </div>
      )}

      {actionMap && <WeeklyTrend activity={activity} actionMap={actionMap} t={t} />}

    </div>
  );
}
