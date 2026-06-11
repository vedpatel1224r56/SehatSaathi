#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_DIR = path.join(__dirname, "..", "outputs", "synthetic-life-simulation", "latest");

const NAMES = {
  female: ["Anita", "Meena", "Riya", "Kavita", "Pooja", "Nisha", "Farah", "Sonal", "Jaya", "Priya", "Asha", "Leela"],
  male: ["Rajesh", "Amit", "Vikram", "Suresh", "Imran", "Nikhil", "Harsh", "Arjun", "Dev", "Kiran", "Mahesh", "Rohan"],
};

const LAST_NAMES = ["Patel", "Shah", "Mehta", "Khan", "Desai", "Iyer", "Reddy", "Joshi", "Nair", "Singh", "Trivedi", "Kapoor"];

const CONDITIONS = [
  "Type 2 Diabetes",
  "Prediabetes",
  "Hypertension",
  "PCOS",
  "Hypothyroidism",
  "Asthma",
  "Coronary Artery Disease",
  "Obesity",
  "Chronic Kidney Disease",
  "Arthritis",
  "Heart Failure",
  "Pregnancy",
  "Senior Preventive Care",
  "Preventive Health",
];

const LABS = ["Kotak Lab Vasna", "Alkapuri Diagnostics", "Gotri Pathology", "CityCare Lab", "Aarogya Diagnostics"];
const HOSPITALS = ["Endocrinology", "Cardiology", "Dermatology", "General Practice", "Preventive Health"];

const PRODUCT_INTERVENTIONS = {
  weeklyMemoryCard: true,
  oneSignalActions: true,
  reportChangeDetector: true,
  familyShareShortcuts: true,
  reducedReportText: true,
};

const BEHAVIOR_ARCHETYPES = [
  {
    key: "lazy",
    label: "Lazy / avoidant",
    motivationShift: -22,
    adherenceShift: -18,
    returnBias: -18,
    manualEntryBias: -22,
    boredomBias: 13,
    whatsappBias: 5,
    description: "Ignores health unless scared, reminded, or a lab/doctor pushes them.",
  },
  {
    key: "busy_working",
    label: "Working class / time-poor",
    motivationShift: -9,
    adherenceShift: -6,
    returnBias: -13,
    manualEntryBias: -16,
    boredomBias: 7,
    whatsappBias: 6,
    description: "Will use only if it saves time in under 10 seconds.",
  },
  {
    key: "bored_preventive",
    label: "Bored preventive",
    motivationShift: -14,
    adherenceShift: -8,
    returnBias: -16,
    manualEntryBias: -18,
    boredomBias: 16,
    whatsappBias: 2,
    description: "Reads once, feels fine, and disappears unless progress is obvious.",
  },
  {
    key: "health_freak",
    label: "Health freak",
    motivationShift: 22,
    adherenceShift: 15,
    returnBias: 18,
    manualEntryBias: 18,
    boredomBias: -6,
    whatsappBias: -4,
    description: "Tracks often and enjoys trend feedback.",
  },
  {
    key: "over_40_control",
    label: "40+ health control",
    motivationShift: 12,
    adherenceShift: 8,
    returnBias: 12,
    manualEntryBias: 8,
    boredomBias: -3,
    whatsappBias: 0,
    description: "Wants control over sugar, BP, weight, and next doctor review.",
  },
  {
    key: "family_dependent",
    label: "Family-dependent",
    motivationShift: -5,
    adherenceShift: 0,
    returnBias: -5,
    manualEntryBias: -10,
    boredomBias: 6,
    whatsappBias: 16,
    description: "Health coordination happens in WhatsApp unless SehatSaathi fits that behavior.",
  },
];

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260603);

function pick(items) {
  return items[Math.floor(rand() * items.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function scoreLabel(score) {
  if (score >= 75) return "strong";
  if (score >= 50) return "mixed";
  if (score >= 30) return "fragile";
  return "at risk";
}

function conditionThread(condition) {
  if (/diabetes|prediabetes/i.test(condition)) return "Sugar Thread";
  if (/hypertension|heart|coronary/i.test(condition)) return "Heart Thread";
  if (/kidney/i.test(condition)) return "Kidney Thread";
  if (/pcos|obesity/i.test(condition)) return "Weight Thread";
  if (/thyroid/i.test(condition)) return "Thyroid Thread";
  if (/asthma/i.test(condition)) return "Breathing Thread";
  if (/arthritis/i.test(condition)) return "Pain Thread";
  if (/pregnancy/i.test(condition)) return "Pregnancy Thread";
  return "Preventive Thread";
}

function archetypeFor(index, condition, age) {
  if (age >= 40 && /Diabetes|Prediabetes|Hypertension|Obesity|Thyroid|Preventive|Arthritis/i.test(condition)) {
    return BEHAVIOR_ARCHETYPES[(index + 4) % BEHAVIOR_ARCHETYPES.length];
  }
  if (/Preventive|Obesity|Arthritis/i.test(condition)) return BEHAVIOR_ARCHETYPES[(index + 2) % BEHAVIOR_ARCHETYPES.length];
  return BEHAVIOR_ARCHETYPES[index % BEHAVIOR_ARCHETYPES.length];
}

function makePersona(index) {
  const gender = rand() > 0.49 ? "female" : "male";
  const condition = CONDITIONS[index % CONDITIONS.length];
  const ageBase = /Pregnancy|PCOS/.test(condition) ? 27 : /Senior|Heart Failure|Coronary|CKD/.test(condition) ? 63 : 42;
  const age = clamp(Math.round(ageBase + rand() * 20 - 7), 21, 82);
  const familyMode = pick([
    "self-managed",
    "daughter helps",
    "spouse helps",
    "adult son helps",
    "shared family WhatsApp",
  ]);
  const income = pick(["low", "lower-middle", "middle", "upper-middle"]);
  const healthLiteracy = pick(["low", "medium", "high"]);
  const digitalLiteracy = pick(["low", "medium", "high"]);
  const archetype = archetypeFor(index, condition, age);
  const motivation = Math.round(clamp(35 + rand() * 60 + archetype.motivationShift, 5, 98));
  const adherence = Math.round(clamp(motivation + (rand() * 30 - 15) + archetype.adherenceShift, 5, 98));
  const name = `${pick(NAMES[gender])} ${pick(LAST_NAMES)}`;
  return {
    id: `P${String(index + 1).padStart(3, "0")}`,
    name,
    age,
    gender,
    family: familyMode,
    lifestyle: pick(["sedentary", "irregular work hours", "walks weekly", "active but stressed", "home-centered"]),
    archetype: archetype.key,
    archetypeLabel: archetype.label,
    archetypeDescription: archetype.description,
    income,
    healthLiteracy,
    digitalLiteracy,
    motivation,
    medicationAdherence: adherence,
    healthcareHabits: pick(["doctor-led", "lab-led", "family-led", "delays follow-up", "preventive"]),
    primaryCondition: condition,
    thread: conditionThread(condition),
    lab: LABS[index % LABS.length],
    department: HOSPITALS[index % HOSPITALS.length],
    baseline: buildBaseline(condition, age),
  };
}

function getArchetype(persona) {
  return BEHAVIOR_ARCHETYPES.find((item) => item.key === persona.archetype) || BEHAVIOR_ARCHETYPES[0];
}

function buildBaseline(condition, age) {
  const bmi = round(clamp(23 + rand() * 9 + (/Obesity|PCOS|Diabetes/.test(condition) ? 3 : 0), 19, 38), 1);
  const bpSys = Math.round(clamp(118 + rand() * 34 + (/Hypertension|Heart|Kidney/.test(condition) ? 15 : 0), 104, 178));
  const glucose = Math.round(clamp(92 + rand() * 46 + (/Diabetes/.test(condition) ? 52 : /Prediabetes/.test(condition) ? 22 : 0), 78, 245));
  const hba1c = round(clamp(5.3 + rand() * 1.3 + (/Diabetes/.test(condition) ? 1.8 : /Prediabetes/.test(condition) ? 0.7 : 0), 4.8, 10.2), 1);
  return {
    bmi,
    weightKg: round(bmi * 2.9, 1),
    bpSys,
    bpDia: Math.round(clamp(74 + rand() * 16 + (/Hypertension|Heart|Kidney/.test(condition) ? 9 : 0), 62, 106)),
    glucose,
    hba1c,
    tsh: round(clamp(2 + rand() * 3 + (/Hypothyroid/.test(condition) ? 5 : 0), 0.7, 12), 1),
    ldl: Math.round(clamp(92 + rand() * 58 + (/Coronary|Diabetes|Obesity/.test(condition) ? 22 : 0), 60, 198)),
    creatinine: round(clamp(0.75 + rand() * 0.45 + (/Kidney/.test(condition) ? 0.8 : 0), 0.55, 2.8), 2),
  };
}

function reportFor(persona, month, state) {
  const condition = persona.primaryCondition;
  const reports = [];
  const quarterly = month === 1 || month === 3 || month === 6 || month === 12;
  const halfYear = month === 1 || month === 6 || month === 12;
  const monthly = month % 1 === 0;
  if (/Diabetes|Prediabetes/.test(condition) && quarterly) {
    reports.push({
      type: "HbA1c",
      values: { HbA1c: round(state.hba1c, 1), "Estimated Average Glucose": Math.round(28.7 * state.hba1c - 46.7) },
    });
  }
  if (/Hypertension|Coronary|Heart|Kidney/.test(condition) && monthly) {
    reports.push({ type: "Blood Pressure Log", values: { Systolic: state.bpSys, Diastolic: state.bpDia } });
  }
  if (/Hypothyroidism/.test(condition) && (month === 1 || month === 3 || month === 6 || month === 12)) {
    reports.push({ type: "Thyroid", values: { TSH: round(state.tsh, 1), T3: round(1.1 + rand() * 0.5, 2), T4: round(7 + rand() * 3, 1) } });
  }
  if (halfYear) {
    reports.push({
      type: "Wellness Panel",
      values: {
        LDL: state.ldl,
        Creatinine: state.creatinine,
        "Vitamin D": Math.round(clamp(16 + rand() * 24, 8, 52)),
        BMI: state.bmi,
      },
    });
  }
  if (/Asthma|Arthritis|Pregnancy|Preventive/.test(condition) && (month === 1 || month === 6 || month === 12)) {
    reports.push({
      type: "CBC",
      values: {
        Hemoglobin: round(clamp(11.2 + rand() * 3, 9.4, 15.6), 1),
        WBC: round(clamp(5600 + rand() * 4200, 4200, 12500), 0),
        Eosinophils: round(clamp(2 + rand() * 8 + (/Asthma/.test(condition) ? 4 : 0), 1, 14), 1),
      },
    });
  }
  return reports;
}

function evolveState(persona, month, previous, abandoned) {
  const adherenceEffect = (persona.medicationAdherence - 55) / 100;
  const familyHelp = /daughter|spouse|son|shared/i.test(persona.family) ? 0.09 : 0;
  const stress = rand() > 0.82 ? 0.16 : 0;
  const engagement = abandoned ? -0.08 : 0.06;
  const improvement = adherenceEffect + familyHelp + engagement - stress;
  return {
    hba1c: round(clamp(previous.hba1c - improvement * 0.42 + (rand() * 0.24 - 0.12), 4.9, 10.4), 1),
    glucose: Math.round(clamp(previous.glucose - improvement * 18 + (rand() * 18 - 9), 72, 260)),
    bpSys: Math.round(clamp(previous.bpSys - improvement * 10 + (rand() * 12 - 6), 96, 186)),
    bpDia: Math.round(clamp(previous.bpDia - improvement * 5 + (rand() * 8 - 4), 58, 112)),
    bmi: round(clamp(previous.bmi - improvement * 0.45 + (rand() * 0.28 - 0.14), 18.5, 39), 1),
    weightKg: round(clamp(previous.weightKg - improvement * 1.3 + (rand() * 1.2 - 0.6), 44, 122), 1),
    tsh: round(clamp(previous.tsh - (/Hypothyroidism/.test(persona.primaryCondition) ? improvement * 1.1 : 0) + (rand() * 0.4 - 0.2), 0.4, 13), 1),
    ldl: Math.round(clamp(previous.ldl - improvement * 11 + (rand() * 8 - 4), 55, 210)),
    creatinine: round(clamp(previous.creatinine - improvement * 0.08 + (rand() * 0.08 - 0.04), 0.5, 3.2), 2),
  };
}

function simulatePersona(persona) {
  const months = [];
  let state = { ...persona.baseline };
  let abandoned = false;
  let abandonmentReason = "";
  let usefulMemoryCount = 0;
  let briefScore = 28;
  let returnScore = 28 + Math.round(rand() * 18) + getArchetype(persona).returnBias;
  let revenueInfluence = 0;

  for (let month = 1; month <= 12; month += 1) {
    const archetype = getArchetype(persona);
    const friction = persona.digitalLiteracy === "low" ? 16 : persona.digitalLiteracy === "medium" ? 8 : 2;
    const healthLiteracyFriction = persona.healthLiteracy === "low" ? 7 : persona.healthLiteracy === "medium" ? 3 : 0;
    const incomeFriction = persona.income === "low" ? 6 : persona.income === "lower-middle" ? 3 : 0;
    const familyLift = /daughter|spouse|son/i.test(persona.family) ? 9 : /shared/i.test(persona.family) ? 4 : 0;
    const motivationLift = (persona.motivation - 50) / 4;
    const scare = rand() > 0.88;
    const lowTriggerCondition = /Preventive|Prediabetes|Obesity|Arthritis/.test(persona.primaryCondition);
    const chronicCondition = /Diabetes|Hypertension|Coronary|Heart|Kidney|Hypothyroidism|Pregnancy/i.test(persona.primaryCondition);
    const noFamilyPenalty = /self-managed/i.test(persona.family) ? 11 : 0;
    const boredomPenalty = lowTriggerCondition && month > 3 ? 11 + archetype.boredomBias : Math.max(0, archetype.boredomBias / 2);
    const reportMoment = reportFor(persona, month, state).length > 0;
    const appOpenedThisMonth =
      reportMoment ||
      scare ||
      rand() < clamp((persona.motivation + archetype.returnBias + (chronicCondition ? 12 : 0) - friction) / 120, 0.08, 0.78);
    const willUseManualEntry =
      appOpenedThisMonth &&
      rand() < clamp((persona.motivation + persona.medicationAdherence + archetype.manualEntryBias - friction - healthLiteracyFriction) / 150, 0.04, 0.72);
    const familyShortcutAccepted =
      PRODUCT_INTERVENTIONS.familyShareShortcuts &&
      /daughter|spouse|son|shared/i.test(persona.family) &&
      appOpenedThisMonth &&
      rand() < clamp((55 - archetype.whatsappBias) / 100, 0.12, 0.58);
    const oneSignalLift = PRODUCT_INTERVENTIONS.oneSignalActions && willUseManualEntry ? (lowTriggerCondition ? 5 : 4) : 0;
    const weeklyMemoryLift = PRODUCT_INTERVENTIONS.weeklyMemoryCard && appOpenedThisMonth && month > 3 ? (lowTriggerCondition ? 4 : 2) : 0;
    const familyShortcutLift = familyShortcutAccepted ? 5 : 0;
    const textReductionLift = PRODUCT_INTERVENTIONS.reducedReportText && appOpenedThisMonth ? (persona.healthLiteracy !== "high" ? 2 : 1) : 0;
    const changeDetectorLift = PRODUCT_INTERVENTIONS.reportChangeDetector && reportMoment && month > 1 ? 3 : 0;
    const whatsappLeakPenalty = /shared family WhatsApp/i.test(persona.family) || archetype.key === "family_dependent" ? archetype.whatsappBias : 0;
    const notificationFatiguePenalty = month > 6 && !reportMoment && !scare ? 4 : 0;
    const abandonmentPressure =
      returnScore +
      familyLift +
      motivationLift +
      oneSignalLift +
      weeklyMemoryLift +
      familyShortcutLift +
      textReductionLift +
      changeDetectorLift -
      friction -
      healthLiteracyFriction -
      incomeFriction -
      noFamilyPenalty -
      boredomPenalty -
      whatsappLeakPenalty -
      notificationFatiguePenalty;
    if (!abandoned && month > 2 && abandonmentPressure < 48 && rand() > (scare ? 0.72 : 0.24)) {
      abandoned = true;
      abandonmentReason =
        whatsappLeakPenalty > 10
          ? "Family member kept using WhatsApp instead."
          : !appOpenedThisMonth
            ? "No clear reason to return after reading the report."
            : friction + healthLiteracyFriction > 18
              ? "Too much friction for a busy or low-literacy user."
              : lowTriggerCondition
                ? "Felt fine, so the product became easy to ignore."
                : "Lab link was opened once, then forgotten.";
    }

    state = evolveState(persona, month, state, abandoned);
    const reports = abandoned ? [] : reportFor(persona, month, state);
    const symptoms = abandoned ? [] : simulateSymptoms(persona, scare);
    const readings = abandoned ? [] : simulateReadings(persona, state);
    const medication = abandoned ? null : simulateMedication(persona, month);
    const question = abandoned ? "" : simulateQuestion(persona, symptoms, reports);
    const appointment = abandoned ? null : simulateAppointment(persona, month, scare, reports.length);
    const familyAction = !abandoned && /daughter|spouse|son|shared/i.test(persona.family) && rand() > (familyShortcutAccepted ? 0.38 : 0.58);

    const oneSignalSaved = !abandoned && PRODUCT_INTERVENTIONS.oneSignalActions && willUseManualEntry;
    const memoryUseful =
      !abandoned &&
      appOpenedThisMonth &&
      (question || symptoms.length || reports.length || oneSignalSaved) &&
      rand() > (PRODUCT_INTERVENTIONS.weeklyMemoryCard ? 0.28 : 0.38);
    if (memoryUseful) usefulMemoryCount += 1;
    briefScore = clamp(briefScore + (memoryUseful ? 4 : appOpenedThisMonth ? 1 : 0) + reports.length * 1.5 - (abandoned ? 9 : 0), 0, 100);
    returnScore = clamp(
      returnScore +
        (reports.length ? 5 : -4) +
        (oneSignalSaved ? 4 : 0) +
        (PRODUCT_INTERVENTIONS.weeklyMemoryCard && appOpenedThisMonth && month > 3 ? 2 : 0) +
        (symptoms.length ? 3 : 0) +
        (familyAction ? (familyShortcutAccepted ? 5 : 2) : 0) +
        (appointment ? 5 : 0) -
        (lowTriggerCondition ? (PRODUCT_INTERVENTIONS.weeklyMemoryCard && appOpenedThisMonth ? 1 : 5) : 1) -
        (abandoned ? 16 : appOpenedThisMonth ? 2 : 5),
      0,
      100,
    );
    revenueInfluence += reports.length ? 120 + reports.length * 80 : 0;

    months.push({
      month,
      active: !abandoned,
      reports,
      symptoms,
      notes: abandoned ? [] : [`${persona.thread}: ${symptoms[0] || "no major symptoms"} this month`],
      medications: medication ? [medication] : [],
      readings,
      weightKg: state.weightKg,
      question,
      appointment,
      familyAction: familyAction ? `${persona.family} prepared the next question` : "",
      healthBrief: {
        focus: persona.thread,
        whatChanged: summarizeChange(persona, state, month),
        whatCanWait: reports.length ? "No emergency signal in the simulated report flow." : "No new report this month.",
        nextStep: question || "Keep one useful reading visible.",
        score: Math.round(briefScore),
        usefulMemory: memoryUseful,
      },
      retention: {
        tomorrow: !abandoned && (reports.length || symptoms.length || scare || oneSignalSaved) ? "likely" : "uncertain",
        nextWeek: scoreLabel(returnScore),
        nextMonth: !abandoned && returnScore >= 45 ? "likely" : "at risk",
        trigger: reports.length ? "new report" : oneSignalSaved ? "one-signal save" : appointment ? "appointment prep" : familyAction ? "family shortcut" : "weekly memory",
        abandonmentReason: abandoned ? abandonmentReason : "",
        appOpenedThisMonth,
        oneSignalSaved,
        familyShortcutAccepted,
      },
    });
  }

  return {
    persona,
    months,
    outcome: {
      activeAt12Months: !abandoned,
      abandonmentReason,
      usefulMemoryCount,
      healthBriefScore: Math.round(briefScore),
      returnScore: Math.round(returnScore),
      labRevenueInfluence: Math.round(revenueInfluence),
      patientVerdict: !abandoned && briefScore >= 60 ? "habit/utility" : abandoned ? "abandoned" : "occasional utility",
    },
  };
}

function simulateSymptoms(persona, scare) {
  const byCondition = {
    "Type 2 Diabetes": ["fatigue", "thirst", "sleep disruption"],
    Prediabetes: ["energy dip", "cravings"],
    Hypertension: ["headache", "stress spike"],
    PCOS: ["cycle irregularity", "acne flare"],
    Hypothyroidism: ["low energy", "cold intolerance"],
    Asthma: ["wheeze", "night cough"],
    "Coronary Artery Disease": ["chest heaviness", "breathlessness"],
    Obesity: ["knee pain", "low stamina"],
    "Chronic Kidney Disease": ["swelling", "fatigue"],
    Arthritis: ["joint stiffness", "pain flare"],
    "Heart Failure": ["breathlessness", "ankle swelling"],
    Pregnancy: ["nausea", "back pain"],
    "Senior Preventive Care": ["fall worry", "fatigue"],
    "Preventive Health": ["no major symptoms"],
  };
  const symptoms = byCondition[persona.primaryCondition] || ["fatigue"];
  return rand() > 0.38 || scare ? [pick(symptoms), ...(scare ? ["health scare"] : [])] : [];
}

function simulateReadings(persona, state) {
  const readings = [];
  if (/Diabetes|Prediabetes/.test(persona.primaryCondition)) readings.push({ type: "blood glucose", value: state.glucose, unit: "mg/dL" });
  if (/Hypertension|Heart|Kidney|Senior/.test(persona.primaryCondition)) readings.push({ type: "blood pressure", value: `${state.bpSys}/${state.bpDia}`, unit: "mmHg" });
  readings.push({ type: "weight", value: state.weightKg, unit: "kg" });
  return readings;
}

function simulateMedication(persona, month) {
  const map = {
    "Type 2 Diabetes": "Metformin",
    Hypertension: "Amlodipine",
    Hypothyroidism: "Levothyroxine",
    Asthma: "Inhaler",
    "Coronary Artery Disease": "Statin",
    "Heart Failure": "Diuretic",
    "Chronic Kidney Disease": "BP medicine",
    Arthritis: "Pain medicine",
    PCOS: "Cycle medicine",
  };
  const name = map[persona.primaryCondition] || "Routine medicine";
  return { name, adherence: month % 4 === 0 && rand() > 0.65 ? "missed sometimes" : "mostly taken" };
}

function simulateQuestion(persona, symptoms, reports) {
  if (reports.some((report) => report.type === "HbA1c")) return "What HbA1c target is realistic for me?";
  if (symptoms.includes("health scare")) return "Does this symptom need earlier review?";
  if (/Hypertension|Heart/.test(persona.primaryCondition)) return "Should my BP medicine timing change?";
  if (/Thyroid/.test(persona.primaryCondition)) return "Should TSH be repeated after the dose change?";
  return rand() > 0.55 ? "What should I keep watching this month?" : "";
}

function simulateAppointment(persona, month, scare, reportCount) {
  const shouldVisit = scare || reportCount > 0 || month === 6 || month === 12;
  if (!shouldVisit || rand() < 0.18) return null;
  return {
    department: persona.department,
    status: rand() > 0.12 ? "completed" : "missed",
    preparedWithBrief: rand() > 0.25,
  };
}

function summarizeChange(persona, state, month) {
  if (/Diabetes|Prediabetes/.test(persona.primaryCondition)) return `HbA1c path is ${state.hba1c <= persona.baseline.hba1c ? "improving" : "worsening"} at ${state.hba1c}.`;
  if (/Hypertension|Heart|Kidney/.test(persona.primaryCondition)) return `BP is tracking around ${state.bpSys}/${state.bpDia}.`;
  if (/Hypothyroidism/.test(persona.primaryCondition)) return `TSH is now ${state.tsh}.`;
  if (/Obesity|PCOS/.test(persona.primaryCondition)) return `Weight is ${state.weightKg} kg.`;
  return month === 1 ? "Baseline health memory started." : "No major new change this month.";
}

function aggregate(simulations) {
  const active = simulations.filter((item) => item.outcome.activeAt12Months).length;
  const totalRevenue = simulations.reduce((sum, item) => sum + item.outcome.labRevenueInfluence, 0);
  const averageBrief = round(simulations.reduce((sum, item) => sum + item.outcome.healthBriefScore, 0) / simulations.length, 1);
  const abandonmentReasons = simulations
    .filter((item) => item.outcome.abandonmentReason)
    .reduce((acc, item) => {
      acc[item.outcome.abandonmentReason] = (acc[item.outcome.abandonmentReason] || 0) + 1;
      return acc;
    }, {});
  return {
    population: simulations.length,
    activeAt12Months: active,
    activeRate: round((active / simulations.length) * 100, 1),
    averageBriefScore: averageBrief,
    labRevenueInfluence: totalRevenue,
    abandoned: simulations.length - active,
    abandonmentReasons,
    labReport: {
      reportsSent: simulations.flatMap((item) => item.months).reduce((sum, month) => sum + month.reports.length, 0),
      estimatedOpenRate: round(68 + averageBrief / 5, 1),
      estimatedRevisitRate: round(active / simulations.length * 62, 1),
      repeatTestingSignal: scoreLabel(totalRevenue / simulations.length / 120),
    },
    hospitalReport: {
      preparedAppointments: simulations.flatMap((item) => item.months).filter((month) => month.appointment?.preparedWithBrief).length,
      missedAppointments: simulations.flatMap((item) => item.months).filter((month) => month.appointment?.status === "missed").length,
      clinicianValue: averageBrief >= 60 ? "useful continuity package" : "mixed continuity value",
    },
  };
}

function weeklyReports(simulations) {
  const reports = [];
  for (let week = 1; week <= 52; week += 1) {
    const month = Math.ceil(week / 4.34);
    const activePeople = simulations.filter((item) => item.months[Math.min(month - 1, 11)]?.active).length;
    reports.push({
      week,
      patientReport: `${activePeople}/100 still active. Main return trigger: ${week % 4 === 0 ? "new reports" : "saved readings"}.`,
      doctorReport: week % 4 === 0 ? "Visit briefs are strongest for diabetes, BP, and thyroid users." : "Clinicians gain value when questions are carried forward.",
      labReport: week % 4 === 0 ? "Report-linked sessions drive the strongest revisit behavior." : "No-report weeks need family reminders or readings.",
      hospitalReport: "Continuity helps most when it reduces patient recall burden.",
      investorReport: activePeople >= 65 ? "Platform behaves like retention infrastructure." : "Risk: product may remain episodic without stronger weekly pull.",
      founderReport: {
        remove: week % 3 === 0 ? "raw report-first surfaces from primary journeys" : "explanatory health text",
        merge: "questions, symptoms, readings into the Focus brief",
        redesign: week % 2 === 0 ? "family reminders" : "lab reactivation loop",
        unused: "deep history screens",
        retention: "new report + one-signal Add flow",
        delight: "forgotten question resurfaced",
        revenue: "repeat testing and revisit analytics",
        moat: "longitudinal health memory graph",
      },
    });
  }
  return reports;
}

function destroyerReport(summary) {
  return [
    `If active retention stays near ${summary.activeRate}%, SehatSaathi is useful but still vulnerable to episodic use.`,
    "The biggest weak assumption is that patients will manually add context without family or lab triggers.",
    "The legal risk is any wording that sounds like diagnosis, treatment, or urgency assignment.",
    "The lab risk is simple: if setup takes more than 15 minutes, adoption collapses.",
    "The hospital risk is that clinicians ignore briefs if they are too long or not evidence-linked.",
    "The competitive risk is that report platforms copy summaries; the moat must be longitudinal memory, not AI output.",
  ];
}

function markdownSummary(summary, simulations, weekly) {
  const conditionCounts = simulations.reduce((acc, item) => {
    acc[item.persona.primaryCondition] = (acc[item.persona.primaryCondition] || 0) + 1;
    return acc;
  }, {});
  const topAbandonment = Object.entries(summary.abandonmentReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `- ${reason}: ${count}`)
    .join("\n") || "- No abandonment";

  return `# Synthetic Life Simulation Report

## Population

- Personas: ${summary.population}
- Active at 12 months: ${summary.activeAt12Months}
- Active rate: ${summary.activeRate}%
- Average Health Brief score: ${summary.averageBriefScore}/100
- Estimated lab revenue influence: Rs ${summary.labRevenueInfluence}

## Condition Mix

${Object.entries(conditionCounts).map(([condition, count]) => `- ${condition}: ${count}`).join("\n")}

## Patient Verdict

${summary.activeRate >= 70 ? "SehatSaathi behaves like a continuity utility for the simulated population." : "SehatSaathi is useful, but retention depends heavily on report events, family involvement, and reminders."}

## Lab Verdict

- Reports sent: ${summary.labReport.reportsSent}
- Estimated open rate: ${summary.labReport.estimatedOpenRate}%
- Estimated revisit rate: ${summary.labReport.estimatedRevisitRate}%
- Repeat testing signal: ${summary.labReport.repeatTestingSignal}

## Hospital Verdict

- Prepared appointments: ${summary.hospitalReport.preparedAppointments}
- Missed appointments: ${summary.hospitalReport.missedAppointments}
- Clinician value: ${summary.hospitalReport.clinicianValue}

## Top Abandonment Reasons

${topAbandonment}

## Destroyer Agent

${destroyerReport(summary).map((item) => `- ${item}`).join("\n")}

## Ultimate 12-Month Answer

- Would 100 realistic people continue using it? ${summary.activeRate >= 70 ? "Likely for continuity-heavy cohorts; weaker for preventive users." : "Not enough yet across the full population."}
- Would labs continue paying? ${summary.labReport.estimatedRevisitRate >= 35 ? "Likely if pricing is tied to patient engagement and repeat testing." : "Unclear without stronger repeat-test conversion."}
- Would hospitals recommend it? ${summary.hospitalReport.preparedAppointments >= 180 ? "Likely for chronic clinics." : "Only selectively."}
- Would investors fund it? ${summary.activeRate >= 65 && summary.labReport.estimatedRevisitRate >= 35 ? "Possibly, if real pilots validate the simulated retention loop." : "Not without stronger proof."}

## Week 1 Founder Report

${Object.entries(weekly[0].founderReport).map(([key, value]) => `- ${key}: ${value}`).join("\n")}
`;
}

function markdownWeeklyReports(weekly) {
  return `# Weekly Board Reports

${weekly
  .map(
    (week) => `## Week ${week.week}

- Patient: ${week.patientReport}
- Doctor: ${week.doctorReport}
- Lab: ${week.labReport}
- Hospital: ${week.hospitalReport}
- Investor: ${week.investorReport}
- Founder remove: ${week.founderReport.remove}
- Founder merge: ${week.founderReport.merge}
- Founder redesign: ${week.founderReport.redesign}
- Founder retention: ${week.founderReport.retention}
- Founder moat: ${week.founderReport.moat}
`,
  )
  .join("\n")}
`;
}

function markdownDestroyer(summary) {
  return `# Destroyer Agent Report

This agent is designed to attack the product assumptions.

${destroyerReport(summary).map((item) => `- ${item}`).join("\n")}

## Hard Verdict

- Active after 12 months: ${summary.activeAt12Months}/100
- Abandoned: ${summary.abandoned}/100
- Average Health Brief score: ${summary.averageBriefScore}/100
- Main failure mode: ${Object.entries(summary.abandonmentReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || "No dominant failure mode"}

## What This Means

SehatSaathi should not assume report understanding creates habit. Habit appears when new reports, family involvement, symptoms, or appointment preparation create a reason to return.
`;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const personas = Array.from({ length: 100 }, (_, index) => makePersona(index));
  const simulations = personas.map(simulatePersona);
  const summary = aggregate(simulations);
  const weekly = weeklyReports(simulations);
  const payload = {
    generatedAt: new Date().toISOString(),
    premise: "Synthetic life simulation: 100 realistic chronic/preventive health users living with SehatSaathi for 12 months.",
    summary,
    simulations,
    weeklyReports: weekly,
    destroyerReport: destroyerReport(summary),
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "simulation.json"), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "board-report.md"), markdownSummary(summary, simulations, weekly));
  fs.writeFileSync(path.join(OUTPUT_DIR, "weekly-board-reports.md"), markdownWeeklyReports(weekly));
  fs.writeFileSync(path.join(OUTPUT_DIR, "destroyer-report.md"), markdownDestroyer(summary));
  console.log(`Synthetic life simulation complete: ${OUTPUT_DIR}`);
  console.log(`Active at 12 months: ${summary.activeAt12Months}/100`);
  console.log(`Average brief score: ${summary.averageBriefScore}/100`);
}

main();
