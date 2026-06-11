const SUPPORTED_LANGUAGES = new Set(["en", "gu"]);

const METRIC_LABELS_GU = {
  hba1c: "HbA1c",
  estimated_average_glucose: "અંદાજિત સરેરાશ ગ્લુકોઝ",
  crp_quantitative: "CRP",
  serum_ige: "સીરમ IgE",
  fbs: "ફાસ્ટિંગ બ્લડ શુગર",
  ppbs: "જમ્યા પછીનું બ્લડ શુગર",
  rbs: "રેન્ડમ બ્લડ શુગર",
  hemoglobin: "હીમોગ્લોબિન",
  rbc_count: "RBC ગણતરી",
  pcv: "PCV",
  mcv: "MCV",
  mch: "MCH",
  mchc: "MCHC",
  rdw: "RDW",
  wbc: "WBC",
  esr: "ESR",
  platelets: "પ્લેટલેટ્સ",
  weight: "વજન",
  bmi: "BMI",
  total_cholesterol: "કુલ કોલેસ્ટેરોલ",
  ldl: "LDL",
  hdl: "HDL",
  triglycerides: "ટ્રાઇગ્લિસરાઇડ્સ",
  tsh: "TSH",
  t3: "T3",
  t4: "T4",
  creatinine: "ક્રિએટિનિન",
  urea: "યુરિયા",
  uric_acid: "યુરિક એસિડ",
  bilirubin_total: "કુલ બિલિરૂબિન",
  sgpt_alt: "SGPT / ALT",
  sgot_ast: "SGOT / AST",
  urine_protein: "યુરિન પ્રોટીન",
  urine_glucose: "યુરિન ગ્લુકોઝ",
  urine_ketones: "યુરિન કીટોન્સ",
  urine_bilirubin: "યુરિન બિલિરૂબિન",
  urine_blood: "યુરિન બ્લડ",
  urine_urobilinogen: "યુરિન યુરોબિલિનોજન",
};

const FOCUS_LABELS_GU = {
  diabetes: "બ્લડ શુગર",
  sugar: "બ્લડ શુગર",
  allergy: "એલર્જી",
  cbc: "લોહીના કોષો",
  anemia: "લોહીના કોષો",
  thyroid: "થાઇરોઇડ",
  ckd: "કિડની",
  kidney: "કિડની",
  liver: "લિવર",
  lipid: "કોલેસ્ટેરોલ",
  obesity: "વજન",
  inflammation: "સોજો / ઇન્ફ્લેમેશન",
  general: "આરોગ્ય",
};

const CONDITION_LABELS_GU = {
  diabetes: "બ્લડ શુગર",
  allergy: "એલર્જી",
  anemia: "લોહીના કોષો",
  cbc: "લોહીના કોષો",
  kidney: "કિડની",
  ckd: "કિડની",
  liver: "લિવર",
  thyroid: "થાઇરોઇડ",
  lipid: "કોલેસ્ટેરોલ",
  obesity: "વજન",
  inflammation: "સોજો / ઇન્ફ્લેમેશન",
  general: "સામાન્ય આરોગ્ય",
};

const STATUS_GU = {
  HIGH: "ઉંચું",
  LOW: "ઓછું",
  NORMAL: "સામાન્ય",
  MODERATE: "મધ્યમ",
  CRITICAL: "ખાસ સમીક્ષા જરૂરી",
  UNKNOWN: "વધુ માહિતી જરૂરી",
};

const CONFIDENCE_GU = {
  high: "ઉચ્ચ વિશ્વસનીયતા",
  moderate: "મધ્યમ વિશ્વસનીયતા",
  low: "ઓછી વિશ્વસનીયતા",
};

const ATTENTION_GU = {
  needs_prompt_medical_review: "વહેલી તકે ડૉક્ટર સાથે ચર્ચા કરો",
  worth_timely_follow_up: "સમયસર ફોલોઅપ યોગ્ય",
  discuss_in_next_appointment: "આગામી મુલાકાતમાં ચર્ચા કરો",
  lifestyle_focused: "જીવનશૈલીના સંદર્ભમાં જુઓ",
  monitor_over_time: "સમય સાથે ધ્યાનમાં રાખો",
  usually_non_urgent: "સામાન્ય રીતે તાત્કાલિક નથી",
};

const TIMEFRAME_GU = {
  same_day: "આજે",
  within_a_few_days: "થોડા દિવસમાં",
  within_1_2_weeks: "1-2 અઠવાડિયામાં",
  next_routine_appointment: "આગામી નિયમિત મુલાકાતમાં",
  future_reports: "આગામી રિપોર્ટ સાથે સરખાવો",
};

const HEALTH_CONTEXT_GU = {
  "type 2 diabetes": "ટાઇપ 2 ડાયાબિટીસ",
  diabetes: "ડાયાબિટીસ",
  prediabetes: "પ્રીડાયાબિટીસ",
  hypertension: "હાઇ બ્લડ પ્રેશર",
  "high blood pressure": "હાઇ બ્લડ પ્રેશર",
  hypothyroidism: "હાઇપોથાઇરોઇડિઝમ",
  asthma: "અસ્થમા",
  obesity: "વજન સંબંધિત જોખમ",
  "hidradenitis suppurativa (hs)": "હાઇડ્રાડેનાઇટિસ સપ્યુરેટિવા (HS)",
  "hidradenitis suppurativa": "હાઇડ્રાડેનાઇટિસ સપ્યુરેટિવા",
};

function normalizeLanguage(lang) {
  return SUPPORTED_LANGUAGES.has(String(lang || "").toLowerCase()) ? String(lang).toLowerCase() : "en";
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function metricLabel(key, fallback = "") {
  return METRIC_LABELS_GU[key] || fallback || key || "આ પરિણામ";
}

function focusLabel(key, fallback = "") {
  return FOCUS_LABELS_GU[key] || fallback || "આરોગ્ય";
}

function conditionLabel(key, fallback = "") {
  return CONDITION_LABELS_GU[key] || fallback || "આરોગ્ય";
}

function valueWithUnit(value, unit = "") {
  if (value === null || value === undefined || value === "") return "માહિતી ઉપલબ્ધ નથી";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function healthContextLabel(value = "") {
  return HEALTH_CONTEXT_GU[String(value).trim().toLowerCase()] || value;
}

function rangeText(item = {}) {
  if (item.range && item.range !== "Not available") return item.range;
  const values = [item.low, item.high].filter((value) => value !== null && value !== undefined && value !== "");
  return values.length ? values.join("-") : "માહિતી ઉપલબ્ધ નથી";
}

function metricSummary(item = {}) {
  const label = metricLabel(item.metricKey || item.key, item.metricLabel || item.parameter);
  const value = valueWithUnit(item.latestValue ?? item.value, item.unit);
  if (item.zone === "normal" || item.status === "NORMAL") return `${label} ${value} છે અને રેન્જમાં છે.`;
  if (item.zone === "high" || item.status === "HIGH") return `${label} ${value} છે, જે સરખામણીની રેન્જથી ઊંચું છે.`;
  if (item.zone === "low" || item.status === "LOW") return `${label} ${value} છે, જે સરખામણીની રેન્જથી ઓછું છે.`;
  return `${label} ${value} છે. વધુ સંદર્ભ સાથે તેની સમીક્ષા કરો.`;
}

function trendCopy(item = {}) {
  const label = metricLabel(item.metricKey || item.key, item.metricLabel || item.parameter);
  const previous = Number(item.previousValue);
  const latest = Number(item.latestValue ?? item.value);
  if (!Number.isFinite(previous) || !Number.isFinite(latest)) {
    return {
      label: "પ્રથમ સાચવેલું પરિણામ",
      detail: `${label} હવે આગામી રિપોર્ટ સાથે સરખાવવા માટે બેઝલાઇન તરીકે સાચવાયું છે.`,
      trendLabel: "હજુ પૂરતો ડેટા નથી",
      trendSummary: "ટ્રેન્ડ સમજવા માટે વધુ રિપોર્ટ જરૂરી છે.",
    };
  }
  if (latest === previous) {
    return {
      label: "કોઈ મોટો ફેરફાર નથી",
      detail: `${label} અગાઉના રિપોર્ટ જેટલું જ છે.`,
      trendLabel: "સ્થિર",
      trendSummary: "આ પરિણામમાં મોટો ફેરફાર દેખાતો નથી.",
    };
  }
  const improved = (item.zone === "high" && latest < previous) || (item.zone === "low" && latest > previous);
  return {
    label: improved ? "સુધારો દેખાય છે" : "ફેરફાર ધ્યાનમાં રાખો",
    detail: `${label} ${previous} થી ${latest}${item.unit ? ` ${item.unit}` : ""} થયું છે.`,
    trendLabel: improved ? "સુધારો" : "ફેરફાર",
    trendSummary: improved
      ? "પરિણામ સરખામણીની રેન્જ તરફ આગળ વધતું દેખાય છે."
      : "આ ફેરફાર આગળના રિપોર્ટ સાથે ફરી સરખાવવો યોગ્ય રહેશે.",
  };
}

function doctorQuestionsFor(item = {}) {
  const key = item.metricKey || item.key || "";
  const label = metricLabel(key, item.metricLabel || item.parameter);
  const focus = item.focusKey || item.conditionArea || "general";
  const contextual = {
    diabetes: "શું આ શુગર સંબંધિત પરિણામ મારી હાલની સ્થિતિ અથવા દૈનિક રૂટિન સાથે મેળ ખાય છે?",
    sugar: "શું આ શુગર સંબંધિત પરિણામ મારી હાલની સ્થિતિ અથવા દૈનિક રૂટિન સાથે મેળ ખાય છે?",
    allergy: "શું એલર્જીના લક્ષણો સાથે આ પરિણામની વધુ સમીક્ષા જરૂરી છે?",
    cbc: "શું આ લોહીના કોષોના પરિણામ માટે આયર્ન, B12 અથવા ફરી CBC તપાસવાની જરૂર છે?",
    anemia: "શું આ લોહીના કોષોના પરિણામ માટે આયર્ન, B12 અથવા ફરી CBC તપાસવાની જરૂર છે?",
    ckd: "શું આ કિડની સંબંધિત પરિણામ ફરી તપાસવું જોઈએ?",
    kidney: "શું આ કિડની સંબંધિત પરિણામ ફરી તપાસવું જોઈએ?",
    thyroid: "શું આ થાઇરોઇડ પરિણામ મારી હાલની દવા અથવા લક્ષણોના સંદર્ભમાં જોવું જોઈએ?",
    liver: "શું આ લિવર પરિણામ ફરી તપાસવું અથવા અન્ય લક્ષણો સાથે જોવું જોઈએ?",
    lipid: "મારા કોલેસ્ટેરોલ માટે યોગ્ય આગામી લક્ષ્ય શું હોવું જોઈએ?",
    obesity: "મારા વજન અને મેટાબોલિક જોખમને સાથે કેવી રીતે સમજવું?",
  };
  return [
    `${label} ને મારા આરોગ્યના સંદર્ભમાં કેવી રીતે સમજવું?`,
    "શું આ પરિણામ માટે ફરી ટેસ્ટ, લક્ષણો અથવા અગાઉના રિપોર્ટ સાથે સરખામણી જરૂરી છે?",
    contextual[focus] || "આ પરિણામ અંગે આગામી મુલાકાતમાં સૌથી મહત્વનો પ્રશ્ન કયો પૂછવો?",
  ];
}

function localizeIssue(issue = {}) {
  const result = { ...issue };
  result.parameter = metricLabel(issue.key, issue.parameter);
  result.focusLabel = focusLabel(issue.focusKey, issue.focusLabel);
  result.summary = metricSummary(issue);
  result.doctorQuestions = doctorQuestionsFor(issue);
  result.changeOverTime = {
    ...(issue.changeOverTime || {}),
    ...trendCopy(issue),
  };
  return result;
}

function localizePriority(priority = {}) {
  const finding = priority.includedFindings?.[0] || {};
  const key = finding.key || priority.metricKeys?.[0] || "";
  const title = metricLabel(key, priority.title);
  return {
    ...priority,
    title,
    findingLabel: title,
    conditionLabel: conditionLabel(priority.conditionArea, priority.conditionLabel),
    includedFindings: (priority.includedFindings || []).map((item) => ({
      ...item,
      label: metricLabel(item.key, item.label),
    })),
    attentionLabel: ATTENTION_GU[priority.attentionLevel] || "ચર્ચા કરવા યોગ્ય",
    confidenceLabel: CONFIDENCE_GU[priority.confidenceLevel] || "મધ્યમ વિશ્વસનીયતા",
    suggestedTimeframeLabel: TIMEFRAME_GU[priority.suggestedTimeframe] || "આગામી મુલાકાતમાં",
    whyHighlighted: [
      `${title} સરખામણીની રેન્જ ${finding.originalRange || rangeText(finding)} ની બહાર છે.`,
    ],
    summary: "આ પરિણામને તમારા ડૉક્ટર સાથે ચર્ચા કરવાથી આગળનું પગલું સ્પષ્ટ થઈ શકે છે.",
    doctorQuestions: doctorQuestionsFor({
      key,
      metricKey: key,
      metricLabel: title,
      focusKey: priority.conditionArea,
    }),
  };
}

function localizeConditionSummary(summary = {}) {
  const labels = {
    diabetes: "બ્લડ શુગર પર ધ્યાન",
    allergy: "એલર્જી / ઇમ્યુન પ્રવૃત્તિ",
    anemia: "લોહીના કોષો પર ધ્યાન",
    cbc: "લોહીના કોષો પર ધ્યાન",
    ckd: "કિડની પર ધ્યાન",
    kidney: "કિડની પર ધ્યાન",
    liver: "લિવર પર ધ્યાન",
    thyroid: "થાઇરોઇડ પર ધ્યાન",
    lipid: "કોલેસ્ટેરોલ પર ધ્યાન",
    obesity: "વજન અને મેટાબોલિક આરોગ્ય",
  };
  const title = labels[summary.key] || conditionLabel(summary.key, summary.title);
  const state = summary.zone === "normal"
    ? "હાલના રિપોર્ટમાં આ વિસ્તાર સ્થિર દેખાય છે."
    : "આ વિસ્તારને આગળની મુલાકાતમાં ધ્યાનમાં રાખવો યોગ્ય છે.";
  return { ...summary, title, summary: state };
}

function localizePersonalizedFollowUp(followUp = {}, topIssue = null) {
  if (!followUp || typeof followUp !== "object") return followUp;
  const issue = topIssue || {};
  const key = issue.key || "";
  const label = metricLabel(key, followUp.priorityArea?.findingLabel || issue.parameter);
  const focus = issue.focusKey || issue.conditionArea || "general";
  const stableAreas = (followUp.stableAreas || []).map((item) => {
    if (/kidney/i.test(item)) return "કિડની કાર્ય સ્થિર";
    if (/liver/i.test(item)) return "લિવર કાર્ય સ્થિર";
    if (/thyroid/i.test(item)) return "થાઇરોઇડ રેન્જમાં";
    if (/blood-count|blood count/i.test(item)) return "મોટાભાગના બ્લડ કાઉન્ટ સ્થિર";
    return item;
  });
  const focusText = {
    diabetes: "બ્લડ શુગરમાં નિયમિતતા સુધારવા પર પહેલાં ધ્યાન આપો.",
    allergy: "લક્ષણો અને એલર્જી સંબંધિત ફેરફારો નોંધવા પર ધ્યાન આપો.",
    cbc: "લોહીના કોષોના પરિણામને અગાઉના રિપોર્ટ અને લક્ષણો સાથે સરખાવો.",
    anemia: "લોહીના કોષોના પરિણામને અગાઉના રિપોર્ટ અને લક્ષણો સાથે સરખાવો.",
    kidney: "કિડની સંબંધિત પરિણામને આગામી રિપોર્ટ સાથે સરખાવો.",
    ckd: "કિડની સંબંધિત પરિણામને આગામી રિપોર્ટ સાથે સરખાવો.",
  };
  return {
    ...followUp,
    priorityArea: followUp.priorityArea
      ? {
          ...followUp.priorityArea,
          title: `${focusLabel(focus, label)} સંબંધિત ફોલોઅપ`,
          findingLabel: label,
          personalFactors: (followUp.priorityArea.personalFactors || []).map(healthContextLabel),
          whatThisMeans: metricSummary(issue),
          whyThisMatters: [
            "આ પરિણામને તમારા હાલના આરોગ્ય ઇતિહાસ અને લક્ષણો સાથે જોવાથી વધુ સ્પષ્ટતા મળી શકે છે.",
          ],
          urgencyNote: "આ ઇમરજન્સી દર્શાવતું નથી, પરંતુ ગોઠવેલ ફોલોઅપ યોગ્ય છે.",
        }
      : null,
    secondaryAreas: (followUp.secondaryAreas || []).map((area) => ({
      ...area,
      title: conditionLabel(area.conditionArea || area.key, area.title),
      summary: "આ વિસ્તારને મુખ્ય પરિણામ પછી ધ્યાનમાં રાખો.",
    })),
    stableAreas,
    oneClearFocus: focusText[focus] || "એક મુખ્ય પરિણામથી શરૂઆત કરો અને આગળના રિપોર્ટ સાથે સરખાવો.",
    actionCheckInOptions: [
      "આજે લક્ષણો વધારે લાગ્યા",
      "આજે થાક વધારે લાગ્યો",
      "દૈનિક રૂટિનમાં ફેરફાર હતો",
      "આજે સામાન્ય લાગ્યું",
      "કોઈ મોટું લક્ષણ નથી",
    ],
    followUpPlan: {
      today: ["એક ઉપયોગી વાંચન અથવા લક્ષણ નોંધો."],
      thisWeek: ["એક જ સંબંધિત પેટર્ન ધ્યાનમાં રાખો.", "જરૂર હોય તો અગાઉનો રિપોર્ટ તૈયાર રાખો."],
      beforeNextReview: ["આ રિપોર્ટ અને સાચવેલા પ્રશ્નો સાથે રાખો.", "એક ઉપયોગી વાંચન અથવા લક્ષણ નોંધ તૈયાર રાખો."],
    },
    doctorQuestions: doctorQuestionsFor(issue),
    doctorHandoff: {
      ...(followUp.doctorHandoff || {}),
      mainAreas: (followUp.doctorHandoff?.mainAreas || []).map((item) => {
        const [prefix, ...rest] = String(item).split(":");
        const localizedPrefix = healthContextLabel(prefix);
        return rest.length ? `${localizedPrefix}: ${rest.join(":").trim()}` : localizedPrefix;
      }),
      suggestedFocus: "રિપોર્ટના મુખ્ય ફેરફાર અને સમય સાથેની સતત સરખામણી પર ચર્ચા.",
    },
  };
}

function localizeCarePlan(carePlan = {}) {
  return {
    ...carePlan,
    overallStatus: carePlan.doctorReviewRecommended ? "ડૉક્ટર સાથે ચર્ચા યોગ્ય" : "ધ્યાનમાં રાખવું",
    priorityIssues: (carePlan.priorityIssues || []).map((item) => ({
      ...item,
      condition: conditionLabel(item.conditionKey, item.condition),
      reason: `${conditionLabel(item.conditionKey, item.condition)} સંબંધિત પરિણામ સરખામણીની રેન્જની બહાર છે.`,
      metrics: (item.metrics || []).map((metric) => {
        const key = Object.keys(METRIC_LABELS_GU).find((candidate) => METRIC_LABELS_GU[candidate] === metric);
        return key ? METRIC_LABELS_GU[key] : metric;
      }),
    })),
    dailyPlan: (carePlan.dailyPlan || []).map((section) => ({
      ...section,
      category: {
        Diet: "ખોરાક",
        Exercise: "ચાલવું / કસરત",
        Monitoring: "નોંધ રાખવી",
        "Doctor Review": "ડૉક્ટર સાથે ચર્ચા",
      }[section.category] || section.category,
      actions: section.category === "Doctor Review"
        ? ["આ પરિણામ તમારા ડૉક્ટર સાથે ચર્ચા કરો. દવા અથવા સારવારમાં પોતે ફેરફાર ન કરો."]
        : ["આ અઠવાડિયે એક નાનું, વાસ્તવિક પગલું નોંધો."],
    })),
    safetyMessage: "આ માહિતી તૈયારી માટે છે, નિદાન અથવા સારવાર માટે નથી. તબીબી નિર્ણય માટે ડૉક્ટરની સલાહ લો.",
  };
}

function localizeDoctorHandoff(handoff = {}, topIssue = null) {
  const issue = topIssue || {};
  return {
    ...handoff,
    title: "ડૉક્ટરને બતાવવા માટે",
    status: issue.status === "NORMAL" ? "સ્થિર" : "ચર્ચા કરવા યોગ્ય",
    topIssue: handoff.topIssue
      ? {
          ...handoff.topIssue,
          parameter: metricLabel(issue.key, handoff.topIssue.parameter),
          status: STATUS_GU[handoff.topIssue.status] || handoff.topIssue.status,
          severity: STATUS_GU[handoff.topIssue.severity] || handoff.topIssue.severity,
          focusLabel: focusLabel(issue.focusKey, handoff.topIssue.focusLabel),
          change: trendCopy(issue).detail,
        }
      : null,
    priorityIssues: (handoff.priorityIssues || []).map((item) => ({
      ...item,
      parameter: metricLabel(issue.key, item.parameter),
      status: STATUS_GU[item.status] || item.status,
      severity: STATUS_GU[item.severity] || item.severity,
      change: trendCopy(issue).detail,
    })),
    recommendedAction: "આ પરિણામ આગામી મુલાકાતમાં તમારા ડૉક્ટર સાથે ચર્ચા કરો.",
    doctorQuestions: doctorQuestionsFor(issue),
    summaryText: issue.key
      ? `${metricLabel(issue.key, issue.parameter)} મુખ્ય ચર્ચાનો મુદ્દો છે. બાકીના પરિણામો પછી જુઓ.`
      : "મૂળ રિપોર્ટ સાથે પરિણામોની સમીક્ષા કરો.",
    disclaimer: "આ તબીબી નિદાન નથી. ડૉક્ટર સાથેની ચર્ચાની તૈયારી માટે તેનો ઉપયોગ કરો.",
  };
}

function localizeReportInsights(insights, lang = "en") {
  if (!insights || normalizeLanguage(lang) === "en") return insights;
  const localized = clone(insights);

  localized.trends = (localized.trends || []).map((trend) => ({
    ...trend,
    metricLabel: metricLabel(trend.metricKey, trend.metricLabel),
    summary: metricSummary(trend),
  }));
  localized.conditionSummaries = (localized.conditionSummaries || []).map(localizeConditionSummary);
  localized.badges = (localized.badges || []).map((badge) => ({
    ...badge,
    label: metricLabel(badge.metricKey || badge.key, badge.label),
    title: metricLabel(badge.metricKey || badge.key, badge.title),
    summary: metricSummary({
      ...badge,
      metricKey: badge.metricKey || badge.key,
      latestValue: badge.latestValue ?? badge.value,
    }),
  }));

  const localizedIssues = (localized.healthIssues?.all || []).map(localizeIssue);
  const issueByKey = new Map(localizedIssues.map((issue) => [issue.key, issue]));
  const topIssue = issueByKey.get(localized.healthIssues?.topIssue?.key) || localizedIssues[0] || null;
  if (localized.healthIssues) {
    localized.healthIssues = {
      ...localized.healthIssues,
      overallStatus: topIssue && topIssue.status !== "NORMAL" ? "ધ્યાનમાં રાખવું" : "સ્થિર",
      status: topIssue && topIssue.status !== "NORMAL" ? "ચર્ચા કરવા યોગ્ય" : "સ્થિર",
      recommendedAction: topIssue
        ? "આ પરિણામ આગામી મુલાકાતમાં તમારા ડૉક્ટર સાથે ચર્ચા કરો."
        : "આગામી રિપોર્ટ સાથે સરખામણી ચાલુ રાખો.",
      topIssue,
      all: localizedIssues,
      abnormal: localizedIssues.filter((issue) => issue.status !== "NORMAL").slice(0, 6),
      normal: localizedIssues.filter((issue) => issue.status === "NORMAL").slice(0, 6),
      fixThisFirst: topIssue
        ? {
            ...(localized.healthIssues.fixThisFirst || {}),
            title: `${topIssue.parameter} · ${STATUS_GU[topIssue.status] || topIssue.status}`,
            focusLabel: topIssue.focusLabel,
            body: "આ પરિણામથી શરૂઆત કરો અને પછી બાકીના પરિણામો જુઓ.",
            actions: ["આ પરિણામને અગાઉના રિપોર્ટ સાથે સરખાવો.", "ડૉક્ટર માટેનો એક પ્રશ્ન તૈયાર રાખો."],
            doctorQuestions: topIssue.doctorQuestions,
          }
        : localized.healthIssues.fixThisFirst,
      changeOverTime: topIssue?.changeOverTime || null,
    };
  }

  localized.overview = {
    ...(localized.overview || {}),
    headline: topIssue && topIssue.status !== "NORMAL"
      ? "થોડા પરિણામો પર ફોલોઅપ યોગ્ય હોઈ શકે છે"
      : "હાલના પરિણામો મોટા ભાગે સ્થિર દેખાય છે",
    summary: topIssue && topIssue.status !== "NORMAL"
      ? "પહેલાં સૌથી ઉપયોગી પરિણામને સરળ રીતે દર્શાવ્યું છે."
      : "હાલમાં કોઈ મોટો ફેરફાર દેખાતો નથી.",
    confidenceLabel: CONFIDENCE_GU[localized.overview?.confidenceLevel] || "મધ્યમ વિશ્વસનીયતા",
    limitations: ["ફક્ત અપલોડ કરેલા રિપોર્ટના મૂલ્યો પર આધારિત", "સંપૂર્ણ તબીબી સંદર્ભ સામેલ નથી", "નિદાન નથી"],
  };
  localized.patientSummary = `${localized.overview.headline}. ${localized.overview.summary}`;
  localized.doctorSummary = topIssue
    ? `${topIssue.parameter}: ${metricSummary(topIssue)}`
    : "પસંદ કરેલા સમયગાળામાં ગોઠવેલા રિપોર્ટ મૂલ્યો ઉપલબ્ધ નથી.";
  localized.priorities = (localized.priorities || []).map(localizePriority);
  localized.canWait = (localized.canWait || []).map(localizePriority);
  localized.nextSteps = {
    summary: "પહેલાં મુખ્ય પરિણામ પર ધ્યાન આપો.",
    actions: ["મુખ્ય પરિણામથી શરૂઆત કરો.", "અગાઉના રિપોર્ટ હોય તો સાથે રાખો.", "ડૉક્ટર માટેના પ્રશ્નો તૈયાર રાખો."],
  };
  localized.doctorQuestions = doctorQuestionsFor(topIssue || {});
  localized.guidedTrends = {
    ...(localized.guidedTrends || {}),
    headline: topIssue?.changeOverTime?.trendLabel || "હજુ પૂરતો ડેટા નથી",
    summary: topIssue?.changeOverTime?.trendSummary || "ટ્રેન્ડ સમજવા માટે વધુ રિપોર્ટ જરૂરી છે.",
  };
  localized.guidedFollowUp = {
    ...(localized.guidedFollowUp || {}),
    overview: localized.overview,
    priorities: localized.priorities,
    canWait: localized.canWait,
    nextSteps: localized.nextSteps,
    doctorQuestions: localized.doctorQuestions,
    trends: localized.guidedTrends,
    safety: {
      ...(localized.guidedFollowUp?.safety || {}),
      headline: "આ માહિતી તૈયારી માટે છે",
      summary: "નિદાન અથવા સારવારમાં ફેરફાર માટે ડૉક્ટરની સલાહ લો.",
    },
  };
  localized.personalizedFollowUp = localizePersonalizedFollowUp(localized.personalizedFollowUp, topIssue);
  localized.carePlan = localizeCarePlan(localized.carePlan || {});
  localized.doctorHandoff = localizeDoctorHandoff(localized.doctorHandoff || {}, topIssue);
  localized.decision = {
    ...(localized.decision || {}),
    overallStatus: localized.healthIssues?.overallStatus || "સ્થિર",
    healthStatus: localized.healthIssues?.status || "સ્થિર",
    recommendedAction: localized.healthIssues?.recommendedAction || "આગામી રિપોર્ટ સાથે સરખાવો.",
    topIssue,
    fixThisFirst: localized.healthIssues?.fixThisFirst || null,
    changeOverTime: topIssue?.changeOverTime || null,
    carePlan: localized.carePlan,
    doctorHandoff: localized.doctorHandoff,
    disclaimer: "આ તબીબી નિદાન નથી. તબીબી નિર્ણય માટે ડૉક્ટરની સલાહ લો.",
  };
  if (localized.safety) {
    localized.safety = {
      ...localized.safety,
      headline: "રિપોર્ટને તમારા લક્ષણો અને તબીબી ઇતિહાસ સાથે જુઓ.",
      message: "આ માહિતી તૈયારી માટે છે; ઇમરજન્સી અથવા નિદાન માટે તેનો ઉપયોગ ન કરો.",
    };
  }
  if (localized.extractionSafety) {
    localized.extractionSafety = {
      ...localized.extractionSafety,
      message: localized.extractionSafety.requiresCautiousPlan
        ? "કેટલાક કાઢેલા મૂલ્યોની માનવીય સમીક્ષા જરૂરી છે. ત્યાં સુધી સારાંશને સાવધાનીથી જુઓ."
        : "રિપોર્ટના મૂલ્યો ઉપયોગ માટે તૈયાર છે.",
    };
  }
  localized.safetyLayer = localized.guidedFollowUp?.safety || localized.safetyLayer;
  return localized;
}

const ACTION_CHECK_INS_GU = {
  hba1c: [
    { id: "grain_swap", label: "આજે એક ભોજનમાં રિફાઇન્ડ કાર્બ ઓછું રાખ્યું", icon: "🌾" },
    { id: "walk_meal", label: "આજે ભોજન પછી 20-30 મિનિટ ચાલ્યા", icon: "🚶" },
    { id: "fasting_log", label: "આજે એક બ્લડ શુગર રીડિંગ સાચવ્યું", icon: "🩸", linkedTracker: "bloodSugar" },
  ],
  sugar: [
    { id: "carb_swap", label: "આજે એક ભોજનમાં રિફાઇન્ડ કાર્બ ઓછું રાખ્યું", icon: "🥗" },
    { id: "walk_meal", label: "આજે મુખ્ય ભોજન પછી ચાલ્યા", icon: "🚶", linkedTracker: "bloodSugar" },
    { id: "sugar_log", label: "આજે બ્લડ શુગર રીડિંગ સાચવ્યું", icon: "🩸", linkedTracker: "bloodSugar" },
  ],
  hemoglobin: [
    { id: "food_note", label: "આજે આયર્ન ધરાવતો ખોરાક લીધો", icon: "🥬" },
    { id: "meal_gap", label: "ભોજન પછી એક કલાક સુધી ચા અથવા કૉફી ટાળી", icon: "☕" },
    { id: "symptom_log", label: "થાક અથવા ચક્કર જેવા લક્ષણ નોંધ્યા", icon: "📝", linkedTracker: "symptoms" },
  ],
  lipid: [
    { id: "fried_food", label: "આજે તળેલો નાસ્તો ટાળ્યો", icon: "🥗" },
    { id: "fibre", label: "આજે ફાઇબર ધરાવતો ખોરાક લીધો", icon: "🌾" },
    { id: "walk", label: "આજે 30 મિનિટ ચાલ્યા", icon: "🚶" },
  ],
  thyroid: [
    { id: "medicine", label: "થાઇરોઇડની દવા સમયસર લીધી", icon: "💊", linkedTracker: "medication" },
    { id: "symptom", label: "થાક અથવા નવા લક્ષણ નોંધ્યા", icon: "📝", linkedTracker: "symptoms" },
    { id: "question", label: "આગામી મુલાકાત માટે એક પ્રશ્ન સાચવ્યો", icon: "💬", linkedTracker: "question" },
  ],
  kidney: [
    { id: "water", label: "આજે પૂરતું પાણી પીધું", icon: "💧" },
    { id: "medicine", label: "દવા અથવા OTC વિશે ડૉક્ટરની સલાહ વગર ફેરફાર કર્યો નથી", icon: "💊" },
    { id: "symptom", label: "સોજો અથવા અન્ય લક્ષણ નોંધ્યા", icon: "📝", linkedTracker: "symptoms" },
  ],
  liver: [
    { id: "no_alcohol", label: "આજે આલ્કોહોલ ટાળ્યું", icon: "🚫" },
    { id: "otc", label: "કોઈ OTC દવા પહેલાં ડૉક્ટર અથવા ફાર્માસિસ્ટને પૂછ્યું", icon: "💊" },
    { id: "symptom", label: "કોઈ નવું લક્ષણ હોય તો નોંધ્યું", icon: "📝", linkedTracker: "symptoms" },
  ],
  weight: [
    { id: "balanced_meal", label: "આજે એક સંતુલિત ભોજન લીધું", icon: "🥗" },
    { id: "walk", label: "આજે આરામથી 30 મિનિટ ચાલ્યા", icon: "🚶", linkedTracker: "weight" },
    { id: "weight_log", label: "આ અઠવાડિયાનું વજન સાચવ્યું", icon: "⚖️", linkedTracker: "weight" },
  ],
  general: [
    { id: "reading", label: "આજે એક સંબંધિત રીડિંગ સાચવ્યું", icon: "✎" },
    { id: "symptom", label: "આજે કોઈ ઉપયોગી લક્ષણ નોંધ્યું", icon: "📝", linkedTracker: "symptoms" },
    { id: "question", label: "ડૉક્ટર માટે એક પ્રશ્ન તૈયાર રાખ્યો", icon: "💬", linkedTracker: "question" },
  ],
};

function actionGroup(metricKey = "") {
  if (["hba1c"].includes(metricKey)) return "hba1c";
  if (["fbs", "ppbs", "rbs", "estimated_average_glucose"].includes(metricKey)) return "sugar";
  if (["hemoglobin", "mch", "mchc", "mcv", "rbc_count", "pcv", "rdw"].includes(metricKey)) return "hemoglobin";
  if (["total_cholesterol", "ldl", "hdl", "triglycerides"].includes(metricKey)) return "lipid";
  if (["tsh", "t3", "t4"].includes(metricKey)) return "thyroid";
  if (["creatinine", "urea", "uric_acid"].includes(metricKey)) return "kidney";
  if (["bilirubin_total", "sgpt_alt", "sgot_ast"].includes(metricKey)) return "liver";
  if (["bmi", "weight"].includes(metricKey)) return "weight";
  return "general";
}

function localizeActionMap(actionMap, lang = "en") {
  if (!actionMap || normalizeLanguage(lang) === "en") return actionMap;
  const localizePlan = (plan) => {
    if (!plan) return plan;
    const group = actionGroup(plan.metricKey);
    const label = metricLabel(plan.metricKey, plan.metricLabel);
    const direction = plan.zone === "low" ? "ઓછું" : "ઊંચું";
    return {
      ...plan,
      metricLabel: label,
      headline: `${label} ${valueWithUnit(plan.value, plan.unit)} છે, જે સરખામણીની રેન્જથી ${direction} છે.`,
      thisWeek: ACTION_CHECK_INS_GU[group].map((item) => item.label),
      checkIns: ACTION_CHECK_INS_GU[group],
      retest: plan.retestDays
        ? `${plan.retestDays} દિવસ પછી ફરી તપાસ અંગે ડૉક્ટર સાથે ચર્ચા કરો`
        : "ફરી તપાસનો યોગ્ય સમય ડૉક્ટર સાથે નક્કી કરો",
      bringToDoctor: `${label} માટે યોગ્ય લક્ષ્ય અને ફરી તપાસનો સમય શું હોવો જોઈએ તે પૂછો.`,
      improvement: plan.improvement
        ? {
            ...plan.improvement,
            message: `${label} અગાઉના રિપોર્ટથી સુધર્યું છે. આગળ પણ સરખામણી ચાલુ રાખો.`,
          }
        : null,
      secondary: (plan.secondary || []).map(localizePlan),
    };
  };
  return localizePlan(actionMap);
}

module.exports = {
  localizeReportInsights,
  localizeActionMap,
  normalizeLanguage,
  metricLabel,
};
