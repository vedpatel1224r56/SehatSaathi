import { useEffect, useMemo, useState } from "react";

function shorten(text = "", fallback = "") {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  const firstSentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const result = (firstSentenceMatch?.[0] || normalized).trim();
  return result.length > 110 ? `${result.slice(0, 107).trimEnd()}...` : result;
}

function iconForTaskLabel(label = "") {
  const text = String(label || "").toLowerCase();
  if (text.includes("prepare") || text.includes("bring") || text.includes("keep prior")) return "📄";
  if (text.includes("track") || text.includes("save one note") || text.includes("note")) return "✎";
  if (text.includes("keep") || text.includes("visible") || text.includes("handy")) return "◎";
  return "→";
}

function iconForFocusOption(item = {}) {
  const key = normalizePlanFocusKey(item.key || item.label || "");
  if (key.includes("allergy")) return "🌿";
  if (key.includes("sugar") || key.includes("diabetes")) return "🩸";
  if (key.includes("energy") || key.includes("anemia") || key.includes("cbc")) return "🧪";
  if (key.includes("weight") || key.includes("lipid") || key.includes("metabolic")) return "⚖️";
  if (key.includes("thyroid")) return "🦋";
  if (key.includes("kidney")) return "💧";
  if (key.includes("stress")) return "☁️";
  if (key.includes("sleep")) return "☾";
  return item.kind === "goal" ? "◎" : "✦";
}

const PLAN_LIBRARY = {
  diabetes: {
    title: "Sugar follow-up plan",
    subtitle: "Use your latest sugar-related findings to guide a simple week that stays easy to follow.",
    goal: "Keep one or two sugar-related follow-up steps visible without making the week feel heavy.",
    tasks: [
      { id: "meal_timing", label: "Keep one meal timing or sugar reading visible today", note: "One useful check-in is enough." },
      { id: "bring_readings", label: "Bring recent sugar readings if discussing this during follow-up", note: "Only if you already track them." },
      { id: "sugar_note", label: "Save one note about appetite, sleep, thirst, or energy if relevant", note: "Keep it brief and practical." },
    ],
    trackers: [
      { key: "bloodSugar", label: "Blood sugar", unit: "mg/dL", placeholder: "110", hint: "Use your most useful reading for the day.", priority: "primary" },
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Optional unless weight changes matter this week.", priority: "secondary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Fatigue after meals, thirst, dizziness", hint: "Keep it to one short note.", priority: "primary", quickChoices: ["Fatigue", "Thirst", "No symptoms"] },
    ],
  },
  lipid: {
    title: "Lipid follow-up plan",
    subtitle: "Use your latest lipid-related findings to keep follow-up simple and realistic this week.",
    goal: "Keep one or two follow-up steps visible without turning the week into a routine challenge.",
    tasks: [
      { id: "move", label: "Move for 25 minutes", note: "Walking counts." },
      { id: "meal", label: "Choose one lighter oil or fried-food swap", note: "One repeatable change is enough." },
      { id: "track_weight", label: "Log weight, BP, or symptoms once", note: "One marker helps show the trend." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "One weight check is enough.", priority: "primary" },
      { key: "bloodPressure", label: "Blood pressure", unit: "mmHg", placeholder: "122/80", hint: "Only if you already track BP.", priority: "primary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Chest discomfort, fatigue, swelling", hint: "A short note helps if something feels off.", priority: "secondary", quickChoices: ["Fatigue", "Swelling", "No symptoms"] },
    ],
  },
  thyroid: {
    title: "Thyroid check-in plan",
    subtitle: "Use your thyroid report to keep symptoms and routine changes easier to notice this week.",
    goal: "Track the small daily changes that are hard to remember later.",
    tasks: [
      { id: "sleep", label: "Keep a regular sleep window", note: "Consistency makes changes easier to notice." },
      { id: "log_energy", label: "Log energy, mood, or appetite once", note: "A short note is enough." },
      { id: "weight_check", label: "Check weight twice this week", note: "A small history is often more useful than one number." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Check only if weight is part of the follow-up review.", priority: "secondary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Fatigue, hair fall, mood, appetite", hint: "A quick symptom note is usually enough.", priority: "primary", quickChoices: ["Low energy", "Hair fall", "Mood change", "No symptoms"] },
    ],
  },
  liver: {
    title: "Liver care plan",
    subtitle: "Use your liver report to keep the week conservative and easy to track.",
    goal: "Reduce likely triggers and keep symptoms visible before the next review.",
    tasks: [
      { id: "medicine_review", label: "Keep recent medicines or supplements visible if review is needed", note: "This can make the next follow-up easier." },
      { id: "prior_report", label: "Bring prior liver reports if available", note: "Older reports help compare follow-up context." },
      { id: "log_symptoms", label: "Save one short note about discomfort, nausea, or fatigue only if relevant", note: "Only if it helps the next review." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Optional unless weight is changing.", priority: "secondary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Pain, nausea, appetite, yellowing", hint: "Keep it brief and only log what changed.", priority: "primary", quickChoices: ["Nausea", "Pain", "No symptoms"] },
    ],
  },
  ckd: {
    title: "Kidney health plan",
    subtitle: "Track the few signals that matter most before your next kidney review.",
    goal: "Keep pressure, swelling, and symptom changes easy to explain later.",
    tasks: [
      { id: "bp", label: "Keep one recent BP reading visible if available", note: "Only if you already track it." },
      { id: "symptom_watch", label: "Save one note about swelling, urine changes, or fatigue only if relevant", note: "A short note is enough." },
      { id: "med_list", label: "Keep medicines and prior reports ready", note: "This can make kidney follow-up easier." },
    ],
    trackers: [
      { key: "bloodPressure", label: "Blood pressure", unit: "mmHg", placeholder: "122/80", hint: "Use your latest reading if available.", priority: "primary" },
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Helpful if swelling or fluid changes are visible.", priority: "secondary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Swelling, urine change, fatigue", hint: "A short change note is enough.", priority: "primary", quickChoices: ["Swelling", "Urine change", "Fatigue", "No symptoms"] },
    ],
  },
  anemia: {
    title: "Red-cell follow-up plan",
    subtitle: "Use this week to keep red-cell related changes easier to explain during follow-up.",
    goal: "Keep symptoms, prior reports, and one useful note ready without overloading the day.",
    tasks: [
      { id: "cbc_note", label: "Keep fatigue, dizziness, or energy changes noted if relevant", note: "A short note is enough." },
      { id: "prior_cbc", label: "Bring prior CBC reports if available", note: "Older reports can help the next review." },
      { id: "symptoms", label: "Save one symptom or routine note if it helps your next review", note: "Keep it practical." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Optional unless weight is changing.", priority: "secondary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Fatigue, dizziness, breathlessness", hint: "One short symptom check-in works.", priority: "primary", quickChoices: ["Fatigue", "Dizziness", "Breathless", "No symptoms"] },
    ],
  },
  allergy: {
    title: "Allergy/immune follow-up plan",
    subtitle: "Keep allergy or immune-related context easier to explain before your next review.",
    goal: "Track symptoms or triggers only if they help the next follow-up conversation.",
    tasks: [
      { id: "trigger_note", label: "Note any allergy, skin, breathing, or sinus symptoms only if relevant", note: "A short note is enough." },
      { id: "seasonal_note", label: "Track whether symptoms appear seasonal or repeated", note: "Only if that pattern is noticeable." },
      { id: "doctor_question", label: "Keep one follow-up question ready if you need review", note: "Use it only if symptoms or repeated changes matter." },
    ],
    trackers: [
      { key: "symptoms", label: "Allergy note", unit: "", placeholder: "Itching, wheeze, rash, sneezing, food/dust trigger", hint: "Symptoms matter more than the number alone.", priority: "primary", quickChoices: ["Itching", "Sneezing", "Rash", "No symptoms"] },
    ],
  },
  anthropometry: {
    title: "Weight/metabolic follow-up plan",
    subtitle: "Use a light weekly rhythm while keeping weight or metabolic context easier to review.",
    goal: "Keep one routine note visible without turning the week into a strict health target.",
    tasks: [
      { id: "routine_note", label: "Keep one routine note about activity, sleep, or eating schedule if useful", note: "One short note is enough." },
      { id: "weight_check", label: "Keep one weight check handy only if it helps follow-up", note: "Optional unless weight is part of the discussion." },
      { id: "prior_reports", label: "Bring prior reports if available", note: "They can make trend review easier." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "One check this week is enough.", priority: "primary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Energy, appetite, sleep, swelling", hint: "Optional unless you noticed a change.", priority: "secondary", quickChoices: ["Low energy", "Poor sleep", "No symptoms"] },
    ],
  },
  default: {
    title: "Follow-up support plan",
    subtitle: "Start with a few light follow-up steps while the report picture becomes clearer.",
    goal: "Keep one useful note or reading visible so the next review is easier to understand.",
    tasks: [
      { id: "report_note", label: "Save one useful follow-up note", note: "Keep it tied to the report or the next review." },
      { id: "prior_report", label: "Bring prior reports if available", note: "Earlier reports often make follow-up easier." },
      { id: "reading", label: "Keep one useful reading visible if available", note: "Only if it helps your next review." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Only log it if it helps your weekly picture.", priority: "primary" },
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Energy, sleep, pain, stress", hint: "Keep it to one useful line.", priority: "secondary", quickChoices: ["Low energy", "Poor sleep", "No symptoms"] },
    ],
  },
};

const MAINTENANCE_GOAL_LIBRARY = {
  steady: {
    label: "Steady",
    title: "Stable routine plan",
    subtitle: "Keep the week calm and easy to review while your reports stay steady.",
    goal: "Keep one calm weekly rhythm visible.",
    summary: "Your reports look steady, so use this week to keep the basics easy to review.",
    tasks: [
      { id: "walk", label: "Walk for 20 minutes", note: "A calm walk is enough." },
      { id: "sleep", label: "Keep a regular sleep window", note: "Regular timing matters more than perfection." },
      { id: "log", label: "Log one useful note", note: "One short note is enough for today." },
    ],
    trackers: [
      { key: "symptoms", label: "Symptoms note", unit: "", placeholder: "Energy, sleep, stress, appetite", hint: "Keep it to one useful line.", priority: "primary", quickChoices: ["Good", "Okay", "No symptoms"] },
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "Optional unless weight matters this week.", priority: "secondary" },
    ],
  },
  energy: {
    label: "Energy",
    title: "Energy stability plan",
    subtitle: "Keep energy and recovery easy to notice with a light weekly rhythm.",
    goal: "Keep energy steady with repeatable daily habits.",
    summary: "Use this week to make energy easier to track without turning the day into a task list.",
    tasks: [
      { id: "sleep", label: "Protect a regular sleep window", note: "Consistency helps more than a perfect bedtime." },
      { id: "hydrate", label: "Keep hydration steady", note: "Small steady sips through the day are enough." },
      { id: "log", label: "Log one energy note", note: "A short note is enough to support the next review." },
    ],
    trackers: [
      { key: "symptoms", label: "Energy note", unit: "", placeholder: "Tired, okay, better than yesterday", hint: "Keep it short and practical.", priority: "primary", quickChoices: ["Tired", "Okay", "Better"] },
      { key: "sleep", label: "Sleep window", unit: "", placeholder: "11:00 PM - 6:30 AM", hint: "Track the timing that felt most stable.", priority: "secondary" },
    ],
  },
  sleep: {
    label: "Sleep",
    title: "Sleep stability plan",
    subtitle: "Keep sleep visible so the week stays easier to read and repeat.",
    goal: "Keep sleep steady and simple to review.",
    summary: "A calm sleep rhythm can make the rest of the week easier to follow.",
    tasks: [
      { id: "sleep", label: "Protect one consistent sleep window", note: "Keep the timing steady enough to notice useful changes." },
      { id: "screen", label: "Step away from screens a little earlier", note: "One small boundary is enough." },
      { id: "log", label: "Log sleep quality once", note: "A single short note is enough." },
    ],
    trackers: [
      { key: "sleep", label: "Sleep note", unit: "", placeholder: "Rested, woke often, slept late", hint: "Keep it practical.", priority: "primary", quickChoices: ["Rested", "Okay", "Rough night"] },
      { key: "symptoms", label: "Energy note", unit: "", placeholder: "Alert, heavy, sleepy", hint: "Optional if you want the follow-up picture clearer.", priority: "secondary", quickChoices: ["Alert", "Okay", "Sleepy"] },
    ],
  },
  sugar: {
    label: "Sugar",
    title: "Sugar stability plan",
    subtitle: "Keep sugar visible with one light weekly rhythm that feels doable.",
    goal: "Keep sugar steady without making the week feel strict.",
    summary: "Sugar looks like the clearest health goal, so keep the plan simple and repeatable.",
    tasks: [
      { id: "walk", label: "Walk for 20 minutes", note: "A steady walk helps more than a perfect workout." },
      { id: "plate", label: "Keep one meal lighter on sugar or refined carbs", note: "Choose one easy swap you can repeat." },
      { id: "log_sugar", label: "Log sugar, meal notes, or symptoms once", note: "One clear log is enough for today." },
    ],
    trackers: [
      { key: "bloodSugar", label: "Blood sugar", unit: "mg/dL", placeholder: "110", hint: "Use your most useful reading for the day.", priority: "primary" },
      { key: "symptoms", label: "Sugar note", unit: "", placeholder: "Thirst, fatigue, dizziness, meals", hint: "One short note is enough.", priority: "secondary", quickChoices: ["Thirst", "Fatigue", "No symptoms"] },
    ],
  },
  cholesterol: {
    label: "Cholesterol",
    title: "Heart health plan",
    subtitle: "Keep movement and food choices simple enough to repeat on normal days.",
    goal: "Make movement and food choices easy to repeat this week.",
    summary: "Cholesterol is the clearest goal, so keep the plan focused and realistic.",
    tasks: [
      { id: "move", label: "Move for 25 minutes", note: "Walking counts." },
      { id: "meal", label: "Choose one lighter oil or fried-food swap", note: "One repeatable change is enough." },
      { id: "track_weight", label: "Log weight, BP, or symptoms once", note: "One marker helps show the trend." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "One weight check is enough.", priority: "primary" },
      { key: "bloodPressure", label: "Blood pressure", unit: "mmHg", placeholder: "122/80", hint: "Only if you already track BP.", priority: "secondary" },
    ],
  },
  weight: {
    label: "Weight",
    title: "Weight rhythm plan",
    subtitle: "Keep weight, movement, and one simple food choice visible this week.",
    goal: "Keep weight moving in a steady, realistic direction.",
    summary: "Weight is the clearest goal, so keep the week practical and easy to repeat.",
    tasks: [
      { id: "move", label: "Walk for 20 minutes", note: "A steady walk is enough." },
      { id: "meal", label: "Make one meal a little lighter", note: "Pick one meal you can repeat." },
      { id: "log_weight", label: "Log weight once", note: "One reading is enough for the week." },
    ],
    trackers: [
      { key: "weight", label: "Weight", unit: "kg", placeholder: "72", hint: "One check-in is enough.", priority: "primary" },
      { key: "symptoms", label: "Body note", unit: "", placeholder: "Energy, appetite, sleep, swelling", hint: "Optional if you noticed something useful.", priority: "secondary", quickChoices: ["Energy", "Sleep", "No symptoms"] },
    ],
  },
  stress: {
    label: "Stress",
    title: "Calm week plan",
    subtitle: "Keep stress, sleep, and recovery visible without overloading the day.",
    goal: "Keep the week calmer and easier to review.",
    summary: "Stress feels like the clearest goal, so keep the routine simple and grounded.",
    tasks: [
      { id: "breath", label: "Pause for one quiet reset", note: "One short breathing break counts." },
      { id: "sleep", label: "Protect a regular sleep window", note: "Regular timing helps the week feel calmer." },
      { id: "log", label: "Log one stress or mood note", note: "A short note is enough." },
    ],
    trackers: [
      { key: "symptoms", label: "Mood note", unit: "", placeholder: "Calm, tense, better, tired", hint: "Keep it to one line.", priority: "primary", quickChoices: ["Calm", "Okay", "Tense"] },
      { key: "sleep", label: "Sleep note", unit: "", placeholder: "Slept well, woke often, late night", hint: "Helpful if sleep and stress are linked.", priority: "secondary" },
    ],
  },
};

const MAINTENANCE_GOAL_ORDER = ["steady", "energy", "sleep", "sugar", "cholesterol", "weight", "stress"];

export function normalizePlanFocusKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function signalLabelFor(key = "") {
  if (key === "diabetes") return "Sugar";
  if (key === "lipid") return "Cholesterol";
  if (key === "thyroid") return "Thyroid";
  if (key === "ckd") return "Kidney";
  if (key === "anemia") return "Energy";
  if (key === "liver") return "Liver";
  if (key === "allergy") return "Allergy";
  if (key === "anthropometry") return "Weight";
  if (key === "urine") return "Urine";
  return "Health";
}

function normalizeIssueFocus(issue = {}) {
  const current = normalizePlanFocusKey(issue.focusKey);
  if (current && current !== "general") return current;
  const key = normalizePlanFocusKey(issue.key);
  const metricMap = {
    serum_ige: "allergy",
    bmi: "anthropometry",
    weight: "anthropometry",
    hba1c: "diabetes",
    estimated_average_glucose: "diabetes",
    fbs: "diabetes",
    ppbs: "diabetes",
    rbs: "diabetes",
    hemoglobin: "anemia",
    mch: "anemia",
    mchc: "anemia",
    mcv: "anemia",
    pcv: "anemia",
    rbc_count: "anemia",
    rdw: "anemia",
    wbc: "anemia",
    platelets: "anemia",
    total_cholesterol: "lipid",
    ldl: "lipid",
    hdl: "lipid",
    triglycerides: "lipid",
    creatinine: "ckd",
    urea: "ckd",
    uric_acid: "ckd",
    bilirubin_total: "liver",
    sgpt_alt: "liver",
    sgot_ast: "liver",
  };
  return metricMap[key] || current || "general";
}

const GOAL_TO_CONDITION_FOCUS = {
  sugar: "diabetes",
  cholesterol: "lipid",
  energy: "anemia",
  weight: "anthropometry",
};

function getAbnormalFocusOptions(reportInsights) {
  const issues = Array.isArray(reportInsights?.healthIssues?.abnormal) ? reportInsights.healthIssues.abnormal : [];
  if (issues.length) {
    const grouped = new Map();
    issues.forEach((issue) => {
      const key = normalizeIssueFocus(issue);
      if (!key) return;
      const existing = grouped.get(key);
      const candidate = {
        key,
        label: key === "general" ? issue.focusLabel || "Health" : signalLabelFor(key),
        detail: shorten(
          issue.summary || `${issue.parameter} is ${String(issue.status || "").toLowerCase()} and should stay visible this week.`,
          "Keep tracking this area.",
        ),
        zone: issue.severity === "CRITICAL" ? "high" : "low",
        severity: issue.severity,
        status: issue.status,
        issueCount: 1,
        issueNames: [issue.parameter].filter(Boolean),
        kind: "condition",
      };
      if (!existing || (issue.severityScore || 0) > (existing.severityScore || 0)) {
        grouped.set(key, {
          ...candidate,
          issueCount: (existing?.issueCount || 0) + 1,
          issueNames: [...(existing?.issueNames || []), issue.parameter].filter(Boolean),
          severityScore: issue.severityScore || 0,
        });
      } else {
        existing.issueCount += 1;
        existing.issueNames = [...(existing.issueNames || []), issue.parameter].filter(Boolean);
      }
    });
    return Array.from(grouped.values()).sort((a, b) => {
      if ((b.severityScore || 0) !== (a.severityScore || 0)) return (b.severityScore || 0) - (a.severityScore || 0);
      return String(a.label).localeCompare(String(b.label));
    });
  }

  const summaries = Array.isArray(reportInsights?.conditionSummaries) ? reportInsights.conditionSummaries : [];
  return summaries
    .filter((item) => item && (item.zone === "high" || item.zone === "low"))
    .sort((a, b) => {
      const zoneWeight = { high: 0, low: 1 };
      const aWeight = zoneWeight[a.zone] ?? 2;
      const bWeight = zoneWeight[b.zone] ?? 2;
      if (aWeight !== bWeight) return aWeight - bWeight;
      return String(a.title || a.key || "").localeCompare(String(b.title || b.key || ""));
    })
    .map((item) => ({
      key: String(item.key || "").trim().toLowerCase(),
      label: item.title || signalLabelFor(item.key),
      detail: shorten(item.summary, "Keep tracking this area."),
      zone: item.zone || "normal",
      kind: "condition",
    }))
    .filter((item, index, list) => item.key && list.findIndex((candidate) => candidate.key === item.key) === index);
}

function getMaintenanceFocusOptions() {
  return MAINTENANCE_GOAL_ORDER.map((key) => {
    const item = MAINTENANCE_GOAL_LIBRARY[key];
    return {
      key: `goal:${key}`,
      goalKey: key,
      label: item.label,
      detail: item.summary,
      zone: "normal",
      kind: "goal",
    };
  });
}

function buildMaintenancePlan(goalKey = "steady") {
  const normalizedGoalKey = normalizePlanFocusKey(goalKey).replace(/^goal:/, "");
  const template = MAINTENANCE_GOAL_LIBRARY[normalizedGoalKey] || MAINTENANCE_GOAL_LIBRARY.steady;
  return {
    title: template.title,
    subtitle: template.subtitle,
    goal: template.goal,
    tasks: template.tasks,
    trackers: template.trackers,
    focusKey: `goal:${normalizedGoalKey in MAINTENANCE_GOAL_LIBRARY ? normalizedGoalKey : "steady"}`,
    focusTitle: template.label,
    focusSummary: template.summary,
    focusMode: "goal",
    focusChooserTitle: "Choose a goal to keep steady",
    focusChooserSubtitle: "Reports look calm, so pick what you want to keep visible this week.",
    focusOptions: getMaintenanceFocusOptions(),
    secondaryFocusOptions: [],
    focusHint: "A calm goal keeps the week moving even when nothing is urgent.",
  };
}

function formatDateLabel(value) {
  if (!value) return "No date set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function getReviewUrgency(value) {
  if (!value) {
    return {
      tone: "normal",
      label: "Review date not set",
      detail: "Add a review date if you want a clearer follow-up timeline.",
    };
  }
  const reviewDate = new Date(value);
  if (Number.isNaN(reviewDate.getTime())) {
    return {
      tone: "normal",
      label: value,
      detail: "Keep this review date visible while you continue the plan.",
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reviewDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((reviewDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return {
      tone: "high",
      label: "A follow-up review may help now",
      detail: "A follow-up review may help keep the latest context visible.",
    };
  }
  if (diffDays === 0) {
    return {
      tone: "high",
      label: "Review due today",
      detail: "Today’s saved updates may help make the next review clearer.",
    };
  }
  if (diffDays <= 3) {
    return {
      tone: "low",
      label: `Review in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      detail: "A few useful updates can help keep the next review clearer.",
    };
  }
  return {
    tone: "normal",
    label: `Review in ${diffDays} days`,
    detail: "Keep only the updates that help your next review.",
  };
}

function deriveNextCheckIn({ completedToday, taskCount }) {
  const now = new Date();
  const hour = now.getHours();
  if (completedToday >= taskCount && taskCount > 0) {
    return {
      label: "Tomorrow, 8:00 AM",
      detail: "You can save another update tomorrow if it helps.",
    };
  }
  if (completedToday === 0) {
    if (hour < 11) {
      return {
        label: "Today, 1:00 PM",
        detail: "You can add a short update later today if useful.",
      };
    }
    if (hour < 17) {
      return {
        label: "Today, 7:30 PM",
        detail: "You can add another short update later if useful.",
      };
    }
    return {
      label: "Tonight, before 10:00 PM",
      detail: "You can still save one useful update tonight if it helps.",
    };
  }
  if (completedToday < taskCount) {
    return {
      label: "Tonight, 8:30 PM",
      detail: "You can add another short update later if useful.",
    };
  }
  return {
    label: "Tomorrow, 8:00 AM",
    detail: "You can add another update tomorrow if it helps.",
  };
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatLoggedAt(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatActivityDateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " • " + parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function normalizeUnit(unit = "") {
  const value = String(unit || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "mg/dl") return "mg/dL";
  if (value === "kg") return "kg";
  if (value === "%") return "%";
  if (value === "iu/ml") return "IU/mL";
  return String(unit || "").trim();
}

function formatTrackerValueWithUnit(value = "", unit = "") {
  const normalizedValue = String(value || "").trim();
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedValue) return "";
  if (!normalizedUnit) return normalizedValue;
  const lowerValue = normalizedValue.toLowerCase();
  const lowerUnit = normalizedUnit.toLowerCase();
  if (lowerValue.endsWith(lowerUnit)) {
    return normalizedValue.slice(0, normalizedValue.length - normalizedUnit.length).trimEnd() + ` ${normalizedUnit}`;
  }
  return `${normalizedValue} ${normalizedUnit}`.trim();
}

function getMetricPreference(metricKey = "") {
  const lowerBetter = new Set([
    "hba1c",
    "estimated_average_glucose",
    "fbs",
    "ppbs",
    "rbs",
    "ldl",
    "triglycerides",
    "total_cholesterol",
    "bilirubin_total",
    "sgpt_alt",
    "sgot_ast",
    "creatinine",
    "uric_acid",
    "crp_quantitative",
  ]);
  const higherBetter = new Set(["hdl", "hemoglobin"]);
  if (lowerBetter.has(metricKey)) return "lower";
  if (higherBetter.has(metricKey)) return "higher";
  return "range";
}

function getDistanceFromRange(value, low, high) {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  if (Number.isFinite(low) && value < low) return low - value;
  if (Number.isFinite(high) && value > high) return value - high;
  return 0;
}

function evaluateTrendChange(trend) {
  const latest = Number(trend?.latestValue);
  const previous = Number(trend?.previousValue);
  if (!Number.isFinite(latest) || !Number.isFinite(previous)) {
    return {
      status: "new",
      label: "New baseline",
      detail: "There is not enough older report data yet to compare this trend clearly.",
    };
  }

  const preference = getMetricPreference(trend.metricKey);
  const delta = latest - previous;
  const absDelta = Math.abs(delta);
  if (absDelta < 0.01) {
    return {
      status: "same",
      label: "About the same",
      detail: `${trend.metricLabel} is largely unchanged from the previous reading.`,
    };
  }

  if (preference === "lower") {
    return delta < 0
      ? { status: "better", label: "Improving", detail: `${trend.metricLabel} has moved down from the last reading.` }
      : { status: "worse", label: "Higher than prior report", detail: `${trend.metricLabel} is higher than the last reading and may be worth rechecking.` };
  }
  if (preference === "higher") {
    return delta > 0
      ? { status: "better", label: "Improving", detail: `${trend.metricLabel} has moved up from the last reading.` }
      : { status: "worse", label: "Lower than prior report", detail: `${trend.metricLabel} is lower than the last reading and may be worth reviewing in context.` };
  }

  const latestDistance = getDistanceFromRange(latest, trend.low, trend.high);
  const previousDistance = getDistanceFromRange(previous, trend.low, trend.high);
  if (latestDistance < previousDistance) {
    return { status: "better", label: "Improving", detail: `${trend.metricLabel} is closer to the target range than before.` };
  }
  if (latestDistance > previousDistance) {
    return { status: "worse", label: "Higher than prior report", detail: `${trend.metricLabel} looks farther from the comparison range than before.` };
  }
  return { status: "same", label: "About the same", detail: `${trend.metricLabel} is similar to the previous reading.` };
}

export function resolvePlan(reportInsights, selectedFocusKey = "") {
  const abnormalFocuses = getAbnormalFocusOptions(reportInsights);
  const selectedKey = normalizePlanFocusKey(selectedFocusKey);
  const selectedMaintenanceKey = selectedKey.startsWith("goal:")
    ? selectedKey.replace(/^goal:/, "")
    : selectedKey;
  const mappedConditionKey = GOAL_TO_CONDITION_FOCUS[selectedMaintenanceKey] || selectedKey;
  const selectedCondition = abnormalFocuses.find((item) => item.key === mappedConditionKey || item.key === selectedKey);
  const selectedMaintenance = MAINTENANCE_GOAL_LIBRARY[selectedMaintenanceKey];
  const hasAbnormal = abnormalFocuses.length > 0;
  const hasMultipleAbnormal = abnormalFocuses.length > 1;

  if (selectedCondition) {
    const template = PLAN_LIBRARY[selectedCondition.key] || PLAN_LIBRARY.default;
    return {
      ...template,
      focusKey: selectedCondition.key,
      focusTitle: selectedCondition.label,
      focusSummary: selectedCondition.detail,
      focusMode: "condition",
      focusChooserTitle: hasMultipleAbnormal ? "Choose what to work on first" : "Report focus",
      focusChooserSubtitle: hasMultipleAbnormal
        ? "These are the areas your report flagged. Pick the one you want to start with."
        : "This is the area your report flagged for this week.",
      focusOptions: abnormalFocuses.length > 1 ? abnormalFocuses : [selectedCondition],
      secondaryFocusOptions: [],
      focusHint: selectedCondition.detail,
    };
  }

  if (hasAbnormal) {
    const focus = abnormalFocuses[0];
    const template = PLAN_LIBRARY[focus?.key] || PLAN_LIBRARY.default;
    return {
      ...template,
      focusKey: focus?.key || "default",
      focusTitle: focus?.label || "General health focus",
      focusSummary: focus?.detail || "Upload a structured report to generate a more specific condition-linked plan.",
      focusMode: hasMultipleAbnormal ? "condition-choice" : "condition",
      focusChooserTitle: hasMultipleAbnormal ? "Choose what to work on first" : "Report focus",
      focusChooserSubtitle: hasMultipleAbnormal
        ? "These are the areas your report flagged. Pick the one you want to start with."
        : "This is the area your report flagged for this week.",
      focusOptions: hasMultipleAbnormal ? abnormalFocuses : [focus],
      secondaryFocusOptions: [],
      focusHint: focus?.detail || "Keep this area visible while you build the week.",
    };
  }

  if (selectedMaintenance) {
    return buildMaintenancePlan(selectedMaintenanceKey);
  }

  return buildMaintenancePlan("steady");
}

export function buildPersonalizedPlan(plan, reportInsights) {
  const trends = reportInsights?.trends || [];
  const badges = reportInsights?.badges || [];
  const healthIssues = reportInsights?.healthIssues || {};
  const carePlan = getCarePlan(reportInsights);
  const connectedCare = buildConnectedCareMap(plan, reportInsights);
  const actionPlan = plan.focusMode === "goal" ? null : generateActionPlanFromReport(reportInsights, plan);
  const adaptiveProtocol = buildAdaptiveCareProtocol(plan, reportInsights, connectedCare);
  const otherIssues = (healthIssues.abnormal || [])
    .filter((issue) => normalizePlanFocusKey(issue.focusKey) !== normalizePlanFocusKey(plan.focusKey))
    .slice(0, 2);
  const reviewCount = trends.filter((item) => item.needsReview).length;
  const highTrend = trends.find((item) => item.zone === "high");
  const lowTrend = trends.find((item) => item.zone === "low");
  const latestBadges = badges.slice(0, 2).map((item) => item.label);
  const isGoalMode = plan.focusMode === "goal";
  const focusTrend = isGoalMode ? null : highTrend || lowTrend || trends[0] || null;

  const focusTitle = String(plan.focusTitle || "").trim();
  const focusBase = focusTitle.replace(/ focus$/i, "").replace(/ pattern$/i, "").replace(/ plan$/i, "");
  const personalizedTitle =
    isGoalMode || plan.focusKey === "default" || plan.focusKey === "goal:steady"
      ? plan.title
      : actionPlan?.focusTitle || `${focusBase || plan.title} action plan`;

  const combinedIssueLine = connectedCare.hasMultipleSignals
    ? ` ${connectedCare.planPromise}`
    : otherIssues.length
      ? ` Also keep ${otherIssues.map((issue) => issue.focusLabel || issue.parameter).join(" and ").toLowerCase()} visible, but do not try to fix everything at once.`
    : "";

  const personalizedSubtitle = isGoalMode
    ? `${plan.focusSummary} Use this week to keep the selected goal visible without making the plan feel heavy.`
    : actionPlan?.focusSummary
    ? actionPlan.focusSummary
    : isCautiousPlanFallback(connectedCare.planOutput?.fallbackReason)
    ? "We could not confidently read all report values. Review the report manually or consult a doctor before following a strong routine plan."
    : reviewCount
    ? `${plan.focusSummary} ${reviewCount} value${reviewCount === 1 ? "" : "s"} still need review, so use this plan as a support loop until the next report check.`
    : connectedCare.hasMultipleSignals
      ? `${connectedCare.valueLine} ${connectedCare.planPromise}`
    : highTrend
      ? `${plan.focusSummary} This week's plan keeps the strongest attention area visible without overloading your day.${combinedIssueLine}`
      : lowTrend
        ? `${plan.focusSummary} Use the next few days to keep this trend visible before your next review.${combinedIssueLine}`
        : `${plan.focusSummary} Use this week to keep the report story easy to understand later.${combinedIssueLine}`;

  const personalizedGoal = isGoalMode
    ? plan.goal
    : actionPlan?.fallbackUsed
    ? "Stay cautious, verify the report, and use light follow-up support until the report is clearer."
    : isCautiousPlanFallback(connectedCare.planOutput?.fallbackReason)
    ? "Stay cautious, verify the report, and avoid acting on uncertain extracted values alone."
    : highTrend
    ? `Keep ${highTrend.metricLabel.toLowerCase()} visible while keeping daily actions realistic and easy to repeat.`
    : reviewCount
      ? "Stay consistent while low-confidence values are reviewed and clarified."
      : plan.goal;

  const connectedTasks = actionPlan?.todayActions?.length
    ? actionPlan.todayActions.map((item, index) => ({
        id: createTaskIdFromAction(actionPlan.primaryCluster || "followup", item.title, index),
        actionLabel: item.label,
        label: item.title,
        note: item.description,
      }))
    : buildConnectedTaskSet(plan, connectedCare, reportInsights);
  const personalizedTasks = isGoalMode ? plan.tasks : connectedTasks.map((task, index) => {
    if (index === 0 && highTrend && !actionPlan?.todayActions?.length) {
      return {
        ...task,
        note: task.id === "doctor_handoff_ready"
          ? task.note
          : connectedCare.hasMultipleSignals
          ? task.note
          : `Your latest ${highTrend.metricLabel} result is the clearest signal right now.`,
      };
    }
    if (index === 1 && latestBadges.length && !connectedCare.hasMultipleSignals && !actionPlan?.todayActions?.length) {
      return {
        ...task,
        note: task.note || `Keep ${latestBadges.join(" and ").toLowerCase()} visible only if it helps your next review.`,
      };
    }
    if (index === 2 && reviewCount && !actionPlan?.todayActions?.length) {
      return {
        ...task,
        note: task.note || `Use this note while ${reviewCount} value${reviewCount === 1 ? "" : "s"} are still being reviewed.`,
      };
    }
    return task;
  });

  const connectedTrackers = buildConnectedTrackers(plan, connectedCare, reportInsights);
  const prioritizedTrackers = [...connectedTrackers].sort((a, b) => {
    const priorityWeight = { primary: 0, secondary: 1 };
    const aPriority = priorityWeight[a.priority] ?? 1;
    const bPriority = priorityWeight[b.priority] ?? 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aMatch = focusTrend && a.label.toLowerCase().includes(focusTrend.metricLabel.toLowerCase().split(" ")[0]) ? 0 : a.key === "symptoms" ? 2 : 1;
    const bMatch = focusTrend && b.label.toLowerCase().includes(focusTrend.metricLabel.toLowerCase().split(" ")[0]) ? 0 : b.key === "symptoms" ? 2 : 1;
    return aMatch - bMatch;
  }).slice(0, 3);

  const weeklyPurpose = isGoalMode
    ? `${plan.focusTitle || "This goal"} is here to keep your week easy to review and realistic to follow.`
      : isCautiousPlanFallback(connectedCare.planOutput?.fallbackReason)
      ? "Use this week to confirm the report, keep one useful note, and avoid overreacting to unclear values."
    : connectedCare.hasMultipleSignals
      ? `Keep ${String(plan.focusTitle || "this focus").toLowerCase()} as the anchor. The other flags stay visible without taking over the day.`
    : highTrend
    ? `Keep ${highTrend.metricLabel.toLowerCase()} and your daily routine easier to review this week.`
    : lowTrend
      ? `Watch this mild trend without making the week feel heavy.`
      : `${plan.focusTitle || "This plan"} is here to keep your week easier to explain and review.`;

  const trackingPurpose = prioritizedTrackers.length
    ? actionPlan?.notesPrompt
      ? actionPlan.notesPrompt
      : isCautiousPlanFallback(connectedCare.planOutput?.fallbackReason)
      ? "Track only one useful note while the report values are clarified."
      : `Track ${prioritizedTrackers.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ")} only if it helps make the next review clearer.`
    : "Track only the signals that will help you later.";

  const planOutputSummary = carePlan
    ? {
        overallStatus: carePlan.overallStatus || "Normal",
        priorityIssues: Array.isArray(carePlan.priorityIssues) ? carePlan.priorityIssues : [],
        safetyMessage: carePlan.safetyMessage || "",
      }
    : null;

  return {
    ...plan,
    title: personalizedTitle,
    subtitle: personalizedSubtitle,
    goal: personalizedGoal,
    tasks: personalizedTasks,
    trackers: prioritizedTrackers,
    connectedCare,
    adaptiveProtocol,
    actionPlan,
    weeklyPurpose,
    trackingPurpose,
    focusChooserTitle: plan.focusChooserTitle || "Choose your focus",
    focusChooserSubtitle: plan.focusChooserSubtitle || "Pick the area that should lead this week.",
    focusOptions: plan.focusOptions || [],
    secondaryFocusOptions: plan.secondaryFocusOptions || [],
    focusHint: plan.focusHint || "",
    planOutputSummary,
    coachHint:
      isGoalMode
        ? `Current weekly focus: ${plan.focusTitle || "This week"}`
        : isCautiousPlanFallback(connectedCare.planOutput?.fallbackReason)
          ? "Current follow-up read: manual review before stronger guidance"
        :
      latestBadges.length > 0
        ? `Current follow-up areas: ${latestBadges.join(" • ")}`
        : highTrend
          ? `Current focus area: ${highTrend.metricLabel}`
          : "Current focus area: keep one useful follow-up thread visible",
  };
}

function buildPlanChoiceReason(plan, reportInsights) {
  const summaries = Array.isArray(reportInsights?.conditionSummaries) ? reportInsights.conditionSummaries : [];
  const matchingCondition = summaries.find((item) => normalizePlanFocusKey(item.key) === normalizePlanFocusKey(plan.focusKey));
  if (plan.focusMode === "goal") {
    return {
      label: "Selected by you",
      detail: `This week is centered on ${String(plan.focusTitle || "your goal").toLowerCase()}, so the plan stays personal even when nothing feels urgent.`,
    };
  }
  if (matchingCondition) {
    return {
      label: "Prepared from your report",
      detail: shorten(
        plan.connectedCare?.hasMultipleSignals ? plan.connectedCare.planPromise : matchingCondition.summary,
        "This looked like the clearest signal from the latest report.",
      ),
    };
  }
  return {
    label: "Chosen for this week",
    detail: plan.focusSummary || "This plan keeps the clearest health signal visible without overloading the day.",
  };
}

function readableFocusList(items = []) {
  const labels = items.map((item) => item.focusLabel || item.parameter).filter(Boolean);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function readableMarkerList(items = [], limit = 4) {
  const names = items.map((item) => item.parameter || item.label).filter(Boolean);
  if (!names.length) return "";
  const visible = names.slice(0, limit);
  const extra = names.length - visible.length;
  const text = visible.length === 1
    ? visible[0]
    : visible.length === 2
      ? `${visible[0]} and ${visible[1]}`
      : `${visible.slice(0, -1).join(", ")}, and ${visible[visible.length - 1]}`;
  return extra > 0 ? `${text} + ${extra} more` : text;
}

function getCarePlan(reportInsights) {
  return reportInsights?.carePlan || reportInsights?.decision?.carePlan || null;
}

function mapFocusKeyToActionPlanCluster(focusKey = "") {
  const normalized = normalizePlanFocusKey(focusKey).replace(/^goal:/, "");
  if (normalized === "diabetes") return "sugar_metabolic";
  if (normalized === "anemia") return "cbc_red_cell";
  if (normalized === "allergy") return "allergy_immune";
  if (normalized === "anthropometry" || normalized === "lipid") return "weight_metabolic";
  return "";
}

function mapActionPlanClusterToHistoryFocus(cluster = "") {
  if (cluster === "sugar_metabolic") return "diabetes";
  if (cluster === "cbc_red_cell") return "anemia";
  if (cluster === "allergy_immune") return "allergy";
  if (cluster === "weight_metabolic") return "anthropometry";
  return "";
}

function inferActionPlanClusterFromText(...values) {
  const text = values
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(" ");
  if (!text) return "";
  if (/(hba1c|estimated average glucose|fasting glucose|postprandial glucose|\bglucose\b|\bfbs\b|\bppbs\b|\brbs\b|sugar)/i.test(text)) {
    return "sugar_metabolic";
  }
  if (/(mcv|mchc|\bmch\b|hemoglobin|haemoglobin|\brbc\b|red-cell|cbc)/i.test(text)) {
    return "cbc_red_cell";
  }
  if (/(serum ige|\bige\b|eosinophils|allergy|immune|sinus|breathing|skin)/i.test(text)) {
    return "allergy_immune";
  }
  if (/(bmi|weight|metabolic)/i.test(text)) {
    return "weight_metabolic";
  }
  return "";
}

function getActionPlanClusterLabel(cluster = "") {
  if (cluster === "sugar_metabolic") return "Sugar/metabolic markers";
  if (cluster === "cbc_red_cell") return "Red-cell indices";
  if (cluster === "allergy_immune") return "Allergy/immune context";
  if (cluster === "weight_metabolic") return "Weight/metabolic context";
  return "Follow-up area";
}

function getGuidedPriorityItems(reportInsights) {
  const guided = reportInsights?.priorities || reportInsights?.guidedFollowUp?.priorities;
  if (Array.isArray(guided) && guided.length) return guided;
  const carePlan = getCarePlan(reportInsights);
  return Array.isArray(carePlan?.priorityIssues) ? carePlan.priorityIssues : [];
}

function isCautiousPlanFallback(reason = "") {
  return ["low_confidence", "partial_report", "unclear_extraction"].includes(String(reason || ""));
}

function getActionPlanPatientContext(reportInsights) {
  const source = reportInsights?.patientContext || {};
  const ageYears = Number(source.ageYears ?? source.age ?? null);
  const chronicConditions = Array.isArray(source.chronicConditions) ? source.chronicConditions : [];
  const allergies = Array.isArray(source.allergies) ? source.allergies : [];
  const lowerConditions = chronicConditions.map((item) => String(item || "").toLowerCase());
  const lowerAllergies = allergies.map((item) => String(item || "").toLowerCase());
  return {
    ageYears: Number.isFinite(ageYears) ? ageYears : null,
    sex: String(source.sex || "").trim(),
    chronicConditions,
    allergies,
    flags: {
      pediatric: Number.isFinite(ageYears) && ageYears < 18,
      olderAdult: Number.isFinite(ageYears) && ageYears >= 65,
      diabetes: lowerConditions.some((item) => /\bdiabetes\b|\bprediabetes\b|blood sugar|\bdm\b|\bt1dm\b|\bt2dm\b|type\s*1\s*dm|type\s*2\s*dm/.test(item)),
      thyroid: lowerConditions.some((item) => /thyroid/.test(item)),
      kidney: lowerConditions.some((item) => /kidney|renal|ckd/.test(item)),
      inflammatorySkin: lowerConditions.some((item) => /\bhs\b|hidradenitis|psoriasis|chronic inflammation|inflammatory skin/.test(item)),
      allergy:
        lowerConditions.some((item) => /allerg|asthma|eczema|sinus|rhinitis|urticaria|hives|hay fever/.test(item)) ||
        lowerAllergies.some((item) => /allerg|dust|pollen|food|drug|penicillin|peanut|shellfish|milk|egg|soy|wheat/.test(item)),
    },
  };
}

// Future AI integration point:
// OpenAI can replace or enhance this deterministic plan generator later,
// but the UI should continue consuming the same actionPlan shape.
export function generateActionPlanFromReport(reportInsights, plan = null) {
  const carePlan = getCarePlan(reportInsights);
  const abnormalIssues = Array.isArray(reportInsights?.healthIssues?.abnormal) ? reportInsights.healthIssues.abnormal : [];
  const guidedPriorities = getGuidedPriorityItems(reportInsights);
  const patientContext = getActionPlanPatientContext(reportInsights);
  const personalizedFollowUp = reportInsights?.personalizedFollowUp || {};
  const lowConfidence =
    isCautiousPlanFallback(carePlan?.fallbackReason) ||
    reportInsights?.overview?.confidenceLevel === "low" ||
    reportInsights?.guidedFollowUp?.overview?.confidenceLevel === "low";

  const clusterMap = new Map();
  const ensureCluster = (cluster) => {
    if (!cluster) return null;
    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, {
        cluster,
        score: 0,
        findings: [],
        guidedCount: 0,
        followUpWeight: 0,
      });
    }
    return clusterMap.get(cluster);
  };

  guidedPriorities.forEach((item, index) => {
    const cluster =
      inferActionPlanClusterFromText(item?.conditionArea, item?.condition, item?.findingLabel, item?.finding, item?.reason) ||
      mapFocusKeyToActionPlanCluster(item?.focusKey);
    const bucket = ensureCluster(cluster);
    if (!bucket) return;
    const attentionText = String(item?.attentionLevel || item?.severity || item?.followUpImportance || "").toLowerCase();
    const attentionWeight = attentionText.includes("prompt") ? 12 : attentionText.includes("timely") ? 9 : attentionText.includes("discuss") ? 6 : 4;
    bucket.score += 120 - index * 15 + attentionWeight;
    bucket.guidedCount += 1;
    bucket.followUpWeight += attentionWeight;
    if (item?.findingLabel) bucket.findings.push(item.findingLabel);
    if (item?.condition) bucket.findings.push(item.condition);
  });

  abnormalIssues.forEach((issue) => {
    const cluster =
      mapFocusKeyToActionPlanCluster(normalizeIssueFocus(issue)) ||
      inferActionPlanClusterFromText(issue?.parameter, issue?.focusLabel, issue?.summary);
    const bucket = ensureCluster(cluster);
    if (!bucket) return;
    bucket.score += 18 + severityRank(issue?.severity);
    if (issue?.parameter) bucket.findings.push(issue.parameter);
  });

  const requestedCluster = mapFocusKeyToActionPlanCluster(plan?.focusKey);
  if (requestedCluster && clusterMap.has(requestedCluster)) {
    clusterMap.get(requestedCluster).score += 14;
  }

  const rankedClusters = Array.from(clusterMap.values())
    .map((item) => ({
      ...item,
      findings: item.findings.filter((value, index, list) => value && list.findIndex((candidate) => candidate === value) === index),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.guidedCount !== a.guidedCount) return b.guidedCount - a.guidedCount;
      return b.findings.length - a.findings.length;
    });

  const primaryCluster = !lowConfidence
    ? requestedCluster && clusterMap.has(requestedCluster)
      ? requestedCluster
      : rankedClusters.length
        ? rankedClusters[0].cluster
        : ""
    : "";
  const historyCount = getFocusHistoryCount(reportInsights, mapActionPlanClusterToHistoryFocus(primaryCluster));

  const fallbackPlan = {
    primaryCluster: "fallback",
    focusTitle: "Follow-up support plan",
    focusSummary: lowConfidence
      ? "We could not confidently read all report values, so this plan stays light until the report is reviewed manually."
      : "This plan stays light until clearer report-linked follow-up areas are available.",
    relatedAreas: [],
    todayActions: [
      {
        label: "Prepare",
        title: "Review the uploaded report",
        description: "Check whether the important values were read correctly before using the plan.",
      },
      {
        label: "Keep handy",
        title: "Save one useful note",
        description: "One note about symptoms, readings, medicines, or questions can help during follow-up.",
      },
      {
        label: "Review prep",
        title: "Bring the original report",
        description: "Keep the original report available for clinician review.",
      },
    ],
    followUpGuidance: [
      "Focus on the grouped findings first.",
      "Bring prior reports if available.",
      "Keep one useful symptom, BP, sugar, or routine note if available.",
      "Use the doctor questions below to guide your next review.",
    ],
    doctorPrep: [
      "Bring the original report if any value looks unclear.",
      "Keep one short note about symptoms, medicines, or questions ready.",
      "Use manual review or clinician review before acting on uncertain values.",
    ],
    notesPrompt: "One useful note is enough if it helps your next review.",
    fallbackUsed: true,
  };

  if (!primaryCluster) {
    return fallbackPlan;
  }

  const relatedAreas = rankedClusters
    .filter((item) => item.cluster !== primaryCluster)
    .slice(0, 2)
    .map((item) => getActionPlanClusterLabel(item.cluster));

  const clusterPlans = {
    sugar_metabolic: {
      focusTitle: "Sugar action plan",
      focusSummary: patientContext.flags.diabetes && patientContext.flags.inflammatorySkin
        ? "This plan focuses first on sugar-related findings while keeping your existing sugar condition, inflammatory history, and other report areas visible."
        : patientContext.flags.diabetes
        ? "This plan focuses first on sugar-related findings while keeping your existing sugar condition and other report areas visible."
        : "This plan focuses first on sugar-related findings while keeping other report areas visible.",
      todayActions: [
        {
          label: "Keep handy",
          title: "Keep one recent sugar reading visible",
          description: "If available, keep one recent sugar reading or glucose-related note ready for follow-up.",
        },
        {
          label: "Prepare",
          title: "Bring prior HbA1c or glucose reports",
          description: historyCount > 1
            ? patientContext.flags.diabetes
              ? "Prior HbA1c, glucose reports, or recent sugar logs can help compare this with your existing sugar follow-up."
              : "Prior reports can help your clinician compare whether this result is stable or changing."
            : "If available, prior HbA1c or glucose reports can still make the next review clearer.",
        },
        {
          label: "Track if useful",
          title: "Save one sugar-context note",
          description: patientContext.flags.diabetes && patientContext.flags.inflammatorySkin
            ? "One short note about appetite, thirst, sleep, energy, pain, swelling, or flare activity can make the next sugar review clearer."
            : patientContext.flags.diabetes
            ? "One short note about appetite, thirst, sleep, energy, meal timing, or medicine timing can make the next sugar review clearer."
            : "One short note about appetite, thirst, sleep, energy, meal timing, or medicine timing can make the next review clearer.",
        },
      ],
      followUpGuidance: [
        "Focus on the grouped findings first.",
        "Bring prior reports if available.",
        patientContext.flags.inflammatorySkin
          ? "Keep recent sugar, flare, swelling, pain, or symptom notes visible during follow-up."
          : "Keep recent sugar, BP, or symptom notes visible during follow-up.",
        patientContext.flags.pediatric
          ? "Age can change how some sugar-related ranges are interpreted, so review this in full clinical context."
          : historyCount > 1
            ? "More report history is already helping compare whether this pattern is stable."
            : "More report history may help clarify whether this pattern stays stable.",
      ],
      doctorPrep: [
        patientContext.flags.inflammatorySkin
          ? "Could elevated sugar levels be worsening inflammation or flare patterns in my existing condition?"
          : "Do these sugar-related markers suggest my current routine or treatment plan needs review?",
        "When should HbA1c or glucose-related testing be repeated?",
        "Bring recent sugar readings if they help the discussion.",
      ],
      notesPrompt: patientContext.flags.inflammatorySkin
        ? "Keep one recent sugar reading or one short sugar, flare, or symptom note only if it helps your next review."
        : "Keep one recent sugar reading or one short sugar-context note only if it helps your next review.",
    },
    cbc_red_cell: {
      focusTitle: "CBC follow-up plan",
      focusSummary: patientContext.flags.pediatric
        ? "This plan focuses first on red-cell findings while keeping age-specific interpretation in view."
        : "This plan focuses first on red-cell findings while keeping other report areas visible.",
      todayActions: [
        {
          label: "Prepare",
          title: "Keep prior CBC reports ready",
          description: "Older CBC reports can help compare whether red-cell indices are similar or changing.",
        },
        {
          label: "Track if useful",
          title: "Save one energy-related note",
          description: "One short note about fatigue, dizziness, weakness, or low energy may help during follow-up if relevant.",
        },
        {
          label: "Keep handy",
          title: "Note whether symptoms repeat",
          description: "If symptoms exist, noting whether they are occasional or repeated can make the review clearer.",
        },
      ],
      followUpGuidance: [
        "Focus on the grouped findings first.",
        "Bring prior reports if available.",
        "Keep one short fatigue, dizziness, or low-energy note only if relevant.",
        historyCount > 1 ? "Earlier CBC history can help show whether these findings are repeating." : "More report history may help clarify whether this pattern stays stable.",
      ],
      doctorPrep: [
        "Do these red-cell index changes need iron, B12, or further CBC review?",
        "Should these CBC findings be repeated or compared with symptoms?",
        "Bring older CBC reports if available.",
      ],
      notesPrompt: "Keep one CBC-related symptom note only if it helps the next review.",
    },
    allergy_immune: {
      focusTitle: "Allergy/immune follow-up plan",
      focusSummary: patientContext.flags.allergy && patientContext.flags.inflammatorySkin
        ? "This plan keeps allergy or immune-related context visible alongside known allergy history and inflammatory patterns without overreacting to one result."
        : patientContext.flags.allergy
        ? "This plan keeps allergy or immune-related context visible alongside known allergy history without overreacting to one result."
        : "This plan keeps allergy or immune-related context visible without overreacting to one result.",
      todayActions: [
        {
          label: "Track if useful",
          title: "Note allergy-related symptoms",
          description: "If relevant, save one note about skin, sinus, breathing, itching, or seasonal symptoms.",
        },
        {
          label: "Keep handy",
          title: "Keep allergy-related medicines visible",
          description: patientContext.flags.allergy
            ? "If you already use allergy-related medicines or know common triggers, keeping them visible may help the clinician review context."
            : "If you use allergy-related medicines, keeping their names ready may help the clinician review context.",
        },
        {
          label: "Review prep",
          title: "Check whether symptoms are repeated",
          description: "Noting whether symptoms happen often, seasonally, or after triggers can support follow-up.",
        },
      ],
      followUpGuidance: [
        "Focus on the grouped findings first.",
        "Bring prior reports if available.",
        "Keep one useful symptom note only if it helps the next review.",
        historyCount > 1 ? "Repeated report history may help show whether this context is staying similar." : "More report history may help clarify whether this pattern stays stable.",
      ],
      doctorPrep: [
        "Does this result matter in the context of allergies, asthma, skin symptoms, or infections?",
        "Were any symptoms seasonal, repeated, or trigger-linked?",
        "Keep current allergy-related medicines visible if useful.",
      ],
      notesPrompt: "One allergy, skin, sinus, or breathing note is enough if it helps your next review.",
    },
    weight_metabolic: {
      focusTitle: "Weight/metabolic context plan",
      focusSummary: patientContext.flags.diabetes
        ? "This plan keeps weight or metabolic context visible while your sugar-related follow-up stays easier to review."
        : "This plan keeps weight or metabolic context visible while letting one follow-up area lead at a time.",
      todayActions: [
        {
          label: "Track if useful",
          title: "Save one routine-context note",
          description: "One short note about sleep, appetite, eating schedule, or activity timing may help interpret this area.",
        },
        {
          label: "Prepare",
          title: "Bring older weight or sugar records",
          description: "Past weight, BMI, or sugar-related reports can help compare changes over time.",
        },
        {
          label: "Keep handy",
          title: "Keep follow-up questions ready",
          description: "Use the doctor questions to understand how this context affects the rest of the report.",
        },
      ],
      followUpGuidance: [
        "Focus on the grouped findings first.",
        "Bring prior reports if available.",
        "Keep recent sugar, BP, symptom, or routine notes visible during follow-up.",
        historyCount > 1 ? "Earlier reports may help show whether this context is shifting or staying similar." : "More report history may help clarify whether this pattern stays stable.",
      ],
      doctorPrep: [
        "Does my BMI affect how we should interpret my sugar or metabolic risk?",
        "Should older weight or sugar records be compared during follow-up?",
        "Keep one routine note handy only if it helps the review.",
      ],
      notesPrompt: "A short sleep, appetite, or routine note is enough if it helps your next review.",
    },
  };

  const selectedPlan = clusterPlans[primaryCluster] || fallbackPlan;
  return {
    primaryCluster,
    focusTitle: selectedPlan.focusTitle,
    focusSummary: personalizedFollowUp?.priorityArea && primaryCluster === "sugar_metabolic" && patientContext.flags.inflammatorySkin
      ? `${selectedPlan.focusSummary} ${personalizedFollowUp.priorityArea.urgencyNote || ""}`.trim()
      : selectedPlan.focusSummary,
    relatedAreas,
    todayActions: selectedPlan.todayActions,
    followUpGuidance: selectedPlan.followUpGuidance,
    doctorPrep: selectedPlan.doctorPrep,
    notesPrompt: selectedPlan.notesPrompt,
    fallbackUsed: false,
  };
}

function pickCarePlanSection(carePlan, category) {
  return (carePlan?.dailyPlan || []).find((section) => normalizePlanFocusKey(section.category) === normalizePlanFocusKey(category)) || null;
}

function createTaskIdFromAction(prefix, action = "", index = 0) {
  const slug = String(action || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `${prefix}_${slug || index}`;
}

function buildConnectedCareMap(plan, reportInsights) {
  const carePlan = getCarePlan(reportInsights);
  const abnormalIssues = Array.isArray(reportInsights?.healthIssues?.abnormal) ? reportInsights.healthIssues.abnormal : [];
  const rawFocusKey = normalizePlanFocusKey(plan.focusKey).replace(/^goal:/, "");
  const normalizedFocusKey = GOAL_TO_CONDITION_FOCUS[rawFocusKey] || rawFocusKey;
  if (!abnormalIssues.length) {
    return {
      clusterLabel: plan.focusMode === "goal" ? "Personal weekly rhythm" : "Report plan",
      valueLine: "No abnormal report priority is active right now. Use this as a light starter plan until a report creates a clearer focus.",
      planPromise: "Do one useful action today and save one quick note. That is enough.",
      primaryIssue: null,
      issueCount: 0,
      primaryFocusIssueCount: 0,
      companionFocusCount: 0,
      markerBrief: "",
      primaryMarkerBrief: "",
      groupedFocusPhrase: "",
      rankedFocusKeys: [normalizedFocusKey].filter(Boolean),
      companionIssues: [],
      guardrails: [],
      focusKeys: new Set([normalizedFocusKey].filter(Boolean)),
      hasMultipleSignals: false,
    };
  }
  const primaryIssue =
    abnormalIssues.find((issue) => normalizeIssueFocus(issue) === normalizedFocusKey) ||
    abnormalIssues[0] ||
    null;
  const primaryFocusKey = normalizeIssueFocus(primaryIssue);
  const primaryFocusIssues = abnormalIssues.filter((issue) => normalizeIssueFocus(issue) === primaryFocusKey);
  const companionFocusIssues = abnormalIssues.filter((issue) => normalizeIssueFocus(issue) !== primaryFocusKey);
  const companionIssues = abnormalIssues.filter((issue) => issue !== primaryIssue).slice(0, 5);
  const issueCount = abnormalIssues.length;
  const primaryFocusIssueCount = primaryFocusIssues.length;
  const companionFocusCount = new Set(companionFocusIssues.map((issue) => normalizePlanFocusKey(issue.focusKey)).filter(Boolean)).size;
  const markerBrief = readableMarkerList(abnormalIssues, 4);
  const primaryMarkerBrief = readableMarkerList(primaryFocusIssues, 4);
  const groupedFocuses = Array.from(
    abnormalIssues.reduce((map, issue) => {
      const key = normalizeIssueFocus(issue);
      if (!key) return map;
      const existing = map.get(key) || {
        key,
        label: key === "general" ? issue.focusLabel || "Health" : signalLabelFor(key),
        issues: [],
      };
      existing.issues.push(issue);
      map.set(key, existing);
      return map;
    }, new Map()).values(),
  );
  const watchlistFocuses = groupedFocuses.filter((group) => group.key !== primaryFocusKey);
  const watchlistPhrase = (() => {
    const labels = watchlistFocuses.map((group) => String(group.label || "").toLowerCase()).filter(Boolean);
    if (!labels.length) return "";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  })();
  const rankedFocuses = groupedFocuses
    .map((group, index) => ({
      ...group,
      rankIndex: index,
      severityScore: Math.max(...group.issues.map((issue) => Number(issue.severityScore || severityRank(issue.severity)))),
    }))
    .sort((a, b) => {
      if ((b.severityScore || 0) !== (a.severityScore || 0)) return (b.severityScore || 0) - (a.severityScore || 0);
      return a.rankIndex - b.rankIndex;
    });
  const rankedFocusKeys = rankedFocuses.map((group) => group.key).filter(Boolean);
  const strongestCompanionFocus = rankedFocuses.find((group) => group.key !== primaryFocusKey) || null;
  const focusKeys = new Set(
    [primaryIssue, ...companionIssues]
      .map((issue) => normalizePlanFocusKey(issue?.focusKey))
      .filter(Boolean),
  );
  const has = (key) => focusKeys.has(key);
  const clusterLabel = primaryFocusKey && strongestCompanionFocus
    ? "Related follow-up areas"
    : companionFocusCount > 0
      ? "Related follow-up areas"
      : primaryFocusIssueCount > 1
        ? `${primaryIssue?.focusLabel || "Report"} grouped findings`
      : primaryIssue
        ? `${primaryIssue.focusLabel || "Report"} follow-up focus`
        : "Personal weekly rhythm";

  const valueLine = issueCount > 1
    ? companionFocusCount > 0
      ? `Main focus this week: ${signalLabelFor(primaryFocusKey).toLowerCase()}. Other areas stay in view${watchlistPhrase ? `: ${watchlistPhrase}` : ""}, so the plan does not ignore the full report.`
      : `${issueCount} ${signalLabelFor(primaryFocusKey).toLowerCase()} markers are connected. This week treats them as one focus instead of separate tasks.`
    : primaryIssue
      ? `This week starts from ${primaryIssue.parameter}, then keeps the routine small enough for a real day.`
      : "When reports look calm, the plan keeps one chosen goal visible so your next report has useful context.";

  const guardrailMap = {
    diabetes: "Keep sugar-related findings easier to review without overloading the day.",
    lipid: "Keep food, readings, and follow-up questions practical and easy to repeat.",
    ckd: "Keep BP, swelling, urine changes, or medicine questions visible for review.",
    liver: "Keep symptoms, medicines, and prior reports ready if follow-up is needed.",
    anemia: "Keep fatigue, dizziness, breathlessness, and prior CBC context visible.",
    thyroid: "Keep energy, sleep, weight, or timing notes handy only if they help follow-up.",
    anthropometry: "Keep weight or routine context visible without turning it into a target.",
    allergy: "Keep symptoms and triggers visible because immune-related findings need context.",
    urine: "Keep urine symptoms, hydration notes, and repeat-report context visible.",
  };

  const guardrails = groupedFocuses
    .sort((a, b) => {
      if (a.key === primaryFocusKey) return -1;
      if (b.key === primaryFocusKey) return 1;
      const order = ["lipid", "ckd", "anthropometry", "anemia", "thyroid", "liver", "allergy", "urine", "general"];
      return (order.indexOf(a.key) === -1 ? 99 : order.indexOf(a.key)) - (order.indexOf(b.key) === -1 ? 99 : order.indexOf(b.key));
    })
    .map((group) => ({
      key: group.key,
      label: `${group.label}${group.issues.length > 1 ? ` (${group.issues.length})` : ""}`,
      detail: `${guardrailMap[group.key] || "Keep this signal visible for the next review."} ${readableMarkerList(group.issues, 3)}.`,
    }))
    .filter((item) => item.label)
    .slice(0, 3);

  const planPromise = issueCount > 1
    ? "This plan focuses on one main follow-up area while keeping the other findings visible."
    : "This plan keeps one useful follow-up area visible without overloading the day.";

  const priorityIssues = Array.isArray(carePlan?.priorityIssues) ? carePlan.priorityIssues : [];
  const topPriority = priorityIssues[0] || null;
  const combinedConditions = priorityIssues.slice(0, 3).map((item) => item.condition).filter(Boolean);
  const combinedConditionText = combinedConditions.length === 1
    ? combinedConditions[0]
    : combinedConditions.length === 2
      ? `${combinedConditions[0]} and ${combinedConditions[1]}`
      : `${combinedConditions.slice(0, -1).join(", ")}, and ${combinedConditions[combinedConditions.length - 1]}`;
  const planOutput = {
    overallStatus: carePlan?.overallStatus || reportInsights?.decision?.overallStatus || "Normal",
    priorityIssues,
    dailyPlan: Array.isArray(carePlan?.dailyPlan) ? carePlan.dailyPlan : [],
    safetyMessage: carePlan?.safetyMessage || reportInsights?.decision?.disclaimer || "",
    doctorReviewRecommended: Boolean(carePlan?.doctorReviewRecommended),
    fallbackReason: carePlan?.fallbackReason || null,
    topPriority,
    combinedConditionText,
  };

  return {
    clusterLabel,
    valueLine,
    planPromise,
    primaryIssue,
    issueCount,
    primaryFocusIssueCount,
    companionFocusCount,
    markerBrief,
    primaryMarkerBrief,
    groupedFocusPhrase: watchlistPhrase,
    rankedFocusKeys,
    companionIssues,
    guardrails,
    focusKeys,
    hasMultipleSignals: issueCount > 1,
    planOutput,
  };
}

function getFocusHistoryCount(reportInsights, focusKey = "") {
  const normalizedFocusKey = normalizePlanFocusKey(focusKey);
  const trendKeysByFocus = {
    diabetes: ["hba1c", "estimated_average_glucose", "fbs", "ppbs", "rbs"],
    anemia: ["hemoglobin", "mcv", "mch", "mchc", "pcv", "rbc_count", "rdw"],
    allergy: ["serum_ige"],
    anthropometry: ["bmi", "weight", "hba1c", "estimated_average_glucose"],
    lipid: ["total_cholesterol", "ldl", "hdl", "triglycerides"],
    ckd: ["creatinine", "urea", "uric_acid"],
    liver: ["bilirubin_total", "sgpt_alt", "sgot_ast"],
    thyroid: ["tsh", "t3", "t4"],
    urine: ["urine_protein", "urine_glucose", "urine_ketones", "urine_blood"],
  };
  const allowedKeys = new Set(trendKeysByFocus[normalizedFocusKey] || []);
  const trends = Array.isArray(reportInsights?.trends) ? reportInsights.trends : [];
  const matchingTrend = trends.find((trend) => allowedKeys.has(normalizePlanFocusKey(trend.metricKey)));
  if (!matchingTrend || !Array.isArray(matchingTrend.points)) return 0;
  return matchingTrend.points.filter((point) => Number.isFinite(Number(point.value))).length;
}

function getClusterContextSpec(focusKey, { historyCount = 0, hasMultipleSignals = false, markerBrief = "" } = {}) {
  const specMap = {
    diabetes: {
      tasks: [
        "Keep one recent sugar reading visible today if available.",
        historyCount > 1
          ? "Bring prior HbA1c or glucose reports during follow-up if possible."
          : "Keep meal timing or medicine timing visible if it helps your next review.",
        "Save one short note about appetite, thirst, sleep, or energy only if relevant.",
      ],
      notes: [
        markerBrief ? `This keeps ${markerBrief} easier to review together.` : "This keeps sugar-related follow-up easier to review.",
        historyCount > 1 ? "More than one report is available, so earlier values may help show continuity." : "More report history may help clarify whether this pattern stays stable.",
        "Only one focus area is prioritized at a time to reduce overload.",
      ],
      trackers: [
        { key: "bloodSugar", label: "Recent sugar reading", unit: "mg/dL", placeholder: "110", hint: "Only if you already have a useful reading.", priority: "primary" },
        { key: "symptoms", label: "Follow-up note", unit: "", placeholder: "Appetite, thirst, sleep, energy", hint: "Only if it helps the next review.", priority: "primary", quickChoices: ["Thirst", "Low energy", "No symptoms"] },
        { key: "timing", label: "Meal or medicine timing note", unit: "", placeholder: "Late dinner, missed timing, regular timing", hint: "Optional unless it helps explain the readings.", priority: "secondary" },
      ],
    },
    anemia: {
      tasks: [
        "Keep prior CBC reports ready if available.",
        "Save one note about fatigue, dizziness, or low energy only if relevant.",
        "Track whether symptoms feel repeated or occasional.",
      ],
      notes: [
        markerBrief ? `This keeps ${markerBrief} easier to review together.` : "This keeps red-cell findings easier to review together.",
        historyCount > 1 ? "Earlier CBC results may help show whether these findings are repeating." : "More report history may help clarify whether this pattern stays stable.",
        "Only one focus area is prioritized at a time to reduce overload.",
      ],
      trackers: [
        { key: "symptoms", label: "Energy or symptoms note", unit: "", placeholder: "Fatigue, dizziness, low energy", hint: "Only if it helps the next review.", priority: "primary", quickChoices: ["Fatigue", "Dizziness", "No symptoms"] },
        { key: "cbc_history", label: "Prior CBC ready", unit: "", placeholder: "Yes / No / Need to find it", hint: "Useful if earlier reports are available.", priority: "secondary" },
      ],
    },
    allergy: {
      tasks: [
        "Note any allergy, sinus, breathing, or skin symptoms only if relevant.",
        "Track whether symptoms appear seasonal or repeated.",
        "Keep allergy-related medicines visible during follow-up if useful.",
      ],
      notes: [
        "Immune-related findings usually make more sense with symptom context.",
        historyCount > 1 ? "Repeated report history may help show whether this is staying similar over time." : "More report history may help clarify whether this pattern stays stable.",
        "Only one focus area is prioritized at a time to reduce overload.",
      ],
      trackers: [
        { key: "symptoms", label: "Allergy note", unit: "", placeholder: "Sinus, breathing, skin, seasonal pattern", hint: "Only if symptoms are actually relevant.", priority: "primary", quickChoices: ["Sneezing", "Skin", "Breathing", "No symptoms"] },
        { key: "medicines", label: "Current allergy medicines", unit: "", placeholder: "Cetirizine, inhaler, none", hint: "Optional if it helps during follow-up.", priority: "secondary" },
      ],
    },
    anthropometry: {
      tasks: [
        "Keep one note about sleep, appetite, or activity timing if useful.",
        "Bring older weight or sugar reports if comparing changes.",
        "Save one note about energy or appetite only if relevant.",
      ],
      notes: [
        "Weight or metabolic context usually becomes clearer when compared with older reports.",
        historyCount > 1 ? "Earlier reports may help show whether this context is staying similar or shifting." : "More report history may help clarify whether this pattern stays stable.",
        "Only one focus area is prioritized at a time to reduce overload.",
      ],
      trackers: [
        { key: "routine", label: "Routine note", unit: "", placeholder: "Late sleep, meal timing, activity timing", hint: "Only if it helps the next review.", priority: "primary" },
        { key: "symptoms", label: "Energy or appetite note", unit: "", placeholder: "Low appetite, low energy, no change", hint: "Optional if relevant to the report.", priority: "secondary", quickChoices: ["Low energy", "Appetite change", "No symptoms"] },
      ],
    },
  };
  return specMap[normalizePlanFocusKey(focusKey)] || null;
}

function buildConnectedTaskSet(plan, careMap, reportInsights) {
  const planOutput = careMap.planOutput || {};
  if (isCautiousPlanFallback(planOutput.fallbackReason)) {
    return [
      {
        id: "manual_review_first",
        label: "Review the extracted values first",
        note: "We could not confidently read all report values, so use the original report before relying on the plan.",
      },
      {
        id: "avoid_strong_changes",
        label: "Avoid strong self-treatment changes",
        note: "Do not start medicines, supplements, or major restrictions from uncertain values alone.",
      },
      {
        id: "doctor_or_manual_help",
        label: "Consult a doctor if the report still feels unclear",
        note: "Use clinician review when values, symptoms, or report quality feel uncertain.",
      },
    ];
  }
  const focusKey = normalizePlanFocusKey(plan.focusKey).replace(/^goal:/, "");
  const has = (key) => careMap.focusKeys?.has(key);
  const baseFocus = careMap.primaryIssue ? normalizePlanFocusKey(careMap.primaryIssue.focusKey) : focusKey;
  const historyCount = getFocusHistoryCount(reportInsights, baseFocus);
  const clusterSpec = getClusterContextSpec(baseFocus, {
    historyCount,
    hasMultipleSignals: careMap.hasMultipleSignals,
    markerBrief: careMap.primaryMarkerBrief,
  });
  if (clusterSpec) {
    return clusterSpec.tasks.slice(0, 3).map((label, index) => ({
      id: createTaskIdFromAction(baseFocus || "focus", label, index),
      label,
      note: clusterSpec.notes[index] || "Keep this light and useful for the next review.",
    }));
  }
  const tasksByFocus = {
    diabetes: {
      id: "sugar_reading_visible",
      label: "Keep one recent sugar reading visible today if available",
      note: careMap.primaryFocusIssueCount > 1
        ? `This supports the sugar-related findings together: ${careMap.primaryMarkerBrief}.`
        : "Use the reading only if it helps your next follow-up review.",
    },
    lipid: {
      id: "lipid_reports_ready",
      label: "Bring prior cholesterol or metabolic reports if available",
      note: careMap.primaryFocusIssueCount > 1
        ? `These findings are easier to review together when earlier reports are visible: ${careMap.primaryMarkerBrief}.`
        : "Use earlier reports only if they help compare the current findings.",
    },
    ckd: {
      id: "bp_swelling_watch",
      label: "Check BP or swelling once if available",
      note: "This keeps the kidney-related follow-up clearer without adding a heavy form.",
    },
    liver: {
      id: "liver_conservative_day",
      label: "Keep today conservative for liver load",
      note: "Avoid alcohol and unnecessary medicines unless prescribed. Watch nausea, yellowing, pain, or dark urine.",
    },
    anemia: {
      id: "cbc_note",
      label: "Save one short note about fatigue, dizziness, or low energy only if relevant",
      note: "A short note can make red-cell follow-up easier to explain.",
    },
    thyroid: {
      id: "thyroid_timing_energy",
      label: "Keep thyroid timing and energy visible",
      note: "If you already take thyroid medicine, keep the prescribed timing steady and log one energy or mood note.",
    },
    anthropometry: {
      id: "weight_rhythm_step",
      label: "Keep one routine note about sleep, eating schedule, or activity timing if useful",
      note: "Only if it helps your next follow-up review.",
    },
    allergy: {
      id: "allergy_pattern_note",
      label: "Note any allergy, skin, breathing, or sinus symptoms only if relevant",
      note: "A short symptom note is usually more useful than reacting to the number alone.",
    },
    urine: {
      id: "urine_change_note",
      label: "Note urine symptoms or hydration change",
      note: "Track burning, frequency, color change, swelling, or no symptoms for review.",
    },
  };

  const firstTask = tasksByFocus[baseFocus] || plan.tasks[0];
  const secondTask = (careMap.rankedFocusKeys || [])
    .filter((key) => key !== baseFocus && has(key))
    .map((key) => tasksByFocus[key])
    .find(Boolean) || null;

  const checkInTask = {
    id: "followup_checkin",
    label: "Save one useful follow-up note",
    note: careMap.issueCount > 1
      ? "One line is enough: symptom, BP/sugar reading, meal timing, sleep, or routine context."
      : "Write the one thing that would help the next follow-up review: symptom, reading, meal timing, or routine context.",
  };

  return [firstTask, secondTask, checkInTask]
    .filter(Boolean)
    .filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index)
    .slice(0, 3);
}

function buildConnectedTrackers(plan, careMap, reportInsights) {
  const planOutput = careMap.planOutput || {};
  if (isCautiousPlanFallback(planOutput.fallbackReason)) {
    return [
      {
        key: "symptoms",
        label: "Manual review note",
        unit: "",
        placeholder: "What looks unclear, missing, or worth asking the doctor",
        hint: "Keep one short note instead of trying to track everything.",
        priority: "primary",
        quickChoices: ["Unclear value", "Need doctor review", "No symptoms"],
      },
    ];
  }
  const has = (key) => careMap.focusKeys?.has(key);
  const baseFocus = careMap.primaryIssue ? normalizePlanFocusKey(careMap.primaryIssue.focusKey) : normalizePlanFocusKey(plan.focusKey).replace(/^goal:/, "");
  const historyCount = getFocusHistoryCount(reportInsights, baseFocus);
  const clusterSpec = getClusterContextSpec(baseFocus, {
    historyCount,
    hasMultipleSignals: careMap.hasMultipleSignals,
    markerBrief: careMap.primaryMarkerBrief,
  });
  if (clusterSpec?.trackers?.length) {
    return clusterSpec.trackers.slice(0, 3);
  }
  const connectedTrackers = [];
  if (has("diabetes")) {
    connectedTrackers.push({ key: "bloodSugar", label: "Blood sugar", unit: "mg/dL", placeholder: "110", hint: "Use the reading you already track, if available.", priority: "primary" });
  }
  if (has("ckd") || (has("diabetes") && has("lipid")) || planOutput.priorityIssues?.some((item) => /blood pressure|cardiovascular/i.test(item.condition || ""))) {
    connectedTrackers.push({ key: "bloodPressure", label: "Blood pressure", unit: "mmHg", placeholder: "122/80", hint: "Optional, but useful when sugar, cholesterol, kidney, or pressure findings overlap.", priority: "primary" });
  }
  if (has("anemia") || has("thyroid") || has("liver") || careMap.hasMultipleSignals) {
    connectedTrackers.push({
      key: "symptoms",
      label: "Follow-up note",
      unit: "",
      placeholder: "Energy, thirst, swelling, dizziness, meal, stress",
      hint: "One line is enough. Keep only what helps the next review.",
      priority: "primary",
      quickChoices: ["Energy", "Thirst", "Swelling", "No symptoms"],
    });
  }
  const merged = [...connectedTrackers, ...plan.trackers];
  const seen = new Set();
  return merged.filter((tracker) => {
    if (seen.has(tracker.key)) return false;
    seen.add(tracker.key);
    return true;
  }).slice(0, 3);
}

function severityRank(value = "") {
  return { CRITICAL: 3, MODERATE: 2, LOW: 1, NORMAL: 0 }[String(value || "").toUpperCase()] ?? 0;
}

function buildAdaptiveCareProtocol(plan, reportInsights, careMap) {
  const planOutput = careMap.planOutput || {};
  const safetyStatus = reportInsights?.safety?.status || "routine";
  const topIssue = careMap.primaryIssue || reportInsights?.healthIssues?.topIssue || null;
  const topSeverity = severityRank(topIssue?.severity);
  const needsDoctorFirst = safetyStatus === "emergency" || safetyStatus === "urgent_review" || topSeverity >= 3 || planOutput.doctorReviewRecommended;
  const hasMultipleSignals = Boolean(careMap.hasMultipleSignals);
  const focusLabel = plan.focusTitle || topIssue?.focusLabel || "this focus";
  const focusKey = careMap.primaryIssue ? normalizePlanFocusKey(careMap.primaryIssue.focusKey) : normalizePlanFocusKey(plan.focusKey).replace(/^goal:/, "");
  const historyCount = getFocusHistoryCount(reportInsights, focusKey);

  if (isCautiousPlanFallback(planOutput.fallbackReason)) {
    return {
      tone: "review",
      title: "Manual review first",
      patientPromise: "The app could not confidently read all report values, so it is holding back strong advice.",
      minimumDay: "Review the report manually or consult a doctor before acting on this plan.",
      standardDay: "Save one useful note and use the doctor-ready summary if you need help interpreting the report.",
      reviewTrigger: "Missing values, low OCR confidence, blurry uploads, or unclear ranges.",
      retestCue: "Upload a clearer report or confirm the values before expecting a stronger plan.",
      doctorBoundary: "Do not change medicines or start strong treatment from an uncertain extraction.",
    };
  }

  if (safetyStatus === "emergency") {
    return {
      tone: "urgent",
      title: "Doctor first, plan second",
      patientPromise: "This is not a routine-plan moment. The app keeps your report organized, but urgent care comes before habit tracking.",
      minimumDay: "Do not wait on the app if symptoms are severe. Seek urgent care now.",
      standardDay: "Carry the original report and the doctor-ready summary.",
      reviewTrigger: "Chest pain, breathing difficulty, fainting, severe weakness, confusion, very high sugar, yellowing, heavy bleeding, or worsening symptoms.",
      retestCue: "Repeat testing should follow clinician advice, not app timing.",
      doctorBoundary: "Do not start, stop, or change medication without a clinician.",
    };
  }

  if (needsDoctorFirst) {
    return {
      tone: "high",
      title: "Review-first plan",
      patientPromise: "This week is designed to prepare you for a safer doctor conversation, not to pretend routine advice alone solves a serious report.",
      minimumDay: "Copy the doctor summary and save one symptom or reading note.",
      standardDay: `Keep ${String(focusLabel).toLowerCase()} visible with one useful follow-up step plus one short note.`,
      reviewTrigger: "Book review sooner if symptoms worsen, values are very high/low, or you feel unsure about medicines.",
      retestCue: "Use the next report to check whether the main marker is moving in the right direction.",
      doctorBoundary: "Medicine decisions belong with a clinician. The app prepares the conversation.",
    };
  }

  if (hasMultipleSignals) {
    return {
      tone: "connected",
      title: "Connected week plan",
      patientPromise: "This plan prioritizes one main follow-up area while keeping the other findings visible.",
      minimumDay: "Do one useful follow-up step only: one note, one reading, or one light preparation step.",
      standardDay: "Keep the main follow-up area visible, then save one short note if it helps.",
      reviewTrigger: "Follow up if the strongest value worsens, symptoms appear, or the next report does not improve.",
      retestCue: historyCount > 1 ? "Earlier reports may help show whether this pattern is staying similar over time." : "More report history may help clarify whether this pattern stays stable.",
      doctorBoundary: "If medication may be needed, use the handoff summary instead of self-adjusting.",
    };
  }

  return {
    tone: "steady",
    title: "Small proof plan",
    patientPromise: "The goal is to keep the next follow-up easier, not to turn the week into a wellness program.",
    minimumDay: "Complete one useful follow-up step or save one short note.",
    standardDay: `Keep ${String(focusLabel).toLowerCase()} visible with one light action and one optional check-in.`,
    reviewTrigger: "Review again if symptoms appear, the trend worsens, or the plan feels impossible to follow.",
    retestCue: historyCount > 1 ? "Earlier reports may help keep the next review grounded in continuity." : "More report history may help clarify whether this pattern stays stable.",
    doctorBoundary: "For diagnosis, prescriptions, or unclear symptoms, bring the report to a clinician.",
  };
}

function buildContinuityNote({ weeklyCompleted, streakDays, completedToday, taskCount }) {
  if (weeklyCompleted >= 5 || streakDays >= 3) {
    return {
      label: "You’re building clearer follow-up context",
      detail: "You’re building clearer follow-up context over time.",
    };
  }
  if (completedToday > 0) {
    return {
      label: "Good start",
      detail: "One useful follow-up update is enough for today.",
    };
  }
  return {
    label: "Follow-up can stay light",
    detail: "Only one useful note or reading is needed to make this review more useful.",
  };
}

export function HealthPlanPanel({
  reportInsights,
  activeMemberId,
  apiBase,
  apiFetch,
  selectedPlanFocusKey,
  onPlanFocusChange,
  nextAppointment,
  followupDue,
  onBookFollowup,
  onOpenReports,
}) {
  const plan = useMemo(
    () => buildPersonalizedPlan(resolvePlan(reportInsights, selectedPlanFocusKey), reportInsights),
    [reportInsights, selectedPlanFocusKey],
  );
  const todayKey = getTodayKey();
  const [planSurfaceTab, setPlanSurfaceTab] = useState("today");
  const [progress, setProgress] = useState({});
  const [activity, setActivity] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saveStatus, setSaveStatus] = useState("");
  const [planStatus, setPlanStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedPlanMeta, setSavedPlanMeta] = useState(null);
  const reminderStorageKey = `health_plan_reminder_${plan.focusKey}_${activeMemberId || "self"}`;
  const [reminderPinned, setReminderPinned] = useState(false);
  const selectedFocusKey = normalizePlanFocusKey(selectedPlanFocusKey || plan.focusKey);

  const buildPlanPayload = () => ({
    memberId: activeMemberId || null,
    focusKey: plan.focusKey,
    title: plan.title,
    subtitle: plan.subtitle,
    goal: plan.goal,
    focusTitle: plan.focusTitle,
    focusSummary: plan.focusSummary,
    progress,
  });

  const chooseFocus = (focusKey, focusLabel = "") => {
    if (!focusKey) return;
    const storageKey = `health_plan_focus_${activeMemberId || "self"}`;
    localStorage.setItem(storageKey, focusKey);
    onPlanFocusChange?.(focusKey);
    setPlanStatus("");
    setSaveStatus(`Focus set to ${focusLabel || plan.focusTitle || "this week"}.`);
    setPlanSurfaceTab("today");
  };

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      setLoading(true);
      setPlanStatus("");
      try {
        const params = new URLSearchParams();
        params.set("focusKey", plan.focusKey);
        if (activeMemberId) params.set("memberId", String(activeMemberId));
        const response = await apiFetch(`${apiBase}/api/health-plan?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load health plan.");
        }
        if (cancelled) return;
        if (!selectedPlanFocusKey && data.plan?.focusKey && data.plan.focusKey !== selectedFocusKey) {
          const storageKey = `health_plan_focus_${activeMemberId || "self"}`;
          localStorage.setItem(storageKey, data.plan.focusKey);
          onPlanFocusChange?.(data.plan.focusKey);
        }
        setSavedPlanMeta(data.plan || null);
        setProgress(data.plan?.progress && typeof data.plan.progress === "object" ? data.plan.progress : {});
        setActivity(Array.isArray(data.activity) ? data.activity : []);
      } catch (error) {
        if (cancelled) return;
        setSavedPlanMeta(null);
        setProgress({});
        setActivity([]);
        setPlanStatus(error?.message || "Unable to load health plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPlan();
    setDrafts({});
    setSaveStatus("");
    setReminderPinned(localStorage.getItem(reminderStorageKey) === "1");
    return () => {
      cancelled = true;
    };
  }, [activeMemberId, apiBase, plan.focusKey, reminderStorageKey, onPlanFocusChange, selectedFocusKey, selectedPlanFocusKey]);

  const doctorOverride = savedPlanMeta?.doctorOverride && typeof savedPlanMeta.doctorOverride === "object" ? savedPlanMeta.doctorOverride : {};
  const effectiveTasks = Array.isArray(doctorOverride.tasks) && doctorOverride.tasks.length
    ? doctorOverride.tasks.map((task, index) => ({
        id: task.id || `doctor_task_${index + 1}`,
        label: task.label || `Task ${index + 1}`,
        note: task.note || "",
        origin: task.origin || "doctor",
        editedByDoctor: Boolean(task.editedByDoctor),
      }))
    : plan.tasks;
  const planSource = String(savedPlanMeta?.planSource || "ai");
  const doctorStatusLabel =
    planSource === "doctor_adjusted"
      ? "Doctor adjusted"
      : planSource === "doctor_reviewed"
        ? "Doctor reviewed"
        : "Prepared from your report";
  const doctorSupportNote = doctorOverride.reviewTimingNote || savedPlanMeta?.doctorNotes || "";
  const todayProgress = progress[todayKey] || {};
  const completedToday = effectiveTasks.filter((task) => Boolean(todayProgress[task.id])).length;
  const todayCompletion = effectiveTasks.length ? Math.round((completedToday / effectiveTasks.length) * 100) : 0;
  const hasReminderSchedule = reminderPinned;

  const weeklyCompleted = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    return Object.entries(progress).reduce((count, [day, taskMap]) => {
      const parsed = new Date(day);
      if (Number.isNaN(parsed.getTime()) || parsed < cutoff) return count;
      return count + Object.values(taskMap || {}).filter(Boolean).length;
    }, 0);
  }, [progress]);

  const streakDays = useMemo(() => {
    let cursor = new Date();
    let streak = 0;
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      const taskMap = progress[key] || {};
      if (!Object.values(taskMap).some(Boolean)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [progress]);

  const dayStatus = useMemo(() => {
    if (completedToday === 0 && streakDays > 0) {
      return {
        tone: "low",
        title: "Pick up the next follow-up step",
        body: "One short update can keep the follow-up easier to review.",
      };
    }
    if (completedToday === 0) {
      return {
        tone: "normal",
        title: "Start with one useful follow-up step",
        body: "A note, reading, or preparation step is enough for today.",
      };
    }
    if (completedToday < effectiveTasks.length) {
      return {
        tone: "normal",
        title: "You're in progress today",
        body: "Good start. One useful follow-up update is enough for today.",
      };
    }
    if (completedToday === effectiveTasks.length) {
      return {
        tone: "high",
        title: "Today is already saved",
        body: "Your follow-up context is already saved for the week.",
      };
    }
    return {
      tone: "normal",
      title: "Keep the follow-up moving",
      body: "One useful step can keep the week easier to review.",
    };
  }, [completedToday, streakDays, effectiveTasks.length]);

  const savePlanProgress = async (nextProgress, successMessage = "Today's plan updated.") => {
    setProgress(nextProgress);
    setSaveStatus(successMessage);
    try {
      const response = await apiFetch(`${apiBase}/api/health-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPlanPayload(),
          progress: nextProgress,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save health plan.");
      }
      setSavedPlanMeta(data.plan || null);
      setProgress(data.plan?.progress && typeof data.plan.progress === "object" ? data.plan.progress : nextProgress);
      setActivity(Array.isArray(data.activity) ? data.activity : activity);
    } catch (error) {
      setPlanStatus(error?.message || "Unable to save health plan.");
    }
  };

  const toggleTask = async (taskId) => {
    const nextProgress = {
      ...progress,
      [todayKey]: {
        ...(progress[todayKey] || {}),
        [taskId]: !(progress[todayKey] || {})[taskId],
      },
    };
    await savePlanProgress(nextProgress);
  };

  const updateDraft = (key, value) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const saveTracker = async (trackerKey) => {
    const rawValue = String(drafts[trackerKey] || "").trim();
    if (!rawValue) {
      setSaveStatus("Enter a value or note first.");
      return;
    }
    const tracker = plan.trackers.find((item) => item.key === trackerKey);
    const entry = {
      id: `${trackerKey}-${Date.now()}`,
      trackerKey,
      label: tracker?.label || trackerKey,
      value: rawValue,
      unit: tracker?.unit || "",
      loggedAt: new Date().toISOString(),
    };
    try {
      const response = await apiFetch(`${apiBase}/api/health-plan/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPlanPayload(),
          trackerKey,
          label: tracker?.label || trackerKey,
          value: rawValue,
          unit: tracker?.unit || "",
          loggedAt: entry.loggedAt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save tracker.");
      }
      setSavedPlanMeta(data.plan || null);
      setProgress(data.plan?.progress && typeof data.plan.progress === "object" ? data.plan.progress : progress);
      setActivity(Array.isArray(data.activity) ? data.activity : []);
      setDrafts((prev) => ({ ...prev, [trackerKey]: "" }));
      setSaveStatus(`${tracker?.label || "Note"} saved.`);
      setPlanStatus("");
    } catch (error) {
      setPlanStatus(error?.message || "Unable to save tracker.");
    }
  };

  const nextReview = nextAppointment?.scheduled_at || followupDue?.followup_date || "";
  const reviewUrgency = useMemo(() => getReviewUrgency(nextReview), [nextReview]);
  const planChoiceReason = useMemo(() => buildPlanChoiceReason(plan, reportInsights), [plan, reportInsights]);
  const continuityNote = useMemo(
    () => buildContinuityNote({ weeklyCompleted, streakDays, completedToday, taskCount: effectiveTasks.length }),
    [weeklyCompleted, streakDays, completedToday, effectiveTasks.length],
  );
  const nextCheckIn = useMemo(
    () => deriveNextCheckIn({ completedToday, taskCount: effectiveTasks.length }),
    [completedToday, effectiveTasks.length],
  );
  const coachingHeadline =
    completedToday === 0
      ? plan.connectedCare?.hasMultipleSignals
        ? "Start with one useful follow-up step"
        : `Start with one useful follow-up step`
      : completedToday === effectiveTasks.length
        ? "Today is already saved"
        : "Keep the plan light and easy to continue";
  const coachingBody =
    completedToday === 0
      ? plan.connectedCare?.hasMultipleSignals
        ? "You do not need to fix everything today. One useful note, reading, or preparation step is enough."
        : "You do not need to fix everything today. One useful note, reading, or preparation step is enough."
      : completedToday === effectiveTasks.length
        ? "Your follow-up context is already saved for the week. Add another note only if it helps your next review."
        : "Keep the plan practical enough to continue on a busy day. Finish the essentials and carry the follow-up forward.";
  const toggleReminderPinned = () => {
    const next = !reminderPinned;
    setReminderPinned(next);
    localStorage.setItem(reminderStorageKey, next ? "1" : "0");
    setSaveStatus(next ? `Reminder target saved for ${nextCheckIn.label} on this device.` : "Reminder target removed for this device.");
  };

  const primaryTrackers = plan.trackers.slice(0, 2);
  const secondaryTrackers = plan.trackers.slice(2);
  const savedTodayEntries = activity.filter((entry) => String(entry.loggedAt || "").slice(0, 10) === todayKey);
  const lastActivityByTracker = activity.reduce((map, entry) => {
    if (!map[entry.trackerKey]) map[entry.trackerKey] = entry;
    return map;
  }, {});
  const comparableTrends = (reportInsights?.trends || []).filter((trend) => Number.isFinite(Number(trend.latestValue)));
  const strongestTrend = comparableTrends.find((trend) => trend.zone === "high")
    || comparableTrends.find((trend) => trend.zone === "low")
    || comparableTrends[0]
    || null;
  const strongestTrendChange = strongestTrend ? evaluateTrendChange(strongestTrend) : null;
  const momentumSummary = weeklyCompleted >= 5 || streakDays >= 3
    ? "Recent follow-up activity is steady"
    : weeklyCompleted >= 2
      ? "Recent follow-up activity is taking shape"
      : "Recent follow-up activity is still light";
  const momentumDetail = weeklyCompleted >= 5 || streakDays >= 3
    ? `${weeklyCompleted} follow-up updates saved in the last 7 days with ${streakDays} day${streakDays === 1 ? "" : "s"} of saved follow-up context.`
    : weeklyCompleted >= 2
      ? `${weeklyCompleted} follow-up updates saved in the last 7 days.`
      : "Only a small amount of follow-up activity is saved so far, which is fine for an early week.";
  const planGlanceItems = [
    {
      key: "focus",
      icon: "◎",
      label: "Focus this week",
      value: plan.focusChooserTitle,
      detail: shorten(plan.focusChooserSubtitle, "Keep one main follow-up area visible this week."),
    },
    {
      key: "today",
      icon: "→",
      label: "Next step",
      value: effectiveTasks[0]?.label || "Save one useful follow-up step",
      detail: effectiveTasks[0]?.note || "Keep the next step light enough to finish today.",
    },
    {
      key: "notes",
      icon: "✎",
      label: "Saved context",
      value: `${savedTodayEntries.length} saved today`,
      detail: savedTodayEntries.length ? "You already have useful context ready for the next visit." : "A short note is enough if it helps your next review.",
    },
  ];

  const applyQuickChoice = (trackerKey, choice) => {
    setDrafts((prev) => {
      const existing = String(prev[trackerKey] || "").trim();
      if (!existing) return { ...prev, [trackerKey]: choice };
      if (existing.toLowerCase().includes(choice.toLowerCase())) return prev;
      return { ...prev, [trackerKey]: `${existing}, ${choice}` };
    });
  };

  return (
    <section className="panel">
      <div className="health-plan-hero">
        <div>
          <div className="surface-brand-row">
            <span className="surface-brand-copy">
              <p className="eyebrow">Action plan</p>
              <p className="surface-brand-kicker">Built from your report, with follow-up kept practical.</p>
            </span>
          </div>
          <h2>{plan.title}</h2>
          <p className="panel-sub">{plan.subtitle}</p>
          <p className="micro">{doctorStatusLabel}{savedPlanMeta?.doctorUpdatedAt ? ` • ${new Date(savedPlanMeta.doctorUpdatedAt).toLocaleString()}` : ""}</p>
          {doctorSupportNote ? <p className="micro">{doctorSupportNote}</p> : null}
        </div>
        <div className="health-plan-kpis">
          <article className="health-plan-kpi">
            <span className="mini-label">Today</span>
            <strong>{todayCompletion}%</strong>
            <span className="micro">{completedToday} of {effectiveTasks.length} follow-up updates saved</span>
          </article>
          <article className="health-plan-kpi">
            <span className="mini-label">Recent activity</span>
            <strong>{weeklyCompleted}</strong>
            <span className="micro">Follow-up updates saved in the last 7 days</span>
          </article>
          <article className="health-plan-kpi">
            <span className="mini-label">Continuity</span>
            <strong>{streakDays} day{streakDays === 1 ? "" : "s"}</strong>
            <span className="micro">Days with at least one follow-up update saved</span>
          </article>
        </div>
      </div>
      <div className={`health-plan-focus-studio is-${plan.focusMode || "auto"}`}>
        <div className="health-plan-focus-copy">
          <p className="mini-label">Focus this week</p>
          <strong>{plan.focusChooserTitle}</strong>
          <p className="micro">{plan.focusChooserSubtitle}</p>
        </div>
        <div className="health-plan-focus-pills">
          {(plan.focusOptions || []).map((item) => {
            const active = normalizePlanFocusKey(item.key) === selectedFocusKey;
            return (
              <button
                key={item.key}
                type="button"
                className={`health-plan-focus-chip ${active ? "is-active" : ""} ${item.kind === "goal" ? "is-goal" : "is-condition"}`}
                onClick={() => chooseFocus(item.key, item.label)}
              >
                <span className="health-plan-focus-chip-icon" aria-hidden="true">{iconForFocusOption(item)}</span>
                <span className="health-plan-focus-chip-copy">
                  <strong>{item.label}</strong>
                  {item.issueCount > 1 ? <small>{item.issueCount} highlighted markers</small> : active ? <small>Chosen</small> : <small>{item.kind === "goal" ? "Goal" : "Focus area"}</small>}
                </span>
              </button>
            );
          })}
        </div>
        {plan.secondaryFocusOptions?.length ? (
          <div className="health-plan-focus-secondary">
            <span className="mini-label">Or keep it calmer</span>
            <div className="health-plan-focus-pills is-secondary">
              {plan.secondaryFocusOptions.slice(0, 3).map((item) => {
                const active = normalizePlanFocusKey(item.key) === selectedFocusKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`health-plan-focus-chip is-secondary ${active ? "is-active" : ""} ${item.kind === "goal" ? "is-goal" : "is-condition"}`}
                    onClick={() => chooseFocus(item.key, item.label)}
                  >
                    <span className="health-plan-focus-chip-icon" aria-hidden="true">{iconForFocusOption(item)}</span>
                    <span className="health-plan-focus-chip-copy">
                      <strong>{item.label}</strong>
                      <small>{active ? "Chosen" : item.kind === "goal" ? "Goal" : "Focus area"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      {plan.connectedCare ? (
        <details className={`health-plan-intelligence ${plan.connectedCare.hasMultipleSignals ? "is-connected" : ""}`}>
          <summary>
            <span>Why this plan was prepared</span>
            <small>{plan.connectedCare.clusterLabel}</small>
          </summary>
          <div className="health-plan-intelligence-lead">
            <p className="micro">{plan.connectedCare.valueLine}</p>
            {plan.connectedCare.issueCount > 1 ? (
              <p className="health-plan-flag-line">
                <strong>{plan.connectedCare.issueCount} highlighted markers</strong>
                <span>{plan.connectedCare.markerBrief}</span>
              </p>
            ) : null}
          </div>
          <div className="health-plan-intelligence-grid">
            {(plan.connectedCare.guardrails || []).slice(0, 2).map((item) => (
              <article key={`${item.key}-${item.label}`}>
                <span className="mini-label">{item.label}</span>
                <p className="micro">{item.detail}</p>
              </article>
            ))}
            <article>
              <span className="mini-label">Plan approach</span>
              <p className="micro">{plan.connectedCare.planPromise}</p>
            </article>
          </div>
        </details>
      ) : null}
      <div className="plan-surface-switch" role="tablist" aria-label="Plan sections">
        <button type="button" className={planSurfaceTab === "today" ? "active" : ""} onClick={() => setPlanSurfaceTab("today")}>
          Today
        </button>
        <button type="button" className={planSurfaceTab === "track" ? "active" : ""} onClick={() => setPlanSurfaceTab("track")}>
          Follow-up notes
        </button>
        <button type="button" className={planSurfaceTab === "review" ? "active" : ""} onClick={() => setPlanSurfaceTab("review")}>
          Review prep
        </button>
      </div>

      {planSurfaceTab === "today" ? (
      <>
      <div className="surface-story-strip surface-story-strip-plan">
        {planGlanceItems.map((item) => (
          <article key={item.key} className="surface-story-pill">
            <div className="surface-story-pill-head">
              <span className="surface-story-icon" aria-hidden="true">{item.icon}</span>
              <span className="surface-story-label">{item.label}</span>
            </div>
            <strong>{item.value}</strong>
            <p className="micro">{item.detail}</p>
          </article>
        ))}
      </div>
      <article className={`health-plan-card health-plan-coach-card tone-${dayStatus.tone}`}>
        <div className="section-head compact health-plan-coach-head">
          <div>
            <p className="health-plan-coach-label">Today’s note</p>
            <h3 className="health-plan-coach-title">{coachingHeadline}</h3>
          </div>
        </div>
        <p className="micro health-plan-coach-kicker">{coachingBody}</p>
      </article>

      <div className="health-plan-grid">
        <article className="health-plan-card">
          <div className="section-head compact">
            <div>
              <p className="micro strong">Today’s step</p>
              <p className="micro">{plan.actionPlan?.followUpGuidance?.[2] || "Keep it light enough to finish, even on a busy day."}</p>
            </div>
          </div>
          <div className="health-plan-task-list">
            {effectiveTasks.map((task) => {
              const done = Boolean(todayProgress[task.id]);
              return (
                <button
                  key={task.id}
                  type="button"
                  className={`health-plan-task-row ${done ? "is-complete" : ""}`}
                  onClick={() => toggleTask(task.id)}
                >
                  <span className="health-plan-check" aria-hidden="true">{done ? "✓" : ""}</span>
                  <span>
                    <span className="health-plan-task-meta-row">
                      <span className={`health-plan-task-chip ${done ? "is-complete" : ""}`}>
                        {done ? "✓ Saved" : `${iconForTaskLabel(task.actionLabel || task.label)} ${task.actionLabel || (effectiveTasks.indexOf(task) === 0 ? "Prepare" : effectiveTasks.indexOf(task) === 1 ? "Keep handy" : "Track if useful")}`}
                      </span>
                    </span>
                    <span className="history-headline">{task.label}</span>
                    <span className="micro">{task.note}</span>
                    {task.editedByDoctor ? <span className="micro">Doctor adjusted</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {saveStatus ? <p className="micro">{saveStatus}</p> : null}
          {planStatus ? <p className="micro">{planStatus}</p> : null}
        </article>
      </div>
      </>
      ) : null}

      {planSurfaceTab === "track" ? (
      <div className="health-plan-grid">
        <article className="health-plan-card">
          <div className="section-head compact">
            <div>
              <p className="micro strong">Useful update</p>
              <p className="micro">{plan.actionPlan?.notesPrompt || plan.trackingPurpose}</p>
            </div>
          </div>
          <div className="health-plan-track-summary">
            <div className="health-plan-track-summary-pill">
              <span className="mini-label">Saved today</span>
              <strong>{savedTodayEntries.length} update{savedTodayEntries.length === 1 ? "" : "s"}</strong>
              <span className="micro">{savedTodayEntries.length ? "You already have useful context saved for today." : "Save a note only if it helps your next review."}</span>
            </div>
          </div>
          <div className="health-plan-tracker-grid">
            {primaryTrackers.map((tracker) => (
              <div key={tracker.key} className="health-plan-tracker">
                <div className="health-plan-tracker-meta-row">
                  <span className="health-plan-tracker-chip">{normalizeUnit(tracker.unit) || "Note"}</span>
                </div>
                <label>
                  {tracker.label}{tracker.unit ? ` (${normalizeUnit(tracker.unit)})` : ""}
                  {tracker.key === "symptoms" ? (
                    <textarea
                      rows={2}
                      value={drafts[tracker.key] || ""}
                      onChange={(event) => updateDraft(tracker.key, event.target.value)}
                      placeholder={tracker.placeholder}
                    />
                  ) : (
                    <input
                      type="text"
                      value={drafts[tracker.key] || ""}
                      onChange={(event) => updateDraft(tracker.key, event.target.value)}
                      placeholder={tracker.placeholder}
                    />
                  )}
                </label>
                {tracker.quickChoices?.length ? (
                  <div className="health-plan-quick-choice-row">
                    {tracker.quickChoices.map((choice) => (
                      <button key={choice} type="button" className="health-plan-quick-choice" onClick={() => applyQuickChoice(tracker.key, choice)}>
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="micro">{tracker.hint || "Keep this short and useful."}</p>
                {lastActivityByTracker[tracker.key] ? (
                  <p className="micro">Last update {formatLoggedAt(lastActivityByTracker[tracker.key].loggedAt)}</p>
                ) : null}
                <button type="button" className="ghost" onClick={() => saveTracker(tracker.key)}>
                  Save for next visit
                </button>
              </div>
            ))}
          </div>
          {secondaryTrackers.length ? (
            <details className="health-plan-optional-trackers">
              <summary>Optional notes</summary>
              <div className="health-plan-tracker-grid health-plan-tracker-grid-optional">
                {secondaryTrackers.map((tracker) => (
                  <div key={tracker.key} className="health-plan-tracker">
                    <div className="health-plan-tracker-meta-row">
                      <span className="health-plan-tracker-chip">{normalizeUnit(tracker.unit) || "Note"}</span>
                    </div>
                    <label>
                      {tracker.label}{tracker.unit ? ` (${normalizeUnit(tracker.unit)})` : ""}
                      {tracker.key === "symptoms" ? (
                        <textarea
                          rows={2}
                          value={drafts[tracker.key] || ""}
                          onChange={(event) => updateDraft(tracker.key, event.target.value)}
                          placeholder={tracker.placeholder}
                        />
                      ) : (
                        <input
                          type="text"
                          value={drafts[tracker.key] || ""}
                          onChange={(event) => updateDraft(tracker.key, event.target.value)}
                          placeholder={tracker.placeholder}
                        />
                      )}
                    </label>
                    {tracker.quickChoices?.length ? (
                      <div className="health-plan-quick-choice-row">
                        {tracker.quickChoices.map((choice) => (
                          <button key={choice} type="button" className="health-plan-quick-choice" onClick={() => applyQuickChoice(tracker.key, choice)}>
                            {choice}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <p className="micro">{tracker.hint || "Optional support note."}</p>
                    <button type="button" className="ghost" onClick={() => saveTracker(tracker.key)}>
                      Save for next visit
                    </button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {loading ? <p className="micro">Loading saved plan activity...</p> : null}
        </article>

        <article className="health-plan-card">
          <div className="section-head compact">
            <div>
              <p className="micro strong">Recent follow-up notes</p>
              <p className="micro">A quiet record of the updates you may want to keep visible during follow-up.</p>
            </div>
          </div>
          <div className="history-list compact-list">
            {activity.length ? (
              activity.slice(0, 4).map((entry) => (
                <div key={entry.id} className="history-card">
                  <p className="mini-label">{entry.label || "Follow-up note"}</p>
                  {entry.unit ? (
                    <p className="history-headline">{formatTrackerValueWithUnit(entry.value, entry.unit)}</p>
                  ) : (
                    <p className="history-headline">“{String(entry.value || "").trim()}”</p>
                  )}
                  <p className="micro">{formatActivityDateTime(entry.loggedAt)}</p>
                </div>
              ))
            ) : (
              <p className="micro">Nothing is missing here yet. Add a note only when it helps your next review.</p>
            )}
          </div>
        </article>
      </div>
      ) : null}

      {planSurfaceTab === "review" ? (
      <div className="health-plan-grid">
        <article className="health-plan-card">
          <div className="section-head compact">
            <div>
              <p className="micro strong">Review verdict</p>
              <p className="micro">{plan.actionPlan?.doctorPrep?.[0] || "A quick read on whether things look better, similar, or worth following up."}</p>
            </div>
          </div>
          <div className="health-plan-review-grid">
            <div className="history-card">
              <p className="history-headline">What changed</p>
              <p className="member-metric">{strongestTrendChange?.label || "Not enough data yet"}</p>
              <p className="micro">{strongestTrendChange?.detail || "Upload another structured report to compare trends over time."}</p>
            </div>
            <div className="history-card">
              <p className="history-headline">Review timing</p>
              <p className="member-metric">{reviewUrgency.label}</p>
              <p className="micro">{reviewUrgency.detail}</p>
            </div>
            {hasReminderSchedule ? (
              <div className="history-card">
                <p className="history-headline">Next reminder</p>
                <p className="member-metric">{nextCheckIn.label}</p>
                <p className="micro">{nextCheckIn.detail}</p>
              </div>
            ) : null}
          </div>
          <div className="action-row">
            <button type="button" className="secondary" onClick={onOpenReports}>
              Review reports
            </button>
            <button type="button" className={reminderPinned ? "ghost" : "secondary"} onClick={toggleReminderPinned}>
              {reminderPinned ? "Reminder pinned" : "Pin reminder time"}
            </button>
          </div>
        </article>
      </div>
      ) : null}
    </section>
  );
}
