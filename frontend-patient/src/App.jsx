import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  computeProfileCompletion,
  sortLabs,
  sortPharmacies,
  formatMarketplaceStatus as formatMarketplaceStatusLabel,
  normalizeHospitalContent,
  normalizeLabListings,
  normalizePharmacyListings,
} from "./patientOpsUtils";
import {
  resolveApiBase,
  MARKETPLACE_REFRESH_KEY,
  defaultProfileForm,
  copy,
  commonSymptoms,
  redFlagOptions,
  dentalSymptomsOptions,
  dentalRedFlagOptions,
  symptomTranslations,
  fallbackTriage,
} from "./patientOpsConfig";
import { useProfileSectionActions } from "./hooks/useProfileSectionActions";
import { useTriageSectionActions } from "./hooks/useTriageSectionActions";
import { PatientHomePanel } from "./components/patient-shell/PatientHomePanel";
import { AppointmentsPanel } from "./components/patient-shell/AppointmentsPanel";
import { AlertsPanel } from "./components/patient-shell/AlertsPanel";
import { SettingsPanel } from "./components/patient-shell/SettingsPanel";
import { ReportsPanel } from "./components/patient-shell/ReportsPanel";
import { ActionsPanel } from "./components/patient-shell/ActionsPanel";
import { HelpAndFeedbackSheet } from "./components/patient-shell/HelpAndFeedbackSheet";
import { ProfileEditModal } from "./components/profile/ProfileEditModal";
import { ProfileInlineEditor } from "./components/profile/ProfileInlineEditor";
import { GuestLanding } from "./components/routes/GuestLanding";

const MarketplaceView = lazy(() => import("./components/marketplace/MarketplaceView").then((m) => ({ default: m.MarketplaceView })));
const HospitalContentView = lazy(() => import("./components/hospital-content/HospitalContentView").then((m) => ({ default: m.HospitalContentView })));
const AppointmentDetailModal = lazy(() => import("./components/patient-shell/AppointmentDetailModal").then((m) => ({ default: m.AppointmentDetailModal })));
const TeleconsultRoomModal = lazy(() => import("./components/patient-shell/TeleconsultRoomModal").then((m) => ({ default: m.TeleconsultRoomModal })));
const TriagePanel = lazy(() => import("./components/patient-shell/TriagePanel").then((m) => ({ default: m.TriagePanel })));
const ClinicalRecordsPanel = lazy(() => import("./components/patient-shell/ClinicalRecordsPanel").then((m) => ({ default: m.ClinicalRecordsPanel })));
const HealthTimelinePanel = lazy(() => import("./components/patient-shell/HealthTimelinePanel").then((m) => ({ default: m.HealthTimelinePanel })));
const ClinicPage = lazy(() => import("./components/routes/ClinicPage").then((m) => ({ default: m.ClinicPage })));
const ResetPasswordPage = lazy(() => import("./components/routes/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const EmergencyCardPage = lazy(() => import("./components/routes/EmergencyCardPage").then((m) => ({ default: m.EmergencyCardPage })));
const DoctorViewPage = lazy(() => import("./components/routes/DoctorViewPage").then((m) => ({ default: m.DoctorViewPage })));
const DoctorConsolePage = lazy(() => import("./components/routes/DoctorConsolePage").then((m) => ({ default: m.DoctorConsolePage })));
const LegacyPortalShell = lazy(() => import("./components/routes/LegacyPortalShell").then((m) => ({ default: m.LegacyPortalShell })));
const LaunchCampaignPage = lazy(() => import("./components/routes/LaunchCampaignPage").then((m) => ({ default: m.LaunchCampaignPage })));
import { useLang, LANGUAGES } from "./i18n.js";

const API_BASE = resolveApiBase();
let razorpayScriptPromise = null;

const ensureRazorpayScript = () => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAINTENANCE_PLAN_PREVIEW = {
  "goal:steady": {
    title: "Stable routine plan",
    focusTitle: "Steady",
    focusSummary: "Your reports look steady, so use this week to keep the basics easy to review.",
  },
  "goal:energy": {
    title: "Energy stability plan",
    focusTitle: "Energy",
    focusSummary: "Use this week to keep energy and recovery easy to notice.",
  },
  "goal:sleep": {
    title: "Sleep stability plan",
    focusTitle: "Sleep",
    focusSummary: "A calm sleep rhythm can make the rest of the week easier to follow.",
  },
  "goal:sugar": {
    title: "Sugar stability plan",
    focusTitle: "Sugar",
    focusSummary: "Sugar looks like the clearest goal, so keep the plan simple and repeatable.",
  },
  "goal:cholesterol": {
    title: "Heart health plan",
    focusTitle: "Cholesterol",
    focusSummary: "Cholesterol is the clearest goal, so keep the week focused and realistic.",
  },
  "goal:weight": {
    title: "Weight rhythm plan",
    focusTitle: "Weight",
    focusSummary: "Weight is the clearest goal, so keep the week practical and easy to repeat.",
  },
  "goal:stress": {
    title: "Calm week plan",
    focusTitle: "Stress",
    focusSummary: "Stress feels like the clearest goal, so keep the routine simple and grounded.",
  },
};

const resolveHealthPlanFocusKey = (reportInsights, selectedFocusKey = "") => {
  const chosen = String(selectedFocusKey || "").trim().toLowerCase();
  const summaries = reportInsights?.conditionSummaries || [];
  const issueFocuses = reportInsights?.healthIssues?.abnormal || [];
  const goalToCondition = {
    "goal:sugar": "diabetes",
    "goal:cholesterol": "lipid",
    "goal:energy": "anemia",
    "goal:weight": "anthropometry",
  };
  if (goalToCondition[chosen] && issueFocuses.some((item) => String(item.focusKey || "").trim().toLowerCase() === goalToCondition[chosen])) {
    return goalToCondition[chosen];
  }
  if (chosen.startsWith("goal:")) return chosen;
  if (
    chosen &&
    issueFocuses.some((item) => String(item.focusKey || "").trim().toLowerCase() === chosen)
  ) {
    return chosen;
  }
  if (
    chosen &&
    summaries.some((item) => String(item.key || "").trim().toLowerCase() === chosen && (item.zone === "high" || item.zone === "low"))
  ) {
    return chosen;
  }
  return (
    issueFocuses[0]?.focusKey ||
    summaries.find((item) => item.zone === "high")?.key ||
    summaries.find((item) => item.zone === "low")?.key ||
    "goal:steady"
  );
};

const buildHealthPlanPreview = (reportInsights, focusKey) => {
  const normalizedFocusKey = String(focusKey || "").trim().toLowerCase();
  const issue = (reportInsights?.healthIssues?.abnormal || []).find((item) => String(item.focusKey || "").trim().toLowerCase() === normalizedFocusKey);
  if (issue) {
    const otherIssues = (reportInsights?.healthIssues?.abnormal || []).filter((item) => String(item.focusKey || "").trim().toLowerCase() !== normalizedFocusKey);
    const otherIssueCount = otherIssues.length;
    const otherLabels = otherIssues
      .slice(0, 2)
      .map((item) => item.focusLabel || item.parameter)
      .filter(Boolean)
      .join(" and ");
    return {
      title: otherIssueCount ? "Connected follow-up plan" : `${issue.focusLabel || issue.parameter} follow-up plan`,
      focusTitle: issue.focusLabel || issue.parameter || "Focused follow-up",
      focusSummary: otherIssueCount
        ? `${issue.parameter} is one of the findings worth reviewing first. The plan also keeps ${otherLabels || `${otherIssueCount} other area${otherIssueCount === 1 ? "" : "s"}`} visible so the full report stays in view.`
        : `${issue.parameter} is the clearest follow-up area to keep visible first.`,
    };
  }
  const summaries = reportInsights?.conditionSummaries || [];
  const condition = summaries.find((item) => String(item.key || "").trim().toLowerCase() === normalizedFocusKey);
  if (condition) {
    return {
      title: `${condition.title || "Focused"} action plan`,
      focusTitle: condition.title || "Focused",
      focusSummary: condition.summary || "Use this week to keep the report story easy to review.",
    };
  }
  if (MAINTENANCE_PLAN_PREVIEW[normalizedFocusKey]) {
    return MAINTENANCE_PLAN_PREVIEW[normalizedFocusKey];
  }
  return MAINTENANCE_PLAN_PREVIEW["goal:steady"];
};

const deriveNextCheckIn = ({ completedToday, taskCount }) => {
  const now = new Date();
  const hour = now.getHours();
  if (completedToday >= taskCount && taskCount > 0) {
    return {
      label: "Tomorrow, 8:00 AM",
      detail: "You can add another short update tomorrow if useful.",
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
  return {
    label: "Tonight, 8:30 PM",
    detail: "You can add another short update later if useful.",
  };
};

function PatientShellIcon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "patient-shell-svg",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  /* Clean, minimal icon set — Apple Health / Linear inspired */
  const icons = {
    /* Today: simple home with roof line */
    home: (
      <>
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5 10v9.5h5.5v-5h3v5H19V10" />
      </>
    ),
    /* Reports: document with lines */
    records: (
      <>
        <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V7l-4.5-3.5Z" />
        <path d="M14 3.5V7H17.5M9 12h6M9 15.5h4" />
      </>
    ),
    /* Actions: pen writing a note */
    plan: (
      <>
        <path d="M12 20.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5h7.5L19.5 9V13" />
        <path d="M13.5 3.5V9H19.5" />
        <path d="M16 17l1.5-1.5L19 17l-3.5 3.5H14V19l2-2Z" />
      </>
    ),
    /* Profile: person with circle */
    profile: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      </>
    ),
    /* Fallbacks */
    visits: (
      <>
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
        <path d="M8 4v3M16 4v3M4.5 10.5h15" />
      </>
    ),
    triage: (
      <>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8.5v7M8.5 12h7" />
      </>
    ),
    alerts: (
      <>
        <path d="M8.5 17.5h7" />
        <path d="M6.5 15.5h11l-1.1-1.7a3.2 3.2 0 0 1-.5-1.7V10a3.9 3.9 0 1 0-7.8 0v2.1c0 .6-.2 1.2-.5 1.7L6.5 15.5Z" />
      </>
    ),
    hospital: (
      <>
        <path d="M6.5 19.5V7.5h11v12M3.5 19.5h17" />
        <path d="M10.5 10h3M12 8.5v3" />
      </>
    ),
  };

  return <svg {...common}>{icons[name] || icons.home}</svg>;
}

function AppSectionFallback({ compact = false }) {
  const { t } = useLang();
  return (
    <div className={`panel patient-loading-panel ${compact ? "is-compact" : ""}`}>
      <div className="patient-loading-mark" aria-hidden="true">
        <div className="logo-mark">
          <img src="/sehatsaathi-logo.jpg" alt="SehatSaathi logo" />
        </div>
      </div>
      <p className="history-headline">{t("loading_app")}</p>
      <p className="micro">{t("preparing_workspace")}</p>
    </div>
  );
}

function App() {
  const { lang: language, switchLang: setLanguage, t: productT } = useLang();
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [activePatientTab, setActivePatientTab] = useState("home");

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);
  const [appointmentsViewTab, setAppointmentsViewTab] = useState("future");
  const [authToken, setAuthToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showTriageDisclaimer, setShowTriageDisclaimer] = useState(false);
  const [showPatientOnboarding, setShowPatientOnboarding] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [resetForm, setResetForm] = useState({
    email: "",
    token: "",
    newPassword: "",
  });
  const [resetStatus, setResetStatus] = useState("");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersStatus, setAdminUsersStatus] = useState("");
  const [adminSavingUserId, setAdminSavingUserId] = useState(null);
  const [adminOps, setAdminOps] = useState(null);
  const [adminOpsStatus, setAdminOpsStatus] = useState("");
  const [opsQueue, setOpsQueue] = useState([]);
  const [opsQueueStatus, setOpsQueueStatus] = useState("");
  const [billingDrafts, setBillingDrafts] = useState({});

  const [profileForm, setProfileForm] = useState(defaultProfileForm());
  const [profileStatus, setProfileStatus] = useState("");
  const [abhaHistory, setAbhaHistory] = useState([]);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const mapProfilePayloadToForm = (profile = {}, account = user) => ({
    fullName: profile.name || account?.name || "",
    email: profile.email || account?.email || "",
    age: profile.age || "",
    weightKg: profile.weight_kg || "",
    heightCm: profile.height_cm || "",
    sex: String(profile.sex || "").trim().toLowerCase(),
    conditions: (profile.conditions || []).join(", "),
    allergies: (profile.allergies || []).join(", "),
    medications: Array.isArray(profile.medications) ? profile.medications.join(", ") : profile.medications || "",
    region: profile.region || "",
    phone: profile.phone || "",
    abhaNumber: profile.abha_number || "",
    abhaAddress: profile.abha_address || "",
    abhaStatus: profile.abha_status || "not_linked",
    aadhaarNo: profile.aadhaar_no || "",
    maritalStatus: profile.marital_status || "",
    dateOfBirth: profile.date_of_birth || "",
    bloodGroup: profile.blood_group || "",
    addressLine1: profile.address_line_1 || profile.address || "",
    addressLine2: profile.address_line_2 || "",
    city: profile.city || "",
    state: profile.state || "",
    country: profile.country || "India",
    pinCode: profile.pin_code || "",
    visitTime: profile.visit_time || "OPD",
    unitDepartmentId: profile.unit_department_id ? String(profile.unit_department_id) : "",
    unitDoctorId: profile.unit_doctor_id ? String(profile.unit_doctor_id) : "",
  });

  const [triageForm, setTriageForm] = useState({
    age: "",
    sex: "Female",
    durationDays: 0,
    severity: 0,
    symptoms: [],
    additionalSymptoms: "",
    redFlags: [],
    photoFile: null,
    photoPreview: "",
  });
  const [triageType, setTriageType] = useState("general");
  const [dentalForm, setDentalForm] = useState({
    durationDays: 0,
    painScale: 0,
    symptoms: [],
    redFlags: [],
    hotColdTrigger: false,
    swelling: false,
  });

  const [triageResult, setTriageResult] = useState(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [sharePass, setSharePass] = useState(null);
  const [sharePassStatus, setSharePassStatus] = useState("");
  const [doctorViewData, setDoctorViewData] = useState(null);
  const [doctorViewLoading, setDoctorViewLoading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [doctorRatingStatus, setDoctorRatingStatus] = useState("");
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [activeMemberId, setActiveMemberId] = useState(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    relation: "",
    age: "",
    sex: "Female",
    bloodType: "",
    conditions: "",
    allergies: "",
  });
  const [familyStatus, setFamilyStatus] = useState("");
  const [records, setRecords] = useState([]);
  const [recordStatus, setRecordStatus] = useState("");
  const [reportCatalog, setReportCatalog] = useState([]);
  const [reportExtractionCapabilities, setReportExtractionCapabilities] = useState(null);
  const [reportInsights, setReportInsights] = useState(null);
  const [reportInsightsStatus, setReportInsightsStatus] = useState("");
  const [reportInsightsMonths, setReportInsightsMonths] = useState(6);
  const [healthPlanHomeSummary, setHealthPlanHomeSummary] = useState(null);
  const [healthPlanActivity, setHealthPlanActivity] = useState([]);
  const [healthContinuityAgent, setHealthContinuityAgent] = useState(null);
  const [selectedPlanFocusKey, setSelectedPlanFocusKey] = useState("");
  const [recordAnalysisDrafts, setRecordAnalysisDrafts] = useState({});
  const [activeAnalysisRecordId, setActiveAnalysisRecordId] = useState(null);
  const [shareHistory, setShareHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [policyBundle, setPolicyBundle] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState({
    dailyReminderTime: "08:00",
    planReminders: true,
    followupNudges: true,
    visitReminders: true,
    labReminders: true,
  });
  const [notificationSettingsStatus, setNotificationSettingsStatus] = useState("");
  const [supportRequests, setSupportRequests] = useState([]);
  const [supportRequestDraft, setSupportRequestDraft] = useState({
    category: "general",
    severity: "normal",
    subject: "",
    message: "",
  });
  const [supportRequestStatus, setSupportRequestStatus] = useState("");
  const [privacyActionStatus, setPrivacyActionStatus] = useState("");
  const [teleconsults, setTeleconsults] = useState([]);
  const [teleLoading, setTeleLoading] = useState(false);
  const [teleStatus, setTeleStatus] = useState("");
  const [teleForm, setTeleForm] = useState({
    mode: "video",
    concern: "",
    preferredSlot: "",
    phone: "",
  });
  const [careRequestMode, setCareRequestMode] = useState("in_person");
  const [activeConsultId, setActiveConsultId] = useState(null);
  const [consultMessages, setConsultMessages] = useState([]);
  const [consultMessageText, setConsultMessageText] = useState("");
  const [consultConsentSummary, setConsultConsentSummary] = useState(null);
  const [consultMessageStatus, setConsultMessageStatus] = useState("");
  const [paymentGatewayConfig, setPaymentGatewayConfig] = useState({ enabled: false, provider: "razorpay", keyId: "" });
  const [consultPaymentStatus, setConsultPaymentStatus] = useState("");
  const [paymentLoadingKey, setPaymentLoadingKey] = useState("");
  const [teleconsultRoomOpen, setTeleconsultRoomOpen] = useState(false);
  const [doctorConsoleForm, setDoctorConsoleForm] = useState({
    status: "requested",
    meetingUrl: "",
  });
  const [doctorConsoleStatus, setDoctorConsoleStatus] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [appointmentsStatus, setAppointmentsStatus] = useState("");
  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const [appointmentTimeline, setAppointmentTimeline] = useState([]);
  const [appointmentActionStatus, setAppointmentActionStatus] = useState("");
  const [appointmentRescheduleForm, setAppointmentRescheduleForm] = useState({
    scheduledAt: "",
    reason: "",
  });
  const [departments, setDepartments] = useState([]);
  const [departmentDoctors, setDepartmentDoctors] = useState([]);
  const [profileDepartmentDoctors, setProfileDepartmentDoctors] = useState([]);
  const [appointmentForm, setAppointmentForm] = useState({
    departmentId: "",
    doctorId: "",
    reason: "",
    appointmentDate: "",
    slotTime: "",
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotStatus, setSlotStatus] = useState("");
  const [encounters, setEncounters] = useState([]);
  const [encounterStatus, setEncounterStatus] = useState("");
  const [activeEncounterId, setActiveEncounterId] = useState(null);
  const [encounterDetail, setEncounterDetail] = useState(null);
  const [labMode, setLabMode] = useState("home");
  const [labArea, setLabArea] = useState("all");
  const [labAreas, setLabAreas] = useState([]);
  const [activeLabId, setActiveLabId] = useState(null);
  const [labSort, setLabSort] = useState("cheapest");
  const [labAreaSearch, setLabAreaSearch] = useState("");
  const [pharmacyMode, setPharmacyMode] = useState("home_delivery");
  const [pharmacySort, setPharmacySort] = useState("fastest");
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [labListings, setLabListings] = useState([]);
  const [pharmacyListings, setPharmacyListings] = useState([]);
  const [marketplaceRequests, setMarketplaceRequests] = useState([]);
  const [marketplaceAnalytics, setMarketplaceAnalytics] = useState({
    overall: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
    lab: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
    pharmacy: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
  });
  const [marketplaceTimelineByRequest, setMarketplaceTimelineByRequest] = useState({});
  const [marketplaceTimelineLoadingByRequest, setMarketplaceTimelineLoadingByRequest] = useState({});
  const [marketplaceTimelineOpenByRequest, setMarketplaceTimelineOpenByRequest] = useState({});
  const [marketplaceStatus, setMarketplaceStatus] = useState("");
  const [marketplaceActionStatus, setMarketplaceActionStatus] = useState("");
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [labRequestsView, setLabRequestsView] = useState("future");
  const [pharmacyRequestsView, setPharmacyRequestsView] = useState("future");
  const [hospitalContent, setHospitalContent] = useState(null);
  const [hospitalContentStatus, setHospitalContentStatus] = useState('');
  const [activeHospitalSection, setActiveHospitalSection] = useState("updates");
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [pendingActionQueue, setPendingActionQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [doctorChartForm, setDoctorChartForm] = useState({
    appointmentId: "",
    chiefComplaint: "",
    findings: "",
    diagnosis: "",
    planText: "",
    followupDate: "",
    vitals: "",
  });
  const [doctorChartStatus, setDoctorChartStatus] = useState("");
  const [scheduleForm, setScheduleForm] = useState([
    { weekday: 1, startTime: "10:00", endTime: "13:00", slotMinutes: 20 },
    { weekday: 2, startTime: "10:00", endTime: "13:00", slotMinutes: 20 },
    { weekday: 3, startTime: "10:00", endTime: "13:00", slotMinutes: 20 },
    { weekday: 4, startTime: "10:00", endTime: "13:00", slotMinutes: 20 },
    { weekday: 5, startTime: "10:00", endTime: "13:00", slotMinutes: 20 },
  ]);
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [noteForm, setNoteForm] = useState({ note: "", signature: "" });
  const [prescriptionForm, setPrescriptionForm] = useState({
    instructions: "",
    itemsText: "",
  });
  const [orderForm, setOrderForm] = useState({
    orderType: "lab",
    itemName: "",
    destination: "",
    notes: "",
  });
  const [clinicCode, setClinicCode] = useState("");
  const [clinicStatus, setClinicStatus] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [shareQr, setShareQr] = useState("");
  const [emergencyCard, setEmergencyCard] = useState(null);
  const [doctorLang, setDoctorLang] = useState("en");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [liveStats, setLiveStats] = useState({
    users: 0,
    triageCompleted: 0,
    doctorViews: 0,
    activeUsersToday: 0,
  });
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I can help with symptoms, triage steps, and what to do before clinic visits.",
    },
  ]);
  const [triageHistoryQuery, setTriageHistoryQuery] = useState("");
  const [triageHistoryLevel, setTriageHistoryLevel] = useState("all");
  const [triageDraftStatus, setTriageDraftStatus] = useState("");
  const [sharePasses, setSharePasses] = useState([]);
  const [sharePassExpiresMinutes, setSharePassExpiresMinutes] = useState(30);
  const [profileWizardStep, setProfileWizardStep] = useState(1);
  const [uiToast, setUiToast] = useState(null);

  const currentPath = useMemo(() => window.location.pathname.replace(/\/+$/, "") || "/", []);
  const redirectToOpsLabDesk = useCallback(() => {
    if (typeof window === "undefined") return;
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "localhost";
    const target = `${protocol}//${host}:5174/lab-console`;
    if (window.location.href !== target) {
      window.location.replace(target);
    }
  }, []);
  const doctorCode = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "doctor-view" && parts[1]) return parts[1];
    return null;
  }, []);
  const clinicMode = useMemo(() => currentPath === "/clinic", [currentPath]);
  const launchCampaignMode = useMemo(() => currentPath === "/launch", [currentPath]);
  const doctorConsoleMode = useMemo(
    () =>
      currentPath === "/doctor-console" ||
      currentPath === "/doctor-dashboard" ||
      currentPath === "/lab-console" ||
      currentPath === "/lab-dashboard",
    [currentPath],
  );
  const labConsoleMode = useMemo(
    () => currentPath === "/lab-console" || currentPath === "/lab-dashboard",
    [currentPath],
  );
  const resetPasswordPageMode = useMemo(() => currentPath === "/reset-password", [currentPath]);
  const emergencyPublicId = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "emergency" && parts[1]) return parts[1];
    return null;
  }, []);
  const [emergencyData, setEmergencyData] = useState(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const clinicVideoRef = useRef(null);
  const scannerStreamRef = useRef(null);
  const scannerIntervalRef = useRef(null);
  const recordsInputRef = useRef(null);
  const refreshInFlightRef = useRef(null);
  const latestRefreshTokenRef = useRef("");
  const latestAuthTokenRef = useRef("");

  useEffect(() => {
    latestRefreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    latestAuthTokenRef.current = authToken;
  }, [authToken]);

  const clearAuthState = useCallback((options = {}) => {
    const { keepAuthError = false } = options;
    refreshInFlightRef.current = null;
    latestRefreshTokenRef.current = "";
    latestAuthTokenRef.current = "";
    setAuthToken("");
    setRefreshToken("");
    setSessionId("");
    setUser(null);
    if (!keepAuthError) {
      setAuthError("");
    }
    localStorage.removeItem("health_user");
    localStorage.removeItem("health_token");
    localStorage.removeItem("health_refresh_token");
    localStorage.removeItem("health_session_id");
  }, []);

  const persistAuthSession = useCallback((payload = {}) => {
    if (payload.user) {
      setUser(payload.user);
      localStorage.setItem("health_user", JSON.stringify(payload.user));
    }
    if (payload.token) {
      setAuthToken(payload.token);
      latestAuthTokenRef.current = payload.token;
      localStorage.setItem("health_token", payload.token);
    }
    if (payload.refreshToken) {
      setRefreshToken(payload.refreshToken);
      latestRefreshTokenRef.current = payload.refreshToken;
      localStorage.setItem("health_refresh_token", payload.refreshToken);
    }
    if (payload.sessionId) {
      const nextSessionId = String(payload.sessionId);
      setSessionId(nextSessionId);
      localStorage.setItem("health_session_id", nextSessionId);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");
    const requestedAuthMode = params.get("mode");
    const resetEmail = params.get("email");
    const resetToken = params.get("token") || params.get("otp");
    if (requestedAuthMode === "signup" || requestedAuthMode === "login") {
      setAuthMode(requestedAuthMode);
    }
    if (lang === "gu" || lang === "en") {
      setLanguage(lang);
      setDoctorLang(lang);
    }
    if (resetEmail || resetToken) {
      setResetForm((prev) => ({
        ...prev,
        email: resetEmail || prev.email,
        token: resetToken || prev.token,
      }));
    }
    setScannerSupported(
      Boolean(window.BarcodeDetector) && Boolean(navigator?.mediaDevices?.getUserMedia),
    );
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("health_triage_draft");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.triageForm) {
        setTriageForm((prev) => ({
          ...prev,
          ...parsed.triageForm,
          photoFile: null,
          photoPreview: "",
        }));
      }
      if (parsed?.dentalForm) {
        setDentalForm((prev) => ({ ...prev, ...parsed.dentalForm }));
      }
      if (parsed?.triageType) setTriageType(parsed.triageType);
    } catch (error) {
      // ignore corrupted draft
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("health_pending_actions");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPendingActionQueue(parsed);
      }
    } catch (error) {
      // ignore invalid queue payload
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("health_pending_actions", JSON.stringify(pendingActionQueue));
  }, [pendingActionQueue]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      setShowOfflineBanner(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowOfflineBanner(true), 4000);
    return () => window.clearTimeout(timer);
  }, [isOnline]);

  useEffect(() => {
    const payload = {
      triageForm: {
        age: triageForm.age,
        sex: triageForm.sex,
        durationDays: triageForm.durationDays,
        severity: triageForm.severity,
        symptoms: triageForm.symptoms,
        additionalSymptoms: triageForm.additionalSymptoms,
        redFlags: triageForm.redFlags,
      },
      dentalForm,
      triageType,
    };
    localStorage.setItem("health_triage_draft", JSON.stringify(payload));
  }, [triageForm, dentalForm, triageType]);

  useEffect(() => {
    const saved = localStorage.getItem("health_user");
    const savedToken = localStorage.getItem("health_token");
    const savedRefreshToken = localStorage.getItem("health_refresh_token");
    const savedSessionId = localStorage.getItem("health_session_id");
    if (saved && (savedToken || savedRefreshToken)) {
      try {
        setUser(JSON.parse(saved));
      } catch (error) {
        localStorage.removeItem("health_user");
      }
    } else if (saved) {
      localStorage.removeItem("health_user");
    }
    if (savedToken) {
      setAuthToken(savedToken);
      latestAuthTokenRef.current = savedToken;
    }
    if (savedRefreshToken) {
      setRefreshToken(savedRefreshToken);
      latestRefreshTokenRef.current = savedRefreshToken;
    }
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
    const accepted = localStorage.getItem("health_disclaimer_accepted");
    if (!accepted) {
      setShowDisclaimer(true);
    }
    loadPolicyBundle();
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const validateSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          const refreshedToken = await refreshAccessToken();
          if (!refreshedToken) throw new Error("invalid");
          const retry = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${refreshedToken}` },
          });
          if (!retry.ok) throw new Error("invalid");
          const retryData = await retry.json();
          if (active && retryData.user) {
            persistAuthSession({ user: retryData.user });
          }
          return;
        }
        const data = await response.json();
        if (active && data.user) {
          persistAuthSession({ user: data.user });
        }
      } catch (error) {
        if (active) {
          clearAuthState({ keepAuthError: true });
        }
      }
    };
    validateSession();
    return () => {
      active = false;
    };
  }, [authToken, refreshToken, clearAuthState, persistAuthSession]);

  const t = useCallback((key, vars = {}) => {
    const productValue = productT(key, vars);
    if (productValue !== key) return productValue;
    let legacyValue = copy[language]?.[key] || copy.en[key] || key;
    if (typeof legacyValue === "string") {
      Object.entries(vars).forEach(([name, value]) => {
        legacyValue = legacyValue.split(`{${name}}`).join(String(value));
      });
    }
    return legacyValue;
  }, [language, productT]);
  const formatNumber = (value) => new Intl.NumberFormat(language === "gu" ? "gu-IN" : "en-IN").format(value || 0);
  const formatPriceLastUpdated = (value) => {
    if (!value) return "N/A";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "N/A";
    return dt.toLocaleDateString();
  };
  const translateSymptom = (label) =>
    symptomTranslations[language]?.[label] || label;
  const format = (text, params = {}) =>
    text.replace(/\{(\w+)\}/g, (_, key) => params[key] || "");
  const teleStatusLabel = (status) => {
    const map = {
      requested: t("teleStatusRequested"),
      scheduled: t("teleStatusScheduled"),
      in_progress: t("teleStatusInProgress"),
      completed: t("teleStatusCompleted"),
      cancelled: t("teleStatusCancelled"),
    };
    return map[status] || status;
  };
  const weekdayLabel = (weekday) =>
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] ||
    String(weekday);
  const formatMarketplaceStatus = formatMarketplaceStatusLabel;
  const formatFulfillmentTime = (minutes) => {
    const value = Number(minutes || 0);
    if (!value) return "-";
    if (value < 60) return `${value} min`;
    const h = Math.floor(value / 60);
    const m = value % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };
  const formatMarketplaceTimelineEvent = (event = {}) => {
    if (event.fromStatus && event.toStatus) {
      return `${formatMarketplaceStatus(event.fromStatus)} -> ${formatMarketplaceStatus(event.toStatus)}`;
    }
    if (event.toStatus) return formatMarketplaceStatus(event.toStatus);
    if (event.eventType === "created") return "Request created";
    return String(event.eventType || "Updated");
  };
  const isNetworkLikeError = (error) => {
    const message = String(error?.message || "");
    return (
      (typeof navigator !== "undefined" && navigator.onLine === false) ||
      error?.name === "TypeError" ||
      error?.code === "NETWORK_RETRY_FAILED" ||
      /network|fetch|failed to fetch|load failed|connection|offline/i.test(message)
    );
  };
  const isTimeoutLikeError = (value) => /timeout|timed out|gateway timeout|408|504/i.test(String(value || ""));
  const humanizeAsyncIssue = (value, fallback, options = {}) => {
    const message = String(value || "");
    if (options.cancelMessage && /cancel/i.test(message)) {
      return options.cancelMessage;
    }
    if (isTimeoutLikeError(message)) {
      return options.timeoutMessage || "This is taking longer than expected. Please try again shortly.";
    }
    if (/extract|ocr|parse|unsupported|could not read|unable to read|no text/i.test(message)) {
      return options.extractionMessage || "We could not read enough report data from that file. Try a clearer PDF or image.";
    }
    if (isNetworkLikeError({ message })) {
      return options.networkMessage || "Your connection was interrupted. Please try again.";
    }
    return message || fallback;
  };
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.listedPrice || 0), 0),
    [cartItems],
  );
  const enqueuePendingAction = (action) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setPendingActionQueue((prev) => [...prev, { ...action, id, createdAt: new Date().toISOString() }]);
  };
  const removePendingAction = (actionId) => {
    setPendingActionQueue((prev) => prev.filter((item) => item.id !== actionId));
  };
  const addToCart = (item) => {
    setCartItems((prev) => [
      ...prev,
      {
        ...item,
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      },
    ]);
    setUiToast({
      tone: "success",
      message: `${item.serviceName || "Item"} added to cart`,
    });
  };
  const removeCartItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };
  const checkoutCart = async () => {
    if (!authToken) {
      setCheckoutStatus("Sign in first.");
      return;
    }
    if (!cartItems.length) {
      setCheckoutStatus("Your cart is empty.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutStatus("");
    try {
      for (const item of cartItems) {
        const response = await apiFetch(`${API_BASE}/api/marketplace/requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: item.requestType,
            partnerId: item.partnerId,
            serviceName: item.serviceName,
            fulfillmentMode: item.fulfillmentMode,
            listedPrice: item.listedPrice,
            notes: [item.notes, checkoutAddress ? `Address: ${checkoutAddress}` : "", checkoutNotes]
              .filter(Boolean)
              .join(" • "),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to place order.");
        }
      }

      await trackAnalyticsEvent("lab_booked", {
        itemCount: cartItems.length,
        totalPrice: cartTotal,
        requestTypes: Array.from(new Set(cartItems.map((item) => item.requestType).filter(Boolean))),
        fulfillmentModes: Array.from(new Set(cartItems.map((item) => item.fulfillmentMode).filter(Boolean))),
      });
      setCheckoutStatus("Orders placed successfully.");
      setUiToast({ tone: "success", message: "Order placed successfully" });
      setCartItems([]);
      setCheckoutAddress("");
      setCheckoutNotes("");
      setCartOpen(false);
      await Promise.all([loadMarketplaceRequests(), loadMarketplaceAnalytics()]);
    } catch (error) {
      if (isNetworkLikeError(error)) {
        cartItems.forEach((item) => {
          enqueuePendingAction({
            type: "marketplace_request",
            idempotencyKey: `cart-${item.id}`,
            payload: {
              requestType: item.requestType,
              partnerId: item.partnerId,
              serviceName: item.serviceName,
              fulfillmentMode: item.fulfillmentMode,
              listedPrice: item.listedPrice,
              notes: [item.notes, checkoutAddress ? `Address: ${checkoutAddress}` : "", checkoutNotes].filter(Boolean).join(" • "),
            },
          });
        });
        setCheckoutStatus("Connection dropped. Your order request was saved and will retry automatically when you are back online.");
        setUiToast({ tone: "success", message: "Order saved for automatic retry" });
        setCartItems([]);
        setCartOpen(false);
      } else {
        const message = humanizeAsyncIssue(error?.message, "Unable to place order.");
        await trackDropOff("lab_booking", {
          stage: "checkout",
          reason: error?.message || "checkout_failed",
          itemCount: cartItems.length,
        });
        setCheckoutStatus(message);
        setUiToast({ tone: "error", message });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };
  const renderLabBookingActions = (lab, item) => (
    <div className="action-row">
      {item.homeCollectionAvailable && (
        <button
          className="secondary"
          type="button"
          onClick={() =>
            addToCart({
              requestType: "lab",
              partnerId: lab.id,
              partnerName: lab.partnerName,
              serviceName: item.serviceName,
              fulfillmentMode: "home_visit",
              listedPrice: item.homeVisitPrice !== null ? item.homeVisitPrice : item.price,
              notes: `${lab.partnerName} • ${item.serviceName} • home collection`,
            })
          }
        >
          Add home visit • Rs {item.homeVisitPrice !== null ? item.homeVisitPrice : item.price}
        </button>
      )}
      <button
        className="primary"
        type="button"
        onClick={() =>
          addToCart({
            requestType: "lab",
            partnerId: lab.id,
            partnerName: lab.partnerName,
            serviceName: item.serviceName,
            fulfillmentMode: "in_person",
            listedPrice: item.price,
            notes: `${lab.partnerName} • ${item.serviceName} • in-person`,
          })
        }
      >
        Add in-person • Rs {item.price}
      </button>
    </div>
  );

  const profileCompletion = useMemo(() => computeProfileCompletion(profileForm), [profileForm]);
  const isOpsUser = user?.role === "admin" || user?.role === "front_desk";
  const profileSummary = user
    ? format(t("safetySummaryAuthed"), { name: user.name || "User" })
    : t("safetySummary");

  const lastGuidance = history.length > 0 ? history[0] : null;
  const visibleHistory = historyExpanded ? history : history.slice(0, 3);
  const activeConsult = useMemo(
    () => teleconsults.find((consult) => consult.id === activeConsultId) || null,
    [teleconsults, activeConsultId],
  );
  const nowTs = Date.now();
  const requestedAppointments = useMemo(
    () =>
      appointments.filter((appointment) => String(appointment.status || "").toLowerCase() === "requested"),
    [appointments],
  );
  const futureAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const at = Date.parse(appointment.scheduled_at || "");
        return (
          !Number.isNaN(at) &&
          at >= nowTs &&
          ["approved", "checked_in"].includes(String(appointment.status || "").toLowerCase())
        );
      }),
    [appointments, nowTs],
  );
  const pastAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const at = Date.parse(appointment.scheduled_at || "");
        const status = String(appointment.status || "").toLowerCase();
        return (
          ["completed", "cancelled", "no_show"].includes(status) ||
          (!Number.isNaN(at) && at < nowTs)
        );
      }),
    [appointments, nowTs],
  );
  const requestedCare = useMemo(
    () =>
      teleconsults.filter((consult) =>
        ["requested", "scheduled", "in_progress"].includes(consult.status || "requested"),
      ),
    [teleconsults],
  );
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => Number(item.is_read) !== 1).length,
    [notifications],
  );
  const pendingServiceRequests = useMemo(
    () =>
      marketplaceRequests.filter((item) =>
        ["requested", "accepted", "sample_collected", "processing", "out_for_delivery", "ready_for_pickup"].includes(
          item.status,
        ),
      ),
    [marketplaceRequests],
  );
  const hospitalSections = useMemo(
    () => [
      {
        key: "updates",
        label: hospitalContent?.patientUpdates?.length ? "Hospital updates" : "Guidance",
      },
      {
        key: "cashless",
        label: hospitalContent?.sections?.cashless?.title || "Cashless Facility",
      },
      {
        key: "services",
        label: hospitalContent?.sections?.services?.title || "Scope of Services",
      },
      {
        key: "healthCheckup",
        label: hospitalContent?.sections?.healthCheckup?.title || "Health Check-up",
      },
      {
        key: "ayushman",
        label: hospitalContent?.sections?.ayushman?.title || "Ayushman Support",
      },
      {
        key: "specialities",
        label: hospitalContent?.sections?.specialities?.title || "Super-Specialities",
      },
    ],
    [hospitalContent],
  );
  const nextAppointment = useMemo(
    () => futureAppointments[0] || requestedAppointments[0] || null,
    [futureAppointments, requestedAppointments],
  );
  const latestHospitalUpdate = useMemo(
    () => hospitalContent?.patientUpdates?.[0] || null,
    [hospitalContent],
  );
  const followupDue = useMemo(() => {
    const now = Date.now();
    const due = encounters.find((encounter) => {
      const ts = Date.parse(encounter.followup_date || "");
      return !Number.isNaN(ts) && ts >= now;
    });
    return due || null;
  }, [encounters]);
  const timelineItems = useMemo(() => {
    const items = [];

    records.forEach((record) => {
      const sourceLabel = String(record.source_label || "").trim();
      const uploader = String(record.uploaded_by_name || record.uploaded_by_email || "").trim();
      items.push({
        id: `record-${record.id}`,
        at: record.created_at || record.uploaded_at || record.report_date || "",
        group: "reports",
        kind: "report",
        tone: "normal",
        badge: sourceLabel || "Uploaded",
        title: record.label || record.file_name || record.original_name || "Report uploaded",
        body:
          record.source === "lab_upload"
            ? `${uploader ? `${uploader} added this report from the lab side. ` : "A care-team upload has been added to your record. "}It can now feed summaries, trends, and planning.`
            : "A lab report was added to your record and can now feed summaries, trends, and planning.",
      });
    });

    (reportInsights?.conditionSummaries || []).forEach((summary) => {
      items.push({
        id: `insight-${summary.key}`,
        at: records[0]?.created_at || new Date().toISOString(),
        group: "reports",
        kind: "report",
        tone: summary.zone === "high" ? "high" : summary.zone === "low" ? "low" : "normal",
        badge: "Insight",
        title: summary.title,
        body: summary.summary,
      });
    });

    appointments.forEach((appointment) => {
      const status = String(appointment.status || "").toLowerCase();
      const department = appointment.department_name || appointment.department || "General";
      const doctor = appointment.doctor_name ? ` with ${appointment.doctor_name}` : "";
      items.push({
        id: `appointment-${appointment.id}`,
        at: appointment.scheduled_at || appointment.created_at || "",
        group: status === "requested" ? "followup" : "care",
        kind: "appointment",
        tone: status === "requested" ? "low" : "normal",
        badge: status ? status.replace(/_/g, " ") : "Visit",
        title: status === "requested" ? "Visit request created" : "Visit scheduled",
        body: `${department}${doctor}${appointment.scheduled_at ? ` on ${new Date(appointment.scheduled_at).toLocaleDateString()}` : ""}.`,
      });
    });

    encounters.forEach((encounter) => {
      const visitType = encounter.teleconsult_id ? "Remote consult completed" : "Visit record added";
      const diagnosis = encounter.diagnosis_text || encounter.diagnosis_code || "Clinical notes saved";
      items.push({
        id: `encounter-${encounter.id}`,
        at:
          encounter.appointment_scheduled_at ||
          encounter.teleconsult_preferred_slot ||
          encounter.created_at ||
          encounter.scheduled_at ||
          "",
        group: "care",
        kind: "record",
        tone: encounter.followup_date ? "low" : "normal",
        badge: encounter.followup_date ? "Follow-up set" : "Record",
        title: visitType,
        body: diagnosis,
      });
      if (encounter.followup_date) {
        items.push({
          id: `encounter-followup-${encounter.id}`,
          at: encounter.followup_date,
          group: "followup",
          kind: "followup",
          tone: "high",
          badge: "Review due",
          title: "Follow-up recommended",
          body: `A review was suggested around ${new Date(encounter.followup_date).toLocaleDateString()}.`,
        });
      }
    });

    healthPlanActivity.forEach((entry) => {
      const value = [entry.value, entry.unit].filter(Boolean).join(" ");
      items.push({
        id: `plan-${entry.id}`,
        at: entry.loggedAt || entry.createdAt || "",
        group: "care",
        kind: "plan",
        tone: "normal",
        badge: "Plan log",
        title: entry.label || "Health plan update",
        body: value || "A new health-plan activity was saved.",
      });
    });

    if (followupDue?.followup_date) {
      items.push({
        id: "followup-due",
        at: followupDue.followup_date,
        group: "followup",
        kind: "followup",
        tone: "high",
        badge: "Due",
        title: "Follow-up window on record",
        body: "Your clinical record already includes a follow-up date. Use recent reports and plan logs before that review.",
      });
    }

    return items
      .filter((item) => item.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 40);
  }, [appointments, encounters, followupDue, healthPlanActivity, records, reportInsights]);
  const filteredHistory = useMemo(() => {
    const query = triageHistoryQuery.trim().toLowerCase();
    return (history || []).filter((item) => {
      const levelMatch =
        triageHistoryLevel === "all" || String(item.result?.level || "unknown") === triageHistoryLevel;
      if (!levelMatch) return false;
      if (!query) return true;
      const haystack = [
        item.result?.headline || "",
        item.result?.urgency || "",
        (item.payload?.symptoms || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [history, triageHistoryLevel, triageHistoryQuery]);
  const profileValidationErrors = useMemo(() => {
    const errors = {};
    if (profileForm.phone && !/^\d{10}$/.test(String(profileForm.phone).replace(/\D/g, ""))) {
      errors.phone = "Contact number must be 10 digits.";
    }
    if (profileForm.abhaNumber && !/^\d{14}$/.test(String(profileForm.abhaNumber).replace(/\D/g, ""))) {
      errors.abhaNumber = "ABHA number must be 14 digits.";
    }
    if (
      profileForm.abhaAddress &&
      !/^[a-z0-9][a-z0-9._-]{1,98}@[a-z][a-z0-9._-]{1,48}$/i.test(String(profileForm.abhaAddress).trim())
    ) {
      errors.abhaAddress = "ABHA address must look like name@abdm.";
    }
    if (profileForm.pinCode && !/^\d{6}$/.test(String(profileForm.pinCode).replace(/\D/g, ""))) {
      errors.pinCode = "PIN code must be 6 digits.";
    }
    if (profileForm.weightKg) {
      const weight = Number(profileForm.weightKg);
      if (Number.isNaN(weight) || weight <= 0 || weight > 500) {
        errors.weightKg = "Weight must be a valid value in kg.";
      }
    }
    if (profileForm.heightCm) {
      const height = Number(profileForm.heightCm);
      if (Number.isNaN(height) || height <= 0 || height > 300) {
        errors.heightCm = "Height must be a valid value in cm.";
      }
    }
    return errors;
  }, [profileForm.phone, profileForm.abhaNumber, profileForm.abhaAddress, profileForm.pinCode, profileForm.weightKg, profileForm.heightCm]);
  const profileStepReady = useMemo(() => {
    if (profileWizardStep === 1) {
      return Boolean(
        profileForm.fullName.trim() &&
          profileForm.email.trim(),
      );
    }
    if (profileWizardStep === 2) {
      return Boolean(profileForm.sex && !profileValidationErrors.weightKg && !profileValidationErrors.heightCm);
    }
    if (profileWizardStep === 3) {
      return Boolean(
        profileForm.phone.trim() &&
          !profileValidationErrors.phone,
      );
    }
    if (profileWizardStep === 4) {
      return true;
    }
    return true;
  }, [profileWizardStep, profileForm, profileValidationErrors]);

  useEffect(() => {
    if (!activeConsult) return;
    setDoctorConsoleForm({
      status: activeConsult.status || "requested",
      meetingUrl: activeConsult.meetingUrl || "",
    });
  }, [activeConsult]);

  const signOut = async () => {
    const currentRefreshToken = latestRefreshTokenRef.current || refreshToken;
    try {
      if (currentRefreshToken) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
      }
    } catch (error) {
      // local sign-out should still succeed if the network is unstable
    } finally {
      clearAuthState();
    }
  };

  const scrollToSection = (id) => {
    if (typeof document === "undefined") return;
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openProfileEditor = () => {
    setActivePatientTab("profile");
    setProfileEditMode(true);
  };

  const logConsentAcceptance = useCallback(
    async (consentType) => {
      if (!authToken) return;
      try {
        await fetch(`${API_BASE}/api/consent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${latestAuthTokenRef.current || authToken}`,
          },
          body: JSON.stringify({
            consentType,
            policyVersion: "2026-04-11",
            accepted: true,
          }),
        });
      } catch {
        // consent logging should never block the patient flow
      }
    },
    [authToken],
  );

  const acceptDisclaimer = async () => {
    localStorage.setItem("health_disclaimer_accepted", "true");
    setShowDisclaimer(false);
    await logConsentAcceptance("platform_safety_notice");
  };

  const openPatientTab = (tabKey) => {
    setActivePatientTab(tabKey);
    setProfileEditMode(false);
    if (tabKey === "triage") {
      setShowTriageDisclaimer(true);
    }
  };

  const lastAnalyticsTabRef = useRef("");

  useEffect(() => {
    if (!uiToast) return undefined;
    const timer = window.setTimeout(() => setUiToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [uiToast]);

  const updateAuthField = (key, value) =>
    setAuthForm((prev) => ({ ...prev, [key]: value }));

  const handleAuth = async (event, consentBundle = null, guestReportToClaim = null, preAuthData = null) => {
    if (event) event.preventDefault();
    setAuthError("");

    try {
      let data;
      if (preAuthData) {
        // Phone OTP verify already returned tokens — skip the fetch
        data = preAuthData;
      } else {
        const endpoint = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
        const authPayload = consentBundle ? { ...authForm, consentBundle } : authForm;
        const response = await fetchWithWakeRetry(`${API_BASE}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authPayload),
        });
        data = await response.json();

        if (!response.ok) {
          setAuthError(data.error || "Unable to authenticate.");
          return;
        }
      }

      if (!data.user) {
        setAuthError("Unable to authenticate.");
        return;
      }

      persistAuthSession({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      });

      if (guestReportToClaim?.guestReportId && guestReportToClaim?.temporaryAccessToken && data.token) {
        const linkResponse = await fetchWithWakeRetry(
          `${API_BASE}/api/guest-report/${guestReportToClaim.guestReportId}/link-account`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${data.token}`,
              "x-guest-token": guestReportToClaim.temporaryAccessToken,
            },
          },
        );
        if (!linkResponse.ok) {
          const linkData = await linkResponse.json().catch(() => ({}));
          setAuthError(linkData.error || "Account created, but we could not save the uploaded report. Please upload it again inside Reports.");
          return;
        }
      }

      setAuthForm({ name: "", email: "", password: "" });

      // Auto-link any active guest report to the new account
      if (authMode === "signup") {
        try {
          const guestId    = sessionStorage.getItem("ssp_guest_report_id");
          const guestToken = sessionStorage.getItem("ssp_guest_token");
          if (guestId && guestToken && data.token) {
            fetch(`${API_BASE}/api/guest-report/${guestId}/link-account`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.token}`,
                "x-guest-token": guestToken,
              },
            }).then(() => {
              sessionStorage.removeItem("ssp_guest_report_id");
              sessionStorage.removeItem("ssp_guest_token");
            }).catch(() => {});
          }
        } catch {}
        setAuthMode("login");
        setShowPatientOnboarding(true);
      }
    } catch (error) {
      setAuthError("Unable to reach the server right now. If the backend was sleeping, wait a few seconds and try again.");
    }
  };

  const requestPasswordReset = async () => {
    setResetStatus("");
    if (!resetForm.email) {
      setResetStatus("Enter your email first.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetForm.email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResetStatus(data.error || "Unable to send OTP.");
        return;
      }
      setResetStatus(data.message || "OTP sent.");
    } catch (error) {
      setResetStatus("Network error. Check backend connection.");
    }
  };

  const confirmPasswordReset = async () => {
    setResetStatus("");
    if (!resetForm.email || !resetForm.token || !resetForm.newPassword) {
      setResetStatus("Enter email, OTP, and new password.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetForm.email,
          token: resetForm.token,
          newPassword: resetForm.newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResetStatus(data.error || "Unable to reset password.");
        return;
      }
      setResetStatus(data.message || "Password reset successful.");
      setResetForm((prev) => ({ ...prev, token: "", newPassword: "" }));
    } catch (error) {
      setResetStatus("Network error. Check backend connection.");
    }
  };

  const openAppointmentDetail = async (appointment) => {
    if (!appointment) return;
    setAppointmentDetail(appointment);
    setAppointmentActionStatus("");
    setAppointmentRescheduleForm({
      scheduledAt: appointment.scheduled_at
        ? new Date(appointment.scheduled_at).toISOString().slice(0, 16)
        : "",
      reason: "",
    });
    setAppointmentTimeline([]);
    await loadAppointmentTimeline(appointment.id);
  };

  const closeAppointmentDetail = () => {
    setAppointmentDetail(null);
    setAppointmentTimeline([]);
    setAppointmentActionStatus("");
    setAppointmentRescheduleForm({ scheduledAt: "", reason: "" });
  };

  const rescheduleAppointmentFromDetail = async () => {
    if (!appointmentDetail?.id || !appointmentRescheduleForm.scheduledAt) {
      setAppointmentActionStatus("Select a new date and time first.");
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentDetail.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: appointmentRescheduleForm.scheduledAt,
          reason: appointmentRescheduleForm.reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAppointmentActionStatus(data.error || "Unable to reschedule appointment.");
        return;
      }
      setAppointmentActionStatus("Appointment rescheduled.");
      setAppointmentDetail(data.appointment || appointmentDetail);
      await Promise.all([loadAppointments(), loadAppointmentTimeline(appointmentDetail.id)]);
    } catch (error) {
      setAppointmentActionStatus("Network error. Check backend connection.");
    }
  };

  const cancelAppointmentFromDetail = async () => {
    if (!appointmentDetail?.id) return;

    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentDetail.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAppointmentActionStatus(data.error || "Unable to cancel appointment.");
        return;
      }
      setAppointmentActionStatus("Appointment cancelled.");
      setAppointmentDetail(data.appointment || { ...appointmentDetail, status: "cancelled" });
      await Promise.all([loadAppointments(), loadAppointmentTimeline(appointmentDetail.id)]);
    } catch (error) {
      setAppointmentActionStatus("Network error. Check backend connection.");
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    if (!authToken || !appointmentId || !status) return;
    setOpsQueueStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setOpsQueueStatus(data.error || "Unable to update appointment.");
        return;
      }
      setOpsQueueStatus(`Appointment ${appointmentId} updated to ${String(status).replace(/_/g, " ")}.`);
      await Promise.all([loadAppointments(), loadAdminOps(), loadOpsQueue()]);
    } catch (error) {
      setOpsQueueStatus("Network error. Check backend connection.");
    }
  };

  const updateProfileField = (key, value) =>
    setProfileForm((prev) => ({ ...prev, [key]: value }));
  const updateTeleField = (key, value) =>
    setTeleForm((prev) => ({ ...prev, [key]: value }));
  const openTeleconsultRoom = (consult) => {
    if (!consult?.id) return;
    setActiveConsultId(consult.id);
    setTeleconsultRoomOpen(true);
  };
  const closeTeleconsultRoom = () => {
    setTeleconsultRoomOpen(false);
    setConsultMessageText("");
    setConsultMessageStatus("");
  };
  const submitCareRequest = async (event) => {
    event.preventDefault();
    if (!authToken) {
      setAppointmentsStatus("Sign in first.");
      return;
    }

	    if (careRequestMode === "in_person") {
      if (
        !appointmentForm.departmentId ||
        !appointmentForm.doctorId ||
        !appointmentForm.appointmentDate ||
        !appointmentForm.slotTime ||
        !appointmentForm.reason?.trim()
      ) {
        setAppointmentsStatus("Complete department, doctor, date, slot, and reason.");
        return;
      }

	      const appointmentPayload = {
	        departmentId: Number(appointmentForm.departmentId),
	        doctorId: Number(appointmentForm.doctorId),
	        reason: appointmentForm.reason,
	        scheduledAt: new Date(
	          `${appointmentForm.appointmentDate}T${appointmentForm.slotTime}:00`,
	        ).toISOString(),
	      };
	      try {
	        setAppointmentsStatus("");
	        const response = await apiFetch(`${API_BASE}/api/appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appointmentPayload),
        });
      const data = await response.json();
      if (!response.ok) {
        await trackDropOff("followup_booking", {
          bookingType: "appointment",
          mode: "in_person",
          reason: data.error || "appointment_rejected",
        });
        setAppointmentsStatus(data.error || "Unable to book appointment.");
        return;
      }
      await trackAnalyticsEvent("followup_booked", {
        bookingType: "appointment",
        mode: "in_person",
        departmentId: appointmentPayload.departmentId,
        doctorId: appointmentPayload.doctorId,
        scheduledAt: appointmentPayload.scheduledAt,
      });
      setAppointmentsStatus("Appointment request submitted.");
        setAppointmentForm({
          departmentId: "",
          doctorId: "",
          reason: "",
          appointmentDate: "",
          slotTime: "",
        });
        setAvailableSlots([]);
        await loadAppointments();
      } catch (error) {
        if (isNetworkLikeError(error)) {
          enqueuePendingAction({
            type: "appointment_create",
            payload: appointmentPayload,
          });
          setAppointmentsStatus("Connection dropped. Your appointment request was saved and will retry automatically.");
        } else {
          await trackDropOff("followup_booking", {
            bookingType: "appointment",
            mode: "in_person",
            reason: error?.message || "appointment_failed",
          });
          setAppointmentsStatus(humanizeAsyncIssue(error?.message, "Unable to book appointment."));
        }
      }
      return;
    }

    if (
      !appointmentForm.departmentId ||
      !appointmentForm.doctorId ||
      !appointmentForm.appointmentDate ||
      !appointmentForm.slotTime
    ) {
      setTeleStatus("Select department, doctor, date, and slot.");
      return;
    }

    if (!teleForm.concern?.trim() || teleForm.concern.trim().length < 10) {
      setTeleStatus("Concern must be at least 10 characters.");
      return;
    }

	    const teleconsultPayload = {
	      doctorId: Number(appointmentForm.doctorId),
	      departmentId: Number(appointmentForm.departmentId),
	      mode: careRequestMode,
	      concern: teleForm.concern,
	      preferredSlot: new Date(
	        `${appointmentForm.appointmentDate}T${appointmentForm.slotTime}:00`,
	      ).toISOString(),
	      phone: teleForm.phone || null,
	    };
	    try {
	      setTeleStatus("");
	      const response = await apiFetch(`${API_BASE}/api/teleconsults`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teleconsultPayload),
      });
      const data = await response.json();
      if (!response.ok) {
        await trackDropOff("followup_booking", {
          bookingType: "teleconsult",
          mode: careRequestMode,
          reason: data.error || "teleconsult_rejected",
        });
        setTeleStatus(data.error || "Unable to create care request.");
        return;
      }
      await trackAnalyticsEvent("followup_booked", {
        bookingType: "teleconsult",
        mode: careRequestMode,
        departmentId: teleconsultPayload.departmentId,
        doctorId: teleconsultPayload.doctorId,
        preferredSlot: teleconsultPayload.preferredSlot,
      });
      setTeleStatus("Teleconsult request submitted.");
      setTeleForm({
        mode: "video",
        concern: "",
        phone: "",
      });
      setAppointmentForm({
        departmentId: "",
        doctorId: "",
        reason: "",
        appointmentDate: "",
        slotTime: "",
      });
      setAvailableSlots([]);
      await loadTeleconsults();
    } catch (error) {
      if (isNetworkLikeError(error)) {
        enqueuePendingAction({
          type: "teleconsult_create",
          payload: teleconsultPayload,
        });
        setTeleStatus("Connection dropped. Your care request was saved and will retry automatically.");
      } else {
        await trackDropOff("followup_booking", {
          bookingType: "teleconsult",
          mode: careRequestMode,
          reason: error?.message || "teleconsult_failed",
        });
        setTeleStatus(humanizeAsyncIssue(error?.message, "Unable to create care request."));
      }
    }
  };

  const updateMarketplaceRequestStatus = async (requestId, status) => {
    if (!requestId) return;
    try {
      setMarketplaceActionStatus("");
      const response = await apiFetch(`${API_BASE}/api/marketplace/requests/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMarketplaceActionStatus(data.error || "Unable to update request.");
        return;
      }
      setMarketplaceActionStatus("Request updated.");
      await Promise.all([
        loadMarketplaceRequests(),
        loadMarketplaceAnalytics(),
        loadMarketplaceTimeline(requestId),
      ]);
    } catch (error) {
      setMarketplaceActionStatus("Network error. Check backend connection.");
    }
  };

  const apiFetch = async (url, options = {}) => {
    const performRequest = async (tokenOverride = "") => {
      const headers = { ...(options.headers || {}) };
      const bearerToken = tokenOverride || latestAuthTokenRef.current || authToken;
      if (bearerToken) {
        headers.Authorization = `Bearer ${bearerToken}`;
      }
      const activeSessionId = sessionId || localStorage.getItem("health_session_id") || "";
      if (activeSessionId) {
        headers["X-Session-Id"] = String(activeSessionId);
      }
      return fetchWithWakeRetry(url, { ...options, headers });
    };

    let response = await performRequest();
    if (response.status !== 401) {
      return response;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      return response;
    }

    response = await performRequest(refreshedToken);
    return response;
  };

  const trackAnalyticsEvent = useCallback(
    async (eventName, payload = {}) => {
      if (!authToken || !eventName) return;
      try {
        await apiFetch(`${API_BASE}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventName, payload }),
        });
      } catch {
        // analytics should never block the user journey
      }
    },
    [authToken, apiFetch],
  );

  const trackDropOff = useCallback(
    async (step, detail = {}) => {
      await trackAnalyticsEvent("drop_off", {
        step,
        ...detail,
      });
    },
    [trackAnalyticsEvent],
  );

  useEffect(() => {
    if (!authToken) return;
    if (activePatientTab === lastAnalyticsTabRef.current) return;
    if (activePatientTab === "timeline") {
      trackAnalyticsEvent("timeline_opened", {
        source: "patient_tab",
      });
    }
    lastAnalyticsTabRef.current = activePatientTab;
  }, [activePatientTab, authToken, trackAnalyticsEvent]);

  const wakeBackend = async () => {
    try {
      await fetch(`${API_BASE}/api/hospital/content`, { cache: "no-store" });
    } catch {
      // Let the original request surface the final error if retry still fails.
    }
  };

  const fetchWithWakeRetry = async (url, options = {}) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const offlineError = new Error("Offline");
      offlineError.code = "NETWORK_RETRY_FAILED";
      throw offlineError;
    }
    try {
      return await fetch(url, options);
    } catch (error) {
      for (const waitMs of [1200, 2200]) {
        try {
          await wakeBackend();
          await delay(waitMs);
          return await fetch(url, options);
        } catch (retryError) {
          error = retryError;
        }
      }
      const finalError = new Error("Network retry failed");
      finalError.code = "NETWORK_RETRY_FAILED";
      throw finalError;
    }
  };

  const loadPaymentGatewayConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/config`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setPaymentGatewayConfig(data.paymentGateway || { enabled: false, provider: "razorpay", keyId: "" });
    } catch (error) {
      setPaymentGatewayConfig({ enabled: false, provider: "razorpay", keyId: "" });
    }
  };

  const launchRazorpayPayment = async ({
    createOrderUrl,
    verifyUrl,
    key,
    description,
    onSuccess,
    onErrorMessage,
  }) => {
    const loaded = await ensureRazorpayScript();
    if (!loaded || !window.Razorpay) {
      throw new Error("Payment window could not be opened. Please try again on a stable connection.");
    }
    const createResponse = await apiFetch(createOrderUrl, { method: "POST" });
    const orderData = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(orderData.error || onErrorMessage);
    }
    const order = orderData.order || {};
    await new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: order.keyId || paymentGatewayConfig.keyId || key,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "SehatSaathi",
        description,
        order_id: order.id,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: profileForm.phone || "",
        },
        theme: {
          color: "#147d74",
        },
        handler: async (responsePayload) => {
          try {
            const verifyResponse = await apiFetch(verifyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(responsePayload),
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }
            await onSuccess?.(verifyData);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment was cancelled before completion.")),
        },
      });
      checkout.open();
    });
  };

  const payForAppointment = async (appointment) => {
    if (!appointment?.id) return;
    setConsultPaymentStatus("");
    setPaymentLoadingKey(`appointment-${appointment.id}`);
    try {
      await launchRazorpayPayment({
        createOrderUrl: `${API_BASE}/api/appointments/${appointment.id}/payment-order`,
        verifyUrl: `${API_BASE}/api/appointments/${appointment.id}/payment-verify`,
        description: "Appointment consultation fee",
        onErrorMessage: "Unable to start appointment payment.",
        onSuccess: async (verifyData) => {
          const billing = verifyData?.billing || null;
          if (billing) {
            setAppointmentDetail((prev) =>
              prev && prev.id === appointment.id
                ? {
                    ...prev,
                    bill_amount: billing.amount,
                    bill_status: billing.status,
                    bill_payment_method: billing.payment_method,
                  }
                : prev,
            );
          }
          setConsultPaymentStatus("Appointment payment completed.");
          await Promise.all([loadAppointments(), loadAppointmentTimeline(appointment.id)]);
        },
      });
    } catch (error) {
      setConsultPaymentStatus(
        humanizeAsyncIssue(error?.message, "Unable to complete appointment payment.", {
          cancelMessage: "Payment was cancelled. The appointment is still waiting for payment.",
          networkMessage: "Payment could not be completed because the connection dropped. Please try again.",
          timeoutMessage: "Payment verification is taking longer than expected. Please check status in a moment.",
        }),
      );
    } finally {
      setPaymentLoadingKey("");
    }
  };

  const payForTeleconsult = async (consult) => {
    if (!consult?.id) return;
    setConsultPaymentStatus("");
    setPaymentLoadingKey(`teleconsult-${consult.id}`);
    try {
      await launchRazorpayPayment({
        createOrderUrl: `${API_BASE}/api/teleconsults/${consult.id}/payment-order`,
        verifyUrl: `${API_BASE}/api/teleconsults/${consult.id}/payment-verify`,
        description: "Remote consultation fee",
        onErrorMessage: "Unable to start consultation payment.",
        onSuccess: async () => {
          setConsultPaymentStatus("Consult payment completed.");
          await loadTeleconsults();
        },
      });
    } catch (error) {
      setConsultPaymentStatus(
        humanizeAsyncIssue(error?.message, "Unable to complete consult payment.", {
          cancelMessage: "Payment was cancelled. The consult is still waiting for payment.",
          networkMessage: "Payment could not be completed because the connection dropped. Please try again.",
          timeoutMessage: "Payment verification is taking longer than expected. Please check status in a moment.",
        }),
      );
    } finally {
      setPaymentLoadingKey("");
    }
  };

  const retryPendingActions = async () => {
    if (!isOnline || !authToken || pendingActionQueue.length === 0) return;
    for (const action of pendingActionQueue) {
      try {
        if (action.type === "marketplace_request") {
          const response = await apiFetch(`${API_BASE}/api/marketplace/requests`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": action.idempotencyKey || `retry-${action.id}`,
            },
            body: JSON.stringify(action.payload),
          });
          if (!response.ok) continue;
          await trackAnalyticsEvent("lab_booked", {
            itemCount: 1,
            totalPrice: Number(action.payload?.listedPrice || 0),
            requestTypes: action.payload?.requestType ? [action.payload.requestType] : [],
            fulfillmentModes: action.payload?.fulfillmentMode ? [action.payload.fulfillmentMode] : [],
            source: "retry_queue",
          });
        } else if (action.type === "appointment_create") {
          const response = await apiFetch(`${API_BASE}/api/appointments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": action.idempotencyKey || `retry-${action.id}`,
            },
            body: JSON.stringify(action.payload),
          });
          if (!response.ok) continue;
          await trackAnalyticsEvent("followup_booked", {
            bookingType: "appointment",
            mode: "in_person",
            source: "retry_queue",
            departmentId: action.payload?.departmentId || null,
            doctorId: action.payload?.doctorId || null,
            scheduledAt: action.payload?.scheduledAt || null,
          });
        } else if (action.type === "teleconsult_create") {
          const response = await apiFetch(`${API_BASE}/api/teleconsults`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": action.idempotencyKey || `retry-${action.id}`,
            },
            body: JSON.stringify(action.payload),
          });
          if (!response.ok) continue;
          await trackAnalyticsEvent("followup_booked", {
            bookingType: "teleconsult",
            mode: action.payload?.mode || "remote",
            source: "retry_queue",
            departmentId: action.payload?.departmentId || null,
            doctorId: action.payload?.doctorId || null,
            preferredSlot: action.payload?.preferredSlot || null,
          });
        } else if (action.type === "profile_save") {
          const response = await apiFetch(`${API_BASE}/api/profile/${action.userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload),
          });
          if (!response.ok) continue;
        }
        removePendingAction(action.id);
      } catch (error) {
        // keep in queue
      }
    }
    await Promise.all([
      loadAppointments(),
      loadMarketplaceRequests(),
      loadMarketplaceAnalytics(),
      user?.id ? loadProfile(user.id) : Promise.resolve(),
    ]);
  };

  const refreshAccessToken = async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const currentRefreshToken = latestRefreshTokenRef.current || refreshToken;
    if (!currentRefreshToken) return null;
    const refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.token) {
          clearAuthState({ keepAuthError: true });
          return null;
        }
        persistAuthSession({
          user: data.user,
          token: data.token,
          refreshToken: data.refreshToken,
          sessionId: data.sessionId,
        });
        return data.token;
      } catch (error) {
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  };

  const toggleArrayValue = (key, value) => {
    setTriageForm((prev) => {
      const current = prev[key];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  };

  const toggleDentalArrayValue = (key, value) => {
    setDentalForm((prev) => {
      const current = prev[key];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  };

  const loadProfile = async (userId) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/profile/${userId}`);
      if (response.status === 404) {
        setProfileForm(defaultProfileForm(user));
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      const profile = data.profile || {};
      setProfileForm(mapProfilePayloadToForm(profile));
    } catch (error) {
      setProfileStatus("Unable to load profile.");
    }
  };

  // ABHA live fetch deferred — ABDM sandbox registration pending.
  // abhaHistory stays as empty array; no API call made.
  const loadAbhaHistory = () => {};

  const loadHistory = async (userId) => {
    setHistoryStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/triage/history/${userId}`);
      if (!response.ok) {
        setHistoryStatus("Unable to load history.");
        return;
      }
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      setHistoryStatus("Unable to load history.");
    }
  };

  const loadFamilyMembers = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/family`);
      if (!response.ok) return;
      const data = await response.json();
      const members = data.members || [];
      setFamilyMembers(members);
      if (members.length > 0 && !activeMemberId) {
        setActiveMemberId(members[0].id);
      }
    } catch (error) {
      setFamilyStatus("Unable to load family members.");
    }
  };

  const loadRecords = async (memberId) => {
    try {
      const response = memberId
        ? await apiFetch(`${API_BASE}/api/family/${memberId}/records`)
        : await apiFetch(`${API_BASE}/api/records`);
      if (!response.ok) return;
      const data = await response.json();
      setRecords(data.records || []);
      return data.records || [];
    } catch (error) {
      setRecordStatus(humanizeAsyncIssue(error?.message, "Unable to load records."));
      return [];
    }
  };

  const loadReportInsights = async (memberId, months = reportInsightsMonths) => {
    try {
      setReportInsightsStatus("");
      const params = new URLSearchParams();
      if (memberId) params.set("memberId", String(memberId));
      if (months) params.set("months", String(months));
      params.set("lang", language);
      const response = await apiFetch(`${API_BASE}/api/records/insights?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        const isServerProcessing = response.status >= 500 || /internal server error/i.test(String(data.error || ""));
        setReportInsightsStatus(
          isServerProcessing
            ? "Your summary is still being prepared. Please check again shortly."
            : humanizeAsyncIssue(data.error, "Unable to load report insights.", {
                timeoutMessage: "Insights are taking longer than expected. Your report is saved and you can retry shortly.",
                extractionMessage: "We saved the report, but could not read enough structured data for insights yet.",
              }),
        );
        return false;
      }
      if (data.processing) {
        setReportInsightsStatus("Your summary is still being prepared. Please check again shortly.");
      }
      setReportCatalog(data.catalog || []);
      setReportExtractionCapabilities(data.extractionCapabilities || null);
      setReportInsights(data.insights || null);
      setRecords(data.records || []);
      setRecordAnalysisDrafts((prev) => {
        const next = { ...prev };
        (data.records || []).forEach((record) => {
          const analysis = record.analysis;
          const metrics = {};
          const sourceMetrics = (analysis?.metrics || []).length ? analysis.metrics : record.extraction?.suggested_metrics || [];
          sourceMetrics.forEach((metric) => {
            metrics[metric.metricKey] = metric.valueNum;
          });
          const metricConfidences = {};
          (record.extraction?.suggested_metrics || []).forEach((metric) => {
            metricConfidences[metric.metricKey] = metric.confidence;
          });
          next[record.id] = {
            reportType: analysis?.reportType || record.extraction?.suggested_report_type || "",
            reportDate: analysis?.reportDate || record.extraction?.suggested_report_date || record.created_at?.slice(0, 10) || "",
            notes: analysis?.notes || "",
            extractedText: "",
            autoSuggestionMeta: record.extraction
              ? {
                  overallConfidence: record.extraction.overall_confidence,
                  needsReview: Boolean(record.extraction.needs_review),
                  detectedLabSource: record.extraction.detected_lab_source || "",
                  detectedSections: record.extraction.detected_sections || [],
                  source: record.extraction.extractor || "",
                  metricConfidences,
                }
              : null,
            metrics,
          };
        });
        return next;
      });
      return true;
    } catch (error) {
      setReportInsightsStatus(
        humanizeAsyncIssue(error?.message, "Unable to load report insights.", {
          timeoutMessage: "Insights are taking longer than expected. Your report is saved and you can retry shortly.",
          networkMessage: "Insights could not load because the connection dropped. Please retry shortly.",
        }),
      );
      return false;
    }
  };

  const updateRecordAnalysisDraft = (recordId, patch) => {
    setRecordAnalysisDrafts((prev) => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || { reportType: "", reportDate: "", notes: "", extractedText: "", metrics: {}, autoSuggestionMeta: null }),
        ...patch,
      },
    }));
  };

  const saveRecordAnalysis = async (recordId) => {
    const draft = recordAnalysisDrafts[recordId] || {};
    const catalogItem = reportCatalog.find((item) => item.key === draft.reportType);
    const metrics = (catalogItem?.metrics || [])
      .map((metric) => ({
        metricKey: metric.key,
        valueNum: draft.metrics?.[metric.key],
      }))
      .filter((item) => item.valueNum !== "" && item.valueNum !== null && item.valueNum !== undefined);
    setReportInsightsStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/records/${recordId}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: draft.reportType,
          reportDate: draft.reportDate,
          notes: draft.notes || "",
          metrics,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReportInsightsStatus(humanizeAsyncIssue(data.error, "Unable to save report values."));
        return;
      }
      setReportInsightsStatus("Report values saved.");
      await loadReportInsights(activeMemberId, reportInsightsMonths);
      setActiveAnalysisRecordId(null);
    } catch (error) {
      setReportInsightsStatus(humanizeAsyncIssue(error?.message, "Unable to save report values."));
    }
  };

  const autoSuggestRecordAnalysis = async (recordId) => {
    const draft = recordAnalysisDrafts[recordId] || {};
    setReportInsightsStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/records/${recordId}/analysis/auto-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText: draft.extractedText || "",
          hintedReportType: draft.reportType || "",
          reportDate: draft.reportDate || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReportInsightsStatus(
          humanizeAsyncIssue(data.error, "Unable to auto-suggest report values.", {
            timeoutMessage: "Auto-suggest is taking longer than expected. Please try again in a moment.",
            extractionMessage: "We could not confidently read enough text to suggest values from this report.",
          }),
        );
        return;
      }
      const suggestion = data.suggestion || {};
      const nextMetrics = {};
      (suggestion.metrics || []).forEach((metric) => {
        nextMetrics[metric.metricKey] = metric.valueNum;
      });
      updateRecordAnalysisDraft(recordId, {
        reportType: suggestion.reportType || draft.reportType || "",
        reportDate: suggestion.reportDate || draft.reportDate || "",
        metrics: {
          ...(draft.metrics || {}),
          ...nextMetrics,
        },
        autoSuggestionMeta: {
          overallConfidence: suggestion.overallConfidence ?? null,
          needsReview: Boolean(suggestion.needsReview),
          detectedLabSource: suggestion.detectedLabSource?.label || "",
          source: suggestion.source || "parsed_text",
          metricConfidences: Object.fromEntries((suggestion.metrics || []).map((metric) => [metric.metricKey, metric.confidence])),
        },
      });
      setReportInsightsStatus(suggestion.summary || "Suggested values applied.");
    } catch (error) {
      setReportInsightsStatus(
        humanizeAsyncIssue(error?.message, "Unable to auto-suggest report values.", {
          timeoutMessage: "Auto-suggest is taking longer than expected. Please try again in a moment.",
        }),
      );
    }
  };

  const loadShareHistory = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/share-history`);
      if (!response.ok) return;
      const data = await response.json();
      setShareHistory(data.history || []);
    } catch (error) {
      // non-blocking
    }
  };

  const loadSharePasses = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/share-passes`);
      if (!response.ok) return;
      const data = await response.json();
      setSharePasses(data.passes || []);
    } catch (error) {
      // non-blocking
    }
  };

  const {
    openRecordUploader,
    saveProfile,
    uploadRecord,
    deleteRecord,
    generateSharePass,
    requestAbhaVerification,
    fetchAbhaProfile,
  } = useProfileSectionActions({
    apiBase: API_BASE,
    apiFetch,
    authToken,
    user,
    profileForm,
    setProfileForm,
    setProfileStatus,
    setUser,
    setProfileEditMode,
    setActivePatientTab,
    loadProfile,
    activeMemberId,
    recordsInputRef,
    loadRecords,
    loadReportInsights,
    setRecordStatus,
    loadSharePasses,
    loadShareHistory,
    setSharePassStatus,
    setSharePass,
    setShareQr,
    mapProfilePayloadToForm,
    loadAbhaHistory,
    trackAnalyticsEvent,
    trackDropOff,
  });

  const {
    updateTriageField,
    updateDentalField,
    saveTriageDraftNow,
    clearTriageDraft,
    submitTriage,
  } = useTriageSectionActions({
    apiBase: API_BASE,
    apiFetch,
    triageType,
    triageForm,
    dentalForm,
    setTriageForm,
    setDentalForm,
    setTriageType,
    setTriageDraftStatus,
    setTriageLoading,
    setTriageError,
    setTriageResult,
    loadHistory,
    user,
    fallbackTriage,
  });

  const finishPatientOnboarding = async () => {
    const saved = await saveProfile({ preventDefault: () => {} });
    if (!saved) return;
    setShowPatientOnboarding(false);
    openPatientTab("reports");
    window.setTimeout(() => {
      openRecordUploader();
    }, 120);
  };

  // ABHA verification deferred — no-op for pilot
  const requestAbhaVerificationWithFeedback = () => {};

  const saveTriageDraftWithFeedback = async () => {
    try {
      await saveTriageDraftNow();
      setUiToast({ tone: "success", message: "Draft saved" });
    } catch {
      setUiToast({ tone: "error", message: "Unable to save draft" });
    }
  };

  const markNotificationsReadWithFeedback = async () => {
    try {
      await markNotificationsRead();
      await loadNotifications();
      setUiToast({ tone: "success", message: "Updates marked as read" });
    } catch {
      setUiToast({ tone: "error", message: "Unable to update your latest updates" });
    }
  };

  const handlePhotoChange = (event) => {
    const file = event?.target?.files?.[0] || null;
    setTriageForm((prev) => {
      if (prev.photoPreview && prev.photoPreview.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev.photoPreview);
        } catch {
          // ignore local preview cleanup issues
        }
      }
      return {
        ...prev,
        photoFile: file,
        photoPreview: file ? URL.createObjectURL(file) : "",
      };
    });
  };

  const removeTriagePhoto = () => {
    setTriageForm((prev) => {
      if (prev.photoPreview && prev.photoPreview.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev.photoPreview);
        } catch {
          // ignore local preview cleanup issues
        }
      }
      return {
        ...prev,
        photoFile: null,
        photoPreview: "",
      };
    });
  };

  const downloadVisitPdf = () => {
    if (!triageResult) return;
    const openedAt = new Date().toLocaleString();
    const suggestions = Array.isArray(triageResult.suggestions)
      ? triageResult.suggestions.map((item) => `<li>${String(item)}</li>`).join("")
      : "";
    const photoNote = triageForm.photoFile ? "<p><strong>Patient uploaded photo:</strong> Yes</p>" : "";
    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=720");
    if (!popup) return;
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Visit Summary</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #182735; }
            h1, h2, h3, p { margin: 0; }
            .stack { display: grid; gap: 14px; }
            .card { border: 1px solid #d7e2eb; border-radius: 16px; padding: 18px; }
            .muted { color: #5a6d7f; }
            ul { margin: 10px 0 0 18px; padding: 0; }
          </style>
        </head>
        <body>
          <div class="stack">
            <div>
              <h1>SehatSaathi Visit Summary</h1>
              <p class="muted">Generated ${openedAt}</p>
            </div>
            <div class="card stack">
              <div>
                <h2>${String(triageResult.headline || "Clinical guidance summary")}</h2>
                <p class="muted">${String(triageResult.urgency || "-")}</p>
              </div>
              <div>
                <h3>Summary</h3>
                <p>${String(triageResult.disclaimer || "")}</p>
              </div>
              <div>
                <h3>Suggestions</h3>
                <ul>${suggestions}</ul>
              </div>
            </div>
            <div class="card stack">
              <h3>Triage context</h3>
              <p><strong>Type:</strong> ${triageType}</p>
              <p><strong>Age:</strong> ${triageForm.age || "-"}</p>
              <p><strong>Sex:</strong> ${triageForm.sex || "-"}</p>
              <p><strong>Duration:</strong> ${triageForm.durationDays || dentalForm.durationDays || "-"}</p>
              ${photoNote}
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleGuidanceFeedback = async (helpful) => {
    setFeedbackStatus(
      helpful
        ? "Thanks. We’ve marked this guidance as helpful."
        : "Thanks. We’ve marked this guidance for review.",
    );
  };

  const handleVisitFollowup = async (visitHappened) => {
    setFeedbackStatus(
      visitHappened
        ? "Thanks. We’ve recorded that you followed up after this guidance."
        : "Okay. We’ve recorded that you have not visited yet.",
    );
  };

  const loadNotifications = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/notifications?limit=8`);
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      // non-blocking
    }
  };

  const loadPolicyBundle = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/policies`);
      if (!response.ok) return;
      const data = await response.json();
      setPolicyBundle(data || null);
    } catch (error) {
      // non-blocking
    }
  };

  const loadSupportRequests = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/support/requests`);
      if (!response.ok) return;
      const data = await response.json();
      setSupportRequests(data.requests || []);
    } catch (error) {
      // non-blocking
    }
  };

  const loadNotificationSettings = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/notification-settings`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.settings) {
        setNotificationSettings({
          dailyReminderTime: data.settings.dailyReminderTime || "08:00",
          planReminders: Boolean(data.settings.planReminders),
          followupNudges: Boolean(data.settings.followupNudges),
          visitReminders: Boolean(data.settings.visitReminders),
          labReminders: Boolean(data.settings.labReminders),
        });
      }
      setNotificationSettingsStatus("");
    } catch (error) {
      // non-blocking
    }
  };

  const saveNotificationSettings = async (nextSettings) => {
    if (!authToken) return;
    setNotificationSettings(nextSettings);
    setNotificationSettingsStatus("Saving plan support...");
    try {
      const response = await apiFetch(`${API_BASE}/api/notification-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save plan support");
      }
      if (data.settings) {
        setNotificationSettings({
          dailyReminderTime: data.settings.dailyReminderTime || "08:00",
          planReminders: Boolean(data.settings.planReminders),
          followupNudges: Boolean(data.settings.followupNudges),
          visitReminders: Boolean(data.settings.visitReminders),
          labReminders: Boolean(data.settings.labReminders),
        });
      }
      setNotificationSettingsStatus("Plan support saved");
      setUiToast({ tone: "success", message: "Plan support saved" });
    } catch (error) {
      setNotificationSettingsStatus(error?.message || "Unable to save plan support");
      setUiToast({ tone: "error", message: "Unable to save plan support" });
    }
  };

  const markNotificationsRead = async () => {
    if (!authToken || notifications.length === 0) return;
    try {
      await apiFetch(`${API_BASE}/api/notifications/read-all`, {
        method: "POST",
      });
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      // non-blocking
    }
  };

  const submitSupportRequest = async (event) => {
    event.preventDefault();
    if (!authToken) return;
    setSupportRequestStatus("Sending your request...");
    try {
      const response = await apiFetch(`${API_BASE}/api/support/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...supportRequestDraft,
          sourceScreen: activePatientTab,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to send your support request.");
      }
      setSupportRequestStatus("Support request sent. We logged it with your current app context.");
      setUiToast({ tone: "success", message: "Support request sent" });
      setSupportRequestDraft({
        category: "general",
        severity: "normal",
        subject: "",
        message: "",
      });
      await Promise.all([loadSupportRequests(), loadNotifications()]);
    } catch (error) {
      const message = error?.message || "Unable to send your support request.";
      setSupportRequestStatus(message);
      setUiToast({ tone: "error", message });
    }
  };

  const exportPrivacyData = async () => {
    if (!authToken) return;
    setPrivacyActionStatus("Preparing your privacy export...");
    try {
      const response = await apiFetch(`${API_BASE}/api/privacy/export`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to prepare privacy export.");
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `sehatsaathi-privacy-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      setPrivacyActionStatus("Privacy export downloaded.");
    } catch (error) {
      setPrivacyActionStatus(error?.message || "Unable to prepare privacy export.");
    }
  };

  const deleteMyData = async () => {
    if (!authToken) return;
    // Confirmation is handled by the in-app DeleteAccountModal in SettingsPanel
    // (window.confirm is suppressed in iOS Safari PWA mode)
    setPrivacyActionStatus("Deleting your account…");
    try {
      const response = await apiFetch(`${API_BASE}/api/privacy/me`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to delete your account.");
      }
      clearAuthState();
      setPrivacyActionStatus("Your account has been deleted.");
    } catch (error) {
      setPrivacyActionStatus(error?.message || "Unable to delete your account. Please try again.");
    }
  };

  const loadTeleconsults = async () => {
    if (!authToken) return;
    setTeleLoading(true);
    setTeleStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults`);
      if (!response.ok) {
        setTeleStatus(t("teleError"));
        return;
      }
      const data = await response.json();
      const items = data.consults || [];
      setTeleconsults(items);
      setActiveConsultId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev;
        return items[0]?.id || null;
      });
    } catch (error) {
      setTeleStatus(t("teleError"));
    } finally {
      setTeleLoading(false);
    }
  };

  const loadConsultMessages = async (consultId) => {
    if (!consultId || !authToken) return;
    setConsultMessageStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/messages`);
      if (!response.ok) {
        setConsultMessageStatus(t("teleError"));
        return;
      }
      const data = await response.json();
      setConsultMessages(data.messages || []);
    } catch (error) {
      setConsultMessageStatus(t("teleError"));
    }
  };

  const loadConsultConsent = async (consultId) => {
    if (!consultId || !authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/consent`);
      if (!response.ok) return;
      const data = await response.json();
      setConsultConsentSummary(data.summary || null);
    } catch (error) {
      // non-blocking
    }
  };

  const acceptConsultConsent = async () => {
    if (!authToken || !activeConsultId) return;
    try {
      setConsultMessageStatus("");
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeConsultId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, policyVersion: "teleconsult_chat_v1" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setConsultMessageStatus(data.error || "Unable to record teleconsult acknowledgement.");
        return;
      }
      await loadConsultConsent(activeConsultId);
      setConsultMessageStatus("Teleconsult acknowledgement recorded.");
    } catch (error) {
      setConsultMessageStatus("Unable to record teleconsult acknowledgement.");
    }
  };

  const sendConsultMessage = async (event) => {
    event?.preventDefault?.();
    if (!authToken || !activeConsultId) return;
    if (!consultConsentSummary?.patientAccepted) {
      setConsultMessageStatus("Please accept the teleconsult notice before using chat.");
      return;
    }
    if (!String(consultMessageText || "").trim()) {
      setConsultMessageStatus("Type a message first.");
      return;
    }
    try {
      setConsultMessageStatus("");
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeConsultId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: consultMessageText }),
      });
      const data = await response.json();
      if (!response.ok) {
        setConsultMessageStatus(data.error || "Unable to send message.");
        return;
      }
      setConsultMessageText("");
      await loadTeleconsults();
    } catch (error) {
      setConsultMessageStatus("Network error. Check backend connection.");
    }
  };

  const updateConsultStatus = async (event) => {
    event?.preventDefault?.();
    if (!authToken || !activeConsultId || !["doctor", "admin"].includes(user?.role)) return;
    try {
      setDoctorConsoleStatus("");
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeConsultId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: doctorConsoleForm.status,
          meetingUrl: doctorConsoleForm.meetingUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || "Unable to save consult state.");
        return;
      }
      setDoctorConsoleStatus("Consult state updated.");
      await loadTeleconsults();
    } catch (error) {
      setDoctorConsoleStatus("Network error. Check backend connection.");
    }
  };

  const loadAppointments = async () => {
    if (!authToken) return;
    setAppointmentsStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments`);
      if (!response.ok) {
        setAppointmentsStatus("Unable to load appointments.");
        return;
      }
      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (error) {
      setAppointmentsStatus("Unable to load appointments.");
    }
  };

  const loadAppointmentTimeline = async (appointmentId) => {
    if (!authToken || !appointmentId) return;
    try {
      const response = await apiFetch(
        `${API_BASE}/api/appointments/${appointmentId}/timeline`,
      );
      const data = await response.json();
      if (!response.ok) {
        setAppointmentActionStatus(data.error || "Unable to load appointment timeline.");
        return;
      }
      setAppointmentTimeline(data.timeline || []);
    } catch (error) {
      setAppointmentActionStatus("Unable to load appointment timeline.");
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/departments`);
      if (!response.ok) return;
      const data = await response.json();
      const items = data.departments || [];
      setDepartments(items);
      setAppointmentForm((prev) => {
        if (prev.departmentId || items.length === 0) {
          return prev;
        }
        return {
          ...prev,
          departmentId: String(items[0].id),
          doctorId: "",
        };
      });
    } catch (error) {
      // Non-blocking at startup.
    }
  };

  const loadDoctorsForDepartment = async (departmentId) => {
    if (!departmentId) {
      setDepartmentDoctors([]);
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/api/doctors?departmentId=${encodeURIComponent(departmentId)}`,
      );
      if (!response.ok) {
        setDepartmentDoctors([]);
        return;
      }
      const data = await response.json();
      const items = data.doctors || [];
      setDepartmentDoctors(items);
      setAppointmentForm((prev) => {
        if (String(prev.departmentId) !== String(departmentId)) {
          return prev;
        }
        const selectedDoctorStillValid = items.some(
          (doctor) => String(doctor.id) === String(prev.doctorId),
        );
        return {
          ...prev,
          doctorId: selectedDoctorStillValid ? prev.doctorId : "",
        };
      });
    } catch (error) {
      setDepartmentDoctors([]);
    }
  };

  const loadProfileDoctorsForDepartment = async (departmentId) => {
    if (!departmentId) {
      setProfileDepartmentDoctors([]);
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/api/doctors?departmentId=${encodeURIComponent(departmentId)}`,
      );
      if (!response.ok) {
        setProfileDepartmentDoctors([]);
        return;
      }
      const data = await response.json();
      const items = data.doctors || [];
      setProfileDepartmentDoctors(items);
      setProfileForm((prev) => {
        if (String(prev.unitDepartmentId) !== String(departmentId)) {
          return prev;
        }
        const selectedDoctorStillValid = items.some(
          (doctor) => String(doctor.id) === String(prev.unitDoctorId),
        );
        return {
          ...prev,
          unitDoctorId: selectedDoctorStillValid ? prev.unitDoctorId : "",
        };
      });
    } catch (error) {
      setProfileDepartmentDoctors([]);
    }
  };

  const loadAdminUsers = async () => {
    if (!authToken || user?.role !== "admin") return;
    setAdminUsersStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/users`);
      if (!response.ok) {
        setAdminUsersStatus("Unable to load admin users.");
        return;
      }
      const data = await response.json();
      setAdminUsers(
        (data.users || []).map((item) => ({
          ...item,
          roleDraft: item.role || "patient",
          departmentIdDraft: item.department_id ? String(item.department_id) : "",
          qualificationDraft: item.qualification || "",
          activeDraft: item.active ? "active" : "disabled",
        })),
      );
    } catch (error) {
      setAdminUsersStatus("Unable to load admin users.");
    }
  };

  const loadAdminOps = async () => {
    if (!authToken || !["admin", "front_desk"].includes(user?.role)) return;
    setAdminOpsStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/ops/dashboard`);
      if (!response.ok) {
        setAdminOpsStatus("Unable to load operations dashboard.");
        return;
      }
      const data = await response.json();
      setAdminOps(data);
    } catch (error) {
      setAdminOpsStatus("Unable to load operations dashboard.");
    }
  };

  const loadOpsQueue = async () => {
    if (!authToken || !["admin", "front_desk"].includes(user?.role)) return;
    setOpsQueueStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/ops/queue`);
      const data = await response.json();
      if (!response.ok) {
        setOpsQueueStatus(data.error || "Unable to load front desk queue.");
        return;
      }
      const queue = data.queue || [];
      setOpsQueue(queue);
      setBillingDrafts((prev) => {
        const next = { ...prev };
        queue.forEach((item) => {
          if (!next[item.id]) {
            next[item.id] = {
              amount: item.bill_amount ?? "",
              status: item.bill_status || "unpaid",
              paymentMethod: item.bill_payment_method || "",
            };
          }
        });
        return next;
      });
    } catch (error) {
      setOpsQueueStatus("Unable to load front desk queue.");
    }
  };

  const updateBillingDraft = (appointmentId, key, value) => {
    setBillingDrafts((prev) => ({
      ...prev,
      [appointmentId]: {
        amount: "",
        status: "unpaid",
        paymentMethod: "",
        ...(prev[appointmentId] || {}),
        [key]: value,
      },
    }));
  };

  const saveBillingForAppointment = async (appointmentId) => {
    if (!authToken || !appointmentId) return;
    setOpsQueueStatus("");
    const draft = billingDrafts[appointmentId] || {};
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(draft.amount || 0),
          status: draft.status || "unpaid",
          paymentMethod: draft.paymentMethod || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setOpsQueueStatus(data.error || "Unable to save billing.");
        return;
      }
      setOpsQueueStatus(`Billing saved for appointment ${appointmentId}.`);
      await Promise.all([loadOpsQueue(), loadAdminOps(), loadAppointments()]);
    } catch (error) {
      setOpsQueueStatus("Network error. Check backend connection.");
    }
  };

  const viewReceipt = async (appointmentId) => {
    if (!authToken || !appointmentId) return;
    setOpsQueueStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/receipt`);
      const data = await response.json();
      if (!response.ok) {
        setOpsQueueStatus(data.error || "Unable to load receipt.");
        return;
      }
      const receipt = data.receipt || {};
      const popup = window.open("", "_blank", "noopener,noreferrer,width=860,height=680");
      if (!popup) {
        setOpsQueueStatus("Allow popups to view the receipt.");
        return;
      }
      popup.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Appointment Receipt</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #182735; }
              h1, h2, p { margin: 0; }
              .stack { display: grid; gap: 14px; }
              .card { border: 1px solid #d7e2eb; border-radius: 16px; padding: 18px; }
              .row { display: grid; grid-template-columns: 180px 1fr; gap: 10px; }
              .muted { color: #5a6d7f; }
            </style>
          </head>
          <body>
            <div class="stack">
              <div>
                <h1>Appointment Receipt</h1>
                <p class="muted">Generated ${new Date().toLocaleString()}</p>
              </div>
              <div class="card stack">
                <div class="row"><strong>Appointment</strong><span>${receipt.appointmentId || "-"}</span></div>
                <div class="row"><strong>Patient</strong><span>${receipt.patientName || "-"}</span></div>
                <div class="row"><strong>Department</strong><span>${receipt.department || "-"}</span></div>
                <div class="row"><strong>Doctor</strong><span>${receipt.doctorName || "-"}</span></div>
                <div class="row"><strong>Reason</strong><span>${receipt.reason || "-"}</span></div>
                <div class="row"><strong>Scheduled</strong><span>${receipt.scheduledAt ? new Date(receipt.scheduledAt).toLocaleString() : "-"}</span></div>
                <div class="row"><strong>Billing status</strong><span>${receipt.billingStatus || "-"}</span></div>
                <div class="row"><strong>Amount</strong><span>Rs ${receipt.amount ?? 0}</span></div>
                <div class="row"><strong>Payment method</strong><span>${receipt.paymentMethod || "-"}</span></div>
                <div class="row"><strong>Notes</strong><span>${receipt.notes || "-"}</span></div>
              </div>
            </div>
          </body>
        </html>
      `);
      popup.document.close();
    } catch (error) {
      setOpsQueueStatus("Network error. Check backend connection.");
    }
  };

  const loadAvailableSlots = async (doctorId, date) => {
    if (!doctorId || !date) {
      setAvailableSlots([]);
      setSlotStatus("");
      return;
    }
    setSlotStatus("");
    try {
      const response = await fetch(
        `${API_BASE}/api/appointment-slots?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setAvailableSlots([]);
        setSlotStatus(data.error || "Unable to load slots.");
        return;
      }
      setAvailableSlots(data.slots || []);
      if (!data.slots || data.slots.length === 0) {
        setSlotStatus("No slots available for this date.");
      }
    } catch (error) {
      setAvailableSlots([]);
      setSlotStatus("Unable to load slots.");
    }
  };

  const loadDoctorSchedule = async (doctorId) => {
    if (!doctorId || !authToken) return;
    setScheduleStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/doctors/${doctorId}/availability`);
      if (!response.ok) {
        setScheduleStatus("Unable to load schedule.");
        return;
      }
      const data = await response.json();
      const schedules = data.schedules || [];
      if (schedules.length > 0) {
        setScheduleForm(
          schedules.map((item) => ({
            weekday: Number(item.weekday),
            startTime: item.start_time,
            endTime: item.end_time,
            slotMinutes: Number(item.slot_minutes),
          })),
        );
      }
    } catch (error) {
      setScheduleStatus("Unable to load schedule.");
    }
  };

  const updateScheduleRow = (index, key, value) => {
    setScheduleForm((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: key === "weekday" || key === "slotMinutes" ? Number(value) : value,
            }
          : row,
      ),
    );
  };

  const addScheduleRow = () => {
    setScheduleForm((prev) => [
      ...prev,
      { weekday: 1, startTime: "10:00", endTime: "13:00", slotMinutes: 20 },
    ]);
  };

  const removeScheduleRow = (index) => {
    setScheduleForm((prev) => (prev.length <= 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)));
  };

  const saveDoctorSchedule = async () => {
    if (!authToken || !user?.id) {
      setScheduleStatus("Sign in again to save schedule.");
      return;
    }
    setScheduleStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/doctors/${user.id}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: scheduleForm }),
      });
      const data = await response.json();
      if (!response.ok) {
        setScheduleStatus(data.error || "Unable to save schedule.");
        return;
      }
      setScheduleStatus("Schedule saved.");
      await loadDoctorSchedule(user.id);
    } catch (error) {
      setScheduleStatus("Unable to save schedule.");
    }
  };

  const loadEncounters = async () => {
    if (!authToken) return;
    setEncounterStatus("");
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters`);
      if (!response.ok) {
        setEncounterStatus("Unable to load clinical records.");
        return;
      }
      const data = await response.json();
      const items = data.encounters || [];
      setEncounters(items);
      if (items.length > 0) {
        setActiveEncounterId((prev) => prev || items[0].id);
      }
    } catch (error) {
      setEncounterStatus("Unable to load clinical records.");
    }
  };

  const loadEncounterDetail = async (encounterId) => {
    if (!encounterId || !authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}`);
      if (!response.ok) {
        setEncounterStatus("Unable to load record detail.");
        return;
      }
      const data = await response.json();
      setEncounterDetail(data);
    } catch (error) {
      setEncounterStatus("Unable to load record detail.");
    }
  };

  const loadLabListings = async (mode = labMode, area = labArea) => {
    setMarketplaceLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/labs?mode=${encodeURIComponent(mode)}&area=${encodeURIComponent(area)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setMarketplaceStatus(data.error || "Unable to load labs.");
        return;
      }
      setLabListings(normalizeLabListings(data.labs || []));
      setLabAreas(data.areas || []);
      setActiveLabId(null);
    } catch (error) {
      setMarketplaceStatus("Unable to load labs.");
    } finally {
      setMarketplaceLoading(false);
    }
  };

  const loadPharmacyListings = async (mode = pharmacyMode) => {
    setMarketplaceLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/pharmacies?mode=${encodeURIComponent(mode)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setMarketplaceStatus(data.error || "Unable to load pharmacies.");
        return;
      }
      setPharmacyListings(normalizePharmacyListings(data.pharmacies || []));
    } catch (error) {
      setMarketplaceStatus("Unable to load pharmacies.");
    } finally {
      setMarketplaceLoading(false);
    }
  };

  const loadMarketplaceRequests = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/marketplace/requests`);
      const data = await response.json();
      if (!response.ok) {
        setMarketplaceStatus(data.error || "Unable to load marketplace requests.");
        return;
      }
      setMarketplaceRequests(data.requests || []);
    } catch (error) {
      setMarketplaceStatus("Unable to load marketplace requests.");
    }
  };

  const loadMarketplaceAnalytics = async () => {
    if (!authToken) return;
    try {
      const response = await apiFetch(`${API_BASE}/api/marketplace/analytics`);
      const data = await response.json();
      if (!response.ok) {
        return;
      }
      setMarketplaceAnalytics({
        overall: data.overall || { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
        lab: data.lab || { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
        pharmacy: data.pharmacy || { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
      });
    } catch (error) {
      // keep previous analytics
    }
  };

  const loadMarketplaceRequestTimeline = async (requestId) => {
    if (!authToken || !requestId) return;
    setMarketplaceTimelineLoadingByRequest((prev) => ({ ...prev, [requestId]: true }));
    try {
      const response = await apiFetch(`${API_BASE}/api/marketplace/requests/${requestId}/timeline`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load request timeline.");
      setMarketplaceTimelineByRequest((prev) => ({
        ...prev,
        [requestId]: data.timeline || [],
      }));
    } catch (error) {
      setMarketplaceActionStatus(error.message || "Unable to load request timeline.");
    } finally {
      setMarketplaceTimelineLoadingByRequest((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const loadHospitalContent = async () => {
    setHospitalContentStatus('');
    try {
      const response = await fetch(`${API_BASE}/api/hospital/content`);
      const data = await response.json();
      if (!response.ok) {
        setHospitalContentStatus(data.error || 'Unable to load hospital details.');
        return;
      }
      setHospitalContent(normalizeHospitalContent(data || {}, API_BASE));
    } catch (error) {
      setHospitalContentStatus('Unable to load hospital details.');
    }
  };

  const toggleMarketplaceRequestTimeline = async (requestId) => {
    const willOpen = !marketplaceTimelineOpenByRequest[requestId];
    setMarketplaceTimelineOpenByRequest((prev) => ({ ...prev, [requestId]: willOpen }));
    if (willOpen && !marketplaceTimelineByRequest[requestId]) {
      await loadMarketplaceRequestTimeline(requestId);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadHospitalContent();
  }, []);

  useEffect(() => {
    if (!appointmentForm.departmentId) {
      setDepartmentDoctors([]);
      return;
    }
    loadDoctorsForDepartment(appointmentForm.departmentId);
  }, [appointmentForm.departmentId]);

  useEffect(() => {
    if (!profileForm.unitDepartmentId) {
      setProfileDepartmentDoctors([]);
      return;
    }
    loadProfileDoctorsForDepartment(profileForm.unitDepartmentId);
  }, [profileForm.unitDepartmentId]);

  useEffect(() => {
    if (!appointmentForm.doctorId || !appointmentForm.appointmentDate) {
      setAvailableSlots([]);
      setSlotStatus("");
      return;
    }
    loadAvailableSlots(appointmentForm.doctorId, appointmentForm.appointmentDate);
  }, [appointmentForm.doctorId, appointmentForm.appointmentDate]);

  useEffect(() => {
    if (user && (user.role === "doctor" || user.role === "admin")) {
      loadDoctorSchedule(user.id);
    }
  }, [user?.id, user?.role, authToken]);

  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id);
      loadAbhaHistory();
      loadHistory(user.id);
      loadFamilyMembers();
      loadShareHistory();
      loadSharePasses();
      loadNotifications();
      loadTeleconsults();
      loadAppointments();
      loadEncounters();
      loadMarketplaceRequests();
      loadMarketplaceAnalytics();
      loadLabListings();
      loadPharmacyListings();
      if (user.role === "admin") {
        loadAdminUsers();
      } else {
        setAdminUsers([]);
      }
      if (["admin", "front_desk"].includes(user.role)) {
        loadAdminOps();
        loadOpsQueue();
      } else {
        setAdminOps(null);
        setOpsQueue([]);
      }
    } else {
      setProfileForm(defaultProfileForm());
      setAbhaHistory([]);
      setHistory([]);
      setFamilyMembers([]);
      setRecords([]);
      setNotifications([]);
      setTeleconsults([]);
      setConsultMessages([]);
      setActiveConsultId(null);
      setAppointments([]);
      setEncounters([]);
      setEncounterDetail(null);
      setActiveEncounterId(null);
      setMarketplaceAnalytics({
        overall: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
        lab: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
        pharmacy: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
      });
      setAdminUsers([]);
      setAdminOps(null);
      setOpsQueue([]);
      setSharePasses([]);
    }
  }, [user, authToken]);

  useEffect(() => {
    loadPaymentGatewayConfig();
  }, []);

  useEffect(() => {
    let active = true;
    const loadLiveStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/stats/live`);
        if (!response.ok) return;
        const data = await response.json();
        if (active && data?.totals) {
          setLiveStats({
            users: Number(data.totals.users || 0),
            triageCompleted: Number(data.totals.triageCompleted || 0),
            doctorViews: Number(data.totals.doctorViews || 0),
            activeUsersToday: Number(data.totals.activeUsersToday || 0),
          });
        }
      } catch (error) {
        // keep default zeros
      }
    };
    loadLiveStats();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authToken || !user) {
      setRecords([]);
      setReportInsights(null);
      setReportInsightsStatus("");
      setHealthPlanHomeSummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const loadedRecords = await loadRecords(activeMemberId);
      if (cancelled) return;
      if (Array.isArray(loadedRecords) && loadedRecords.length) {
        await loadReportInsights(activeMemberId, reportInsightsMonths);
      } else {
        setReportInsights(null);
        setReportInsightsStatus("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMemberId, authToken, user, reportInsightsMonths, language]);

  useEffect(() => {
    const storageKey = `health_plan_focus_${activeMemberId || "self"}`;
    setSelectedPlanFocusKey(localStorage.getItem(storageKey) || "");
  }, [activeMemberId]);

  useEffect(() => {
    if (!authToken || !user || !reportInsights) {
      setHealthPlanHomeSummary(null);
      setHealthPlanActivity([]);
      return;
    }
    let cancelled = false;
    const loadHealthPlanHomeSummary = async () => {
      const focusKey = resolveHealthPlanFocusKey(reportInsights, selectedPlanFocusKey);
      const fallbackPreview = buildHealthPlanPreview(reportInsights, focusKey);
      const reminderStorageKey = `health_plan_reminder_${focusKey}_${activeMemberId || "self"}`;
      const reminderPinned = localStorage.getItem(reminderStorageKey) === "1";
      try {
        const params = new URLSearchParams();
        params.set("focusKey", focusKey);
        if (activeMemberId) params.set("memberId", String(activeMemberId));
        const response = await apiFetch(`${API_BASE}/api/health-plan?${params.toString()}`);
        const data = await response.json();
        if (!response.ok || !data?.plan) {
          if (!cancelled) {
            setHealthPlanHomeSummary({
              title: fallbackPreview.title,
              focusTitle: fallbackPreview.focusTitle,
              focusSummary: fallbackPreview.focusSummary,
              todayCompleted: 0,
              streakDays: 0,
              latestActivityAt: "",
              nextReviewAt: nextAppointment?.scheduled_at || followupDue?.followup_date || "",
              nextCheckIn: reminderPinned ? deriveNextCheckIn({ completedToday: 0, taskCount: 3 }) : null,
            });
            setHealthPlanActivity([]);
          }
          return;
        }
        if (!selectedPlanFocusKey && data.plan?.focusKey && data.plan.focusKey !== selectedPlanFocusKey) {
          const storageKey = `health_plan_focus_${activeMemberId || "self"}`;
          localStorage.setItem(storageKey, data.plan.focusKey);
          setSelectedPlanFocusKey(data.plan.focusKey);
        }
        const progress = data.plan?.progress && typeof data.plan.progress === "object" ? data.plan.progress : {};
        const todayKey = new Date().toISOString().slice(0, 10);
        const todayCompleted = Object.values(progress[todayKey] || {}).filter(Boolean).length;
        let streakDays = 0;
        const cursor = new Date();
        while (true) {
          const key = cursor.toISOString().slice(0, 10);
          if (!Object.values(progress[key] || {}).some(Boolean)) break;
          streakDays += 1;
          cursor.setDate(cursor.getDate() - 1);
        }
        if (cancelled) return;
        const normalizedActivity = Array.isArray(data.activity)
          ? data.activity.map((entry) => ({
              ...entry,
              trackerKey: entry.trackerKey || entry.tracker_key || "",
              value: entry.value || entry.value_text || "",
              loggedAt: entry.loggedAt || entry.logged_at || "",
            }))
          : [];
        setHealthPlanActivity(normalizedActivity);
        setHealthPlanHomeSummary({
          title: data.plan.title,
          focusTitle: data.plan.focusTitle,
          focusSummary: data.plan.focusSummary,
          todayCompleted,
          streakDays,
          latestActivityAt: normalizedActivity[0]?.loggedAt || "",
          nextReviewAt: nextAppointment?.scheduled_at || followupDue?.followup_date || "",
          nextCheckIn: reminderPinned ? deriveNextCheckIn({ completedToday: todayCompleted, taskCount: 3 }) : null,
        });
      } catch {
        if (!cancelled) {
          setHealthPlanHomeSummary({
            title: fallbackPreview.title,
            focusTitle: fallbackPreview.focusTitle,
            focusSummary: fallbackPreview.focusSummary,
            todayCompleted: 0,
            streakDays: 0,
            latestActivityAt: "",
            nextReviewAt: nextAppointment?.scheduled_at || followupDue?.followup_date || "",
            nextCheckIn: reminderPinned ? deriveNextCheckIn({ completedToday: 0, taskCount: 3 }) : null,
          });
          setHealthPlanActivity([]);
        }
      }
    };
    loadHealthPlanHomeSummary();
    return () => {
      cancelled = true;
    };
  }, [activeMemberId, authToken, user, reportInsights, selectedPlanFocusKey, nextAppointment?.scheduled_at, followupDue?.followup_date]);

  useEffect(() => {
    if (!authToken || !user) {
      setHealthContinuityAgent(null);
      return;
    }
    let cancelled = false;
    const loadHealthContinuityAgent = async () => {
      try {
        const params = new URLSearchParams();
        params.set("months", "12");
        if (activeMemberId) params.set("memberId", String(activeMemberId));
        params.set("lang", language);
        const response = await apiFetch(`${API_BASE}/api/health-continuity-agent?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load health memory.");
        if (!cancelled) setHealthContinuityAgent(data.agent || null);
      } catch {
        if (!cancelled) setHealthContinuityAgent(null);
      }
    };
    loadHealthContinuityAgent();
    return () => {
      cancelled = true;
    };
  }, [activeMemberId, authToken, user, records.length, reportInsights, healthPlanActivity.length, language]);

  useEffect(() => {
    if (!activeConsultId) {
      setConsultMessages([]);
      setConsultConsentSummary(null);
      return;
    }
    loadConsultMessages(activeConsultId);
    loadConsultConsent(activeConsultId);
  }, [activeConsultId, authToken, activeConsult?.mode]);

  useEffect(() => {
    if (!authToken || !activeConsultId || !teleconsultRoomOpen) return undefined;
    const stream = new EventSource(`${API_BASE}/api/teleconsults/${activeConsultId}/events?token=${encodeURIComponent(authToken)}`);
    const handleMessageCreated = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        const nextMessage = payload.message;
        if (!nextMessage) return;
        setConsultMessages((prev) => (prev.some((item) => item.id === nextMessage.id) ? prev : [...prev, nextMessage]));
      } catch {
        // ignore malformed events
      }
    };
    const handleConsultUpdated = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        const nextConsult = payload.consult;
        if (!nextConsult) return;
        setTeleconsults((prev) => prev.map((item) => (item.id === nextConsult.id ? { ...item, ...nextConsult } : item)));
      } catch {
        // ignore malformed events
      }
    };
    const handleConsentUpdated = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        setConsultConsentSummary((prev) => ({
          ...(prev || {}),
          ...(payload.summary || {}),
        }));
      } catch {
        // ignore malformed events
      }
    };
    stream.addEventListener("message_created", handleMessageCreated);
    stream.addEventListener("consult_updated", handleConsultUpdated);
    stream.addEventListener("consent_updated", handleConsentUpdated);
    stream.onerror = () => {
      setConsultMessageStatus((prev) => prev || "Live consult updates were interrupted. Reopen the consult if needed.");
    };
    return () => stream.close();
  }, [authToken, activeConsultId, teleconsultRoomOpen]);

  useEffect(() => {
    if (!activeEncounterId) {
      setEncounterDetail(null);
      return;
    }
    loadEncounterDetail(activeEncounterId);
  }, [activeEncounterId, authToken]);

  useEffect(() => {
    if (!user || isOpsUser || !authToken) return;
    loadNotifications();
    if (activePatientTab === "alerts") {
      loadNotificationSettings();
      markNotificationsRead();
    }
    if (activePatientTab === "settings") {
      loadSupportRequests();
    }
  }, [activePatientTab, user?.id, user?.role, authToken]);

  useEffect(() => {
    if (!user || isOpsUser || !authToken) return undefined;
    const intervalId = window.setInterval(() => {
      loadAppointments();
      loadNotifications();
      loadHospitalContent();
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [user?.id, user?.role, authToken, isOpsUser]);

  useEffect(() => {
    if (!user || isOpsUser || !authToken) return;

    const refreshMarketplace = () => {
      loadMarketplaceRequests();
      loadMarketplaceAnalytics();
    };

    const handleStorage = (event) => {
      if (event.key === MARKETPLACE_REFRESH_KEY) {
        refreshMarketplace();
      }
    };

    window.addEventListener("focus", refreshMarketplace);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", refreshMarketplace);
      window.removeEventListener("storage", handleStorage);
    };
  }, [user?.id, user?.role, authToken]);

  useEffect(() => {
    const handleAuthStorage = (event) => {
      if (!["health_token", "health_refresh_token", "health_user", "health_session_id"].includes(event.key || "")) {
        return;
      }
      const nextToken = localStorage.getItem("health_token") || "";
      const nextRefreshToken = localStorage.getItem("health_refresh_token") || "";
      const nextSessionId = localStorage.getItem("health_session_id") || "";
      const nextUserRaw = localStorage.getItem("health_user");
      if (!nextToken && !nextRefreshToken) {
        clearAuthState({ keepAuthError: true });
        return;
      }
      setAuthToken(nextToken);
      latestAuthTokenRef.current = nextToken;
      setRefreshToken(nextRefreshToken);
      latestRefreshTokenRef.current = nextRefreshToken;
      setSessionId(nextSessionId);
      if (nextUserRaw) {
        try {
          setUser(JSON.parse(nextUserRaw));
        } catch (error) {
          setUser(null);
          localStorage.removeItem("health_user");
        }
      } else {
        setUser(null);
      }
    };

    window.addEventListener("storage", handleAuthStorage);
    return () => window.removeEventListener("storage", handleAuthStorage);
  }, [clearAuthState]);

  useEffect(() => {
    if (!user || isOpsUser) return;
    loadLabListings(labMode, labArea);
  }, [labMode, labArea]);

  useEffect(() => {
    if (!user || isOpsUser) return;
    loadPharmacyListings(pharmacyMode);
  }, [pharmacyMode]);

  useEffect(() => {
    if (["pharmacy", "hospital", "triage", "timeline"].includes(activePatientTab)) {
      setActivePatientTab("home");
    }
  }, [activePatientTab]);

  useEffect(() => {
    if (!isOnline || pendingActionQueue.length === 0) return;
    retryPendingActions();
  }, [isOnline, pendingActionQueue.length, authToken]);

  useEffect(() => {
    if (doctorConsoleMode) {
      if (!labConsoleMode) {
        loadTeleconsults();
        loadAppointments();
        loadEncounters();
      }
      if (!labConsoleMode && user?.id && (user.role === "doctor" || user.role === "admin")) {
        loadDoctorSchedule(user.id);
      }
    }
  }, [doctorConsoleMode, labConsoleMode, user?.id, user?.role]);

  useEffect(() => {
    if (!labConsoleMode) return;
    redirectToOpsLabDesk();
  }, [labConsoleMode, redirectToOpsLabDesk]);

  if (labConsoleMode) {
    return (
      <AppSectionFallback />
    );
  }

  if (doctorConsoleMode) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <DoctorConsolePage
          consoleMode={labConsoleMode ? "lab" : "doctor"}
          t={t}
          apiBase={API_BASE}
          apiFetch={apiFetch}
          user={user}
          sessionReady={sessionReady}
          authToken={authToken}
          handleAuth={handleAuth}
          authForm={authForm}
          updateAuthField={updateAuthField}
          authError={authError}
          signOut={signOut}
          loadTeleconsults={loadTeleconsults}
          loadAppointments={loadAppointments}
          loadEncounters={loadEncounters}
          loadDoctorSchedule={loadDoctorSchedule}
          scheduleForm={scheduleForm}
          updateScheduleRow={updateScheduleRow}
          weekdayLabel={weekdayLabel}
          removeScheduleRow={removeScheduleRow}
          addScheduleRow={addScheduleRow}
          saveDoctorSchedule={saveDoctorSchedule}
          scheduleStatus={scheduleStatus}
          teleLoading={teleLoading}
          teleconsults={teleconsults}
          activeConsultId={activeConsultId}
          setActiveConsultId={setActiveConsultId}
          activeConsult={activeConsult}
          doctorConsoleForm={doctorConsoleForm}
          setDoctorConsoleForm={setDoctorConsoleForm}
          updateConsultStatus={updateConsultStatus}
          doctorConsoleStatus={doctorConsoleStatus}
          consultMessages={consultMessages}
          appointments={appointments}
          doctorChartForm={doctorChartForm}
          setDoctorChartForm={setDoctorChartForm}
          createEncounterFromDoctor={createEncounterFromDoctor}
          encounters={encounters}
          activeEncounterId={activeEncounterId}
          setActiveEncounterId={setActiveEncounterId}
          noteForm={noteForm}
          setNoteForm={setNoteForm}
          addDoctorNote={addDoctorNote}
          prescriptionForm={prescriptionForm}
          setPrescriptionForm={setPrescriptionForm}
          addPrescription={addPrescription}
          orderForm={orderForm}
          setOrderForm={setOrderForm}
          addOrder={addOrder}
          doctorChartStatus={doctorChartStatus}
          teleStatusLabel={teleStatusLabel}
        />
      </Suspense>
    );
  }

  if (clinicMode) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <ClinicPage
          t={t}
          doctorLang={doctorLang}
          setDoctorLang={setDoctorLang}
          clinicCode={clinicCode}
          setClinicCode={setClinicCode}
          openClinicSummary={openClinicSummary}
          scannerActive={scannerActive}
          startScanner={startScanner}
          stopScanner={stopScanner}
          clinicVideoRef={clinicVideoRef}
          clinicStatus={clinicStatus}
        />
      </Suspense>
    );
  }

  if (launchCampaignMode) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <LaunchCampaignPage
          apiBase={API_BASE}
          supportWhatsapp={policyBundle?.support?.whatsapp || ""}
        />
      </Suspense>
    );
  }

  if (resetPasswordPageMode) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <ResetPasswordPage
          t={t}
          resetForm={resetForm}
          setResetForm={setResetForm}
          confirmPasswordReset={confirmPasswordReset}
          resetStatus={resetStatus}
        />
      </Suspense>
    );
  }

  if (emergencyPublicId) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <EmergencyCardPage
          t={t}
          emergencyLoading={emergencyLoading}
          emergencyData={emergencyData}
        />
      </Suspense>
    );
  }

  if (doctorCode) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <DoctorViewPage
          t={t}
          doctorLang={doctorLang}
          setDoctorLang={(lang) => {
            setDoctorLang(lang);
            setLanguage(lang);
          }}
          doctorViewLoading={doctorViewLoading}
          doctorViewData={doctorViewData}
          handleDoctorQuickRating={handleDoctorQuickRating}
          doctorRatingStatus={doctorRatingStatus}
          apiBase={API_BASE}
        />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<AppSectionFallback />}>
        <GuestLanding
          t={t}
          authMode={authMode}
          setAuthMode={setAuthMode}
          handleAuth={handleAuth}
          authForm={authForm}
          updateAuthField={updateAuthField}
          authError={authError}
          resetForm={resetForm}
          setResetForm={setResetForm}
          requestPasswordReset={requestPasswordReset}
          resetStatus={resetStatus}
          policyBundle={policyBundle}
        />
      </Suspense>
    );
  }

  if (user && !isOpsUser) {
    const primaryPatientTabs = [
      { key: "home", label: t("nav_today"), icon: "home" },
      { key: "reports", label: t("nav_reports"), icon: "records" },
      { key: "plan", label: t("nav_actions"), icon: "plan" },
      { key: "profile", label: t("nav_profile"), icon: "profile" },
    ];

    return (
      <div className="app mobile-app-shell">
        <header className="nav patient-topbar">
          <div className="patient-topbar-center" aria-label="SehatSaathi">
            <div className="patient-topbar-brand">
              <div className="logo-mark">
                <img src="/sehatsaathi-logo.jpg" alt="SehatSaathi logo" />
              </div>
              <div className="patient-topbar-brand-copy">
                <span>SehatSaathi</span>
                <small>{t("health_companion")}</small>
              </div>
            </div>
          </div>
          <div className="patient-topbar-lang">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`gl-lang-btn${language === l.code ? " active" : ""}`}
                onClick={() => setLanguage(l.code)}
                aria-label={l.name}
              >
                {l.label}
              </button>
            ))}
          </div>
        </header>

        {showOfflineBanner ? (
          <div className="network-banner">{t("offline_mode")}</div>
        ) : null}
        {pendingActionQueue.length > 0 ? (
          <div className="network-banner subtle">
            {t("pending_sync", {
              n: pendingActionQueue.length,
              s: pendingActionQueue.length === 1 ? "" : "s",
            })}
          </div>
        ) : null}

        {showPatientOnboarding ? (
          <div className="modal-backdrop onboarding-backdrop" onClick={() => setShowPatientOnboarding(false)}>
            <div className="modal onboarding-modal" onClick={(event) => event.stopPropagation()}>
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">{t("quick_setup")}</p>
                  <h2>{t("setup_health_memory")}</h2>
                  <p className="panel-sub">{t("setup_intro")}</p>
                </div>
                <button type="button" className="ghost" onClick={() => setShowPatientOnboarding(false)}>
                  {t("skip_setup")}
                </button>
              </div>
              <div className="onboarding-step-grid">
                <label>
                  <span>{t("onboarding_age")}</span>
                  <input
                    type="number"
                    min="0"
                    value={profileForm.age}
                    onChange={(event) => updateProfileField("age", event.target.value)}
                    placeholder={t("age_example")}
                  />
                </label>
                <label>
                  <span>{t("onboarding_sex")}</span>
                  <select value={profileForm.sex} onChange={(event) => updateProfileField("sex", event.target.value)}>
                    <option value="">{t("select")}</option>
                    <option value="female">{t("female")}</option>
                    <option value="male">{t("male")}</option>
                    <option value="other">{t("other")}</option>
                    <option value="prefer_not_to_say">{t("prefer_not_say")}</option>
                  </select>
                </label>
                <label>
                  <span>{t("onboarding_phone")}</span>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(event) => updateProfileField("phone", event.target.value)}
                    placeholder={t("phone_example")}
                  />
                </label>
                <label>
                  <span>{t("onboarding_condition")}</span>
                  <input
                    value={profileForm.conditions}
                    onChange={(event) => updateProfileField("conditions", event.target.value)}
                    placeholder={t("condition_example")}
                  />
                </label>
                <label>
                  <span>{t("onboarding_allergies")}</span>
                  <input
                    value={profileForm.allergies}
                    onChange={(event) => updateProfileField("allergies", event.target.value)}
                    placeholder={t("optional")}
                  />
                </label>
              </div>
              {profileStatus ? <p className="micro">{profileStatus}</p> : null}
              <div className="action-row">
                <button
                  type="button"
                  className="primary"
                  onClick={finishPatientOnboarding}
                  disabled={!profileForm.sex || !profileForm.phone || Boolean(profileValidationErrors.phone)}
                >
                  {t("save_upload_report")}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setShowPatientOnboarding(false);
                    openPatientTab("reports");
                  }}
                >
                  {t("upload_first")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showTriageDisclaimer ? (
          <div className="modal-backdrop" onClick={() => setShowTriageDisclaimer(false)}>
            <div className="modal triage-disclaimer-modal" onClick={(event) => event.stopPropagation()}>
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">Important</p>
                  <h2>Triage safety notice</h2>
                  <p className="panel-sub">
                    This triage is only general health guidance. It is not medical advice, not a diagnosis, and not a substitute for a doctor&apos;s examination or treatment.
                  </p>
                </div>
              </div>
              <div className="history-list compact-list">
                <div className="history-card">
                  <p className="micro">
                    If symptoms are severe, worsening, or feel urgent, please contact a doctor or visit a hospital immediately.
                  </p>
                </div>
              </div>
              <div className="action-row" style={{ marginTop: 16 }}>
                <button type="button" className="ghost" onClick={() => {
                  setShowTriageDisclaimer(false);
                  setActivePatientTab("home");
                }}>
                  Go back
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={async () => {
                    setShowTriageDisclaimer(false);
                    await logConsentAcceptance("triage_safety_notice");
                  }}
                >
                  I understand
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <Suspense fallback={<AppSectionFallback />}>
        <main className="patient-mobile-main">
          <div key={activePatientTab} className="patient-tab-stage">
          {activePatientTab === "home" && (
            <PatientHomePanel
              user={user}
              profileForm={profileForm}
              profileSummary={profileSummary}
              profileCompletion={profileCompletion}
              records={records}
              pendingServiceRequests={pendingServiceRequests}
              unreadNotificationsCount={unreadNotificationsCount}
              setActivePatientTab={openPatientTab}
              nextAppointment={nextAppointment}
              latestHospitalUpdate={latestHospitalUpdate}
              lastGuidance={lastGuidance}
              healthPlanHomeSummary={healthPlanHomeSummary}
              healthPlanActivity={healthPlanActivity}
              healthContinuityAgent={healthContinuityAgent}
              reportInsights={reportInsights}
              t={t}
              openProfileEditor={openProfileEditor}
              sharePass={sharePass}
              sharePassStatus={sharePassStatus}
              shareQr={shareQr}
              generateSharePass={generateSharePass}
            />
          )}

          {activePatientTab === "appointments" && (
            <AppointmentsPanel
              t={t}
              teleStatusLabel={teleStatusLabel}
              submitCareRequest={submitCareRequest}
              careRequestMode={careRequestMode}
              setCareRequestMode={setCareRequestMode}
              appointmentForm={appointmentForm}
              setAppointmentForm={setAppointmentForm}
              departments={departments}
              departmentDoctors={departmentDoctors}
              availableSlots={availableSlots}
              slotStatus={slotStatus}
              teleForm={teleForm}
              updateTeleField={updateTeleField}
              teleStatus={teleStatus}
              appointmentsStatus={appointmentsStatus}
              appointmentsViewTab={appointmentsViewTab}
              setAppointmentsViewTab={setAppointmentsViewTab}
              futureAppointments={futureAppointments}
              pastAppointments={pastAppointments}
              requestedAppointments={requestedAppointments}
              requestedCare={requestedCare}
              openAppointmentDetail={openAppointmentDetail}
              openTeleconsultRoom={openTeleconsultRoom}
              paymentGatewayConfig={paymentGatewayConfig}
              payForAppointment={payForAppointment}
              payForTeleconsult={payForTeleconsult}
              paymentLoadingKey={paymentLoadingKey}
              consultPaymentStatus={consultPaymentStatus}
            />
          )}

          {activePatientTab === "plan" && (
            <ActionsPanel
              reportInsights={reportInsights}
              activeMemberId={activeMemberId}
              apiBase={API_BASE}
              apiFetch={apiFetch}
              healthPlanHomeSummary={healthPlanHomeSummary}
              healthPlanActivity={healthPlanActivity}
              onActivitySaved={(activity, plan = null) => {
                const normalizedActivity = Array.isArray(activity)
                  ? activity.map((entry) => ({
                      ...entry,
                      trackerKey: entry.trackerKey || entry.tracker_key || "",
                      value: entry.value || entry.value_text || "",
                      loggedAt: entry.loggedAt || entry.logged_at || "",
                    }))
                  : [];
                setHealthPlanActivity(normalizedActivity);
                if (plan) {
                  setHealthPlanHomeSummary((prev) => ({
                    ...(prev || {}),
                    title: plan.title || prev?.title || "",
                    focusTitle: plan.focusTitle || prev?.focusTitle || "",
                    focusSummary: plan.focusSummary || prev?.focusSummary || "",
                    latestActivityAt: normalizedActivity[0]?.loggedAt || prev?.latestActivityAt || "",
                  }));
                }
              }}
              healthContinuityAgent={healthContinuityAgent}
              onGoToReports={() => setActivePatientTab("reports")}
            />
          )}

          {activePatientTab === "timeline" && (
            <HealthTimelinePanel
              timelineItems={timelineItems}
              nextAppointment={nextAppointment}
              followupDue={followupDue}
              onBookFollowup={() => openPatientTab("appointments")}
              onOpenReports={() => openPatientTab("reports")}
              onOpenPlan={() => openPatientTab("plan")}
              onOpenVisits={() => openPatientTab("appointments")}
              onOpenRecords={() => openPatientTab("clinical")}
            />
          )}

          {activePatientTab === "clinical" && (
            <ClinicalRecordsPanel
              encounters={encounters}
              activeEncounterId={activeEncounterId}
              setActiveEncounterId={setActiveEncounterId}
              encounterDetail={encounterDetail}
              encounterStatus={encounterStatus}
            />
          )}

          {activePatientTab === "reports" && (
            <ReportsPanel
              records={records}
              reportCatalog={reportCatalog}
              reportExtractionCapabilities={reportExtractionCapabilities}
              reportInsights={reportInsights}
              reportInsightsStatus={reportInsightsStatus}
              reportInsightsMonths={reportInsightsMonths}
              setReportInsightsMonths={setReportInsightsMonths}
              activeAnalysisRecordId={activeAnalysisRecordId}
              setActiveAnalysisRecordId={setActiveAnalysisRecordId}
              recordAnalysisDrafts={recordAnalysisDrafts}
              updateRecordAnalysisDraft={updateRecordAnalysisDraft}
              autoSuggestRecordAnalysis={autoSuggestRecordAnalysis}
              saveRecordAnalysis={saveRecordAnalysis}
              openRecordUploader={openRecordUploader}
              recordsInputRef={recordsInputRef}
              uploadRecord={uploadRecord}
              recordStatus={recordStatus}
              apiBase={API_BASE}
              deleteRecord={deleteRecord}
              onStartPlan={() => openPatientTab("plan")}
              onBookFollowup={() => openPatientTab("plan")}
              onBookLabs={openRecordUploader}
              t={t}
            />
          )}

          {activePatientTab === "triage" && (
            <TriagePanel
              t={t}
              submitTriage={submitTriage}
              triageType={triageType}
              setTriageType={setTriageType}
              triageForm={triageForm}
              updateTriageField={updateTriageField}
              dentalForm={dentalForm}
              updateDentalField={updateDentalField}
              commonSymptoms={commonSymptoms}
              dentalSymptomsOptions={dentalSymptomsOptions}
              redFlagOptions={redFlagOptions}
              dentalRedFlagOptions={dentalRedFlagOptions}
              toggleArrayValue={toggleArrayValue}
              toggleDentalArrayValue={toggleDentalArrayValue}
              translateSymptom={translateSymptom}
              triageLoading={triageLoading}
              triageError={triageError}
              triageResult={triageResult}
              history={history}
              saveTriageDraftNow={saveTriageDraftWithFeedback}
              clearTriageDraft={clearTriageDraft}
              triageDraftStatus={triageDraftStatus}
              triageHistoryQuery={triageHistoryQuery}
              setTriageHistoryQuery={setTriageHistoryQuery}
              triageHistoryLevel={triageHistoryLevel}
              setTriageHistoryLevel={setTriageHistoryLevel}
              filteredHistory={filteredHistory}
            />
          )}

          {activePatientTab === "labs" && (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Retest follow-up</p>
                  <h2>Follow-up timing and retest guidance</h2>
                  <p className="panel-sub">See what may be worth rechecking, when, and why before choosing a nearby lab option.</p>
                </div>
              </div>
              <MarketplaceView
                type="labs"
                reportInsights={reportInsights}
                records={records}
                labListings={labListings}
                pharmacyListings={pharmacyListings}
                labAreaSearch={labAreaSearch}
                setLabAreaSearch={setLabAreaSearch}
                labArea={labArea}
                setLabArea={setLabArea}
                labAreas={labAreas}
                labMode={labMode}
                setLabMode={setLabMode}
                activeLabId={activeLabId}
                setActiveLabId={setActiveLabId}
                labSort={labSort}
                setLabSort={setLabSort}
                pharmacySearch={pharmacySearch}
                setPharmacySearch={setPharmacySearch}
                pharmacyMode={pharmacyMode}
                setPharmacyMode={setPharmacyMode}
                pharmacySort={pharmacySort}
                setPharmacySort={setPharmacySort}
                cartItems={cartItems}
                cartTotal={cartTotal}
                setCartOpen={setCartOpen}
                marketplaceLoading={marketplaceLoading}
                marketplaceRequests={marketplaceRequests}
                marketplaceTimelineOpenByRequest={marketplaceTimelineOpenByRequest}
                toggleMarketplaceRequestTimeline={toggleMarketplaceRequestTimeline}
                updateMarketplaceRequestStatus={updateMarketplaceRequestStatus}
                marketplaceTimelineByRequest={marketplaceTimelineByRequest}
                marketplaceTimelineLoadingByRequest={marketplaceTimelineLoadingByRequest}
                marketplaceStatus={marketplaceStatus}
                marketplaceAnalytics={marketplaceAnalytics}
                labRequestsView={labRequestsView}
                setLabRequestsView={setLabRequestsView}
                pharmacyRequestsView={pharmacyRequestsView}
                setPharmacyRequestsView={setPharmacyRequestsView}
                sortLabs={sortLabs}
                sortPharmacies={sortPharmacies}
                formatPriceLastUpdated={formatPriceLastUpdated}
                formatFulfillmentTime={formatFulfillmentTime}
                formatMarketplaceStatus={formatMarketplaceStatus}
                addToCart={addToCart}
              />
            </section>
          )}

          {activePatientTab === "pharmacy" && (
            <section className="panel">
              <h2>Pharmacy</h2>
              <MarketplaceView
                type="pharmacy"
                reportInsights={reportInsights}
                records={records}
                labListings={labListings}
                pharmacyListings={pharmacyListings}
                labAreaSearch={labAreaSearch}
                setLabAreaSearch={setLabAreaSearch}
                labArea={labArea}
                setLabArea={setLabArea}
                labAreas={labAreas}
                labMode={labMode}
                setLabMode={setLabMode}
                activeLabId={activeLabId}
                setActiveLabId={setActiveLabId}
                labSort={labSort}
                setLabSort={setLabSort}
                pharmacySearch={pharmacySearch}
                setPharmacySearch={setPharmacySearch}
                pharmacyMode={pharmacyMode}
                setPharmacyMode={setPharmacyMode}
                pharmacySort={pharmacySort}
                setPharmacySort={setPharmacySort}
                cartItems={cartItems}
                cartTotal={cartTotal}
                setCartOpen={setCartOpen}
                marketplaceLoading={marketplaceLoading}
                marketplaceRequests={marketplaceRequests}
                marketplaceTimelineOpenByRequest={marketplaceTimelineOpenByRequest}
                toggleMarketplaceRequestTimeline={toggleMarketplaceRequestTimeline}
                updateMarketplaceRequestStatus={updateMarketplaceRequestStatus}
                marketplaceTimelineByRequest={marketplaceTimelineByRequest}
                marketplaceTimelineLoadingByRequest={marketplaceTimelineLoadingByRequest}
                marketplaceStatus={marketplaceStatus}
                marketplaceAnalytics={marketplaceAnalytics}
                labRequestsView={labRequestsView}
                setLabRequestsView={setLabRequestsView}
                pharmacyRequestsView={pharmacyRequestsView}
                setPharmacyRequestsView={setPharmacyRequestsView}
                sortLabs={sortLabs}
                sortPharmacies={sortPharmacies}
                formatPriceLastUpdated={formatPriceLastUpdated}
                formatFulfillmentTime={formatFulfillmentTime}
                formatMarketplaceStatus={formatMarketplaceStatus}
                addToCart={addToCart}
              />
            </section>
          )}

          {activePatientTab === "hospital" && (
            <HospitalContentView
              hospitalContent={hospitalContent}
              hospitalContentStatus={hospitalContentStatus}
              hospitalSections={hospitalSections}
              activeHospitalSection={activeHospitalSection}
              setActiveHospitalSection={setActiveHospitalSection}
            />
          )}

          {activePatientTab === "profile" && (
            <ProfileInlineEditor
              t={t}
              profileEditMode={profileEditMode}
              setProfileEditMode={setProfileEditMode}
              profileCompletion={profileCompletion}
              profileForm={profileForm}
              departments={departments}
              profileDepartmentDoctors={profileDepartmentDoctors}
              saveProfile={saveProfile}
              updateProfileField={updateProfileField}
              setProfileForm={setProfileForm}
              profileStatus={profileStatus}
              signOut={signOut}
              deleteMyData={deleteMyData}
            />
          )}

          {activePatientTab === "alerts" && (
            <AlertsPanel
              notifications={notifications}
              notificationSettings={notificationSettings}
              notificationSettingsStatus={notificationSettingsStatus}
              saveNotificationSettings={saveNotificationSettings}
              markAllAndRefresh={markNotificationsReadWithFeedback}
              loadNotifications={loadNotifications}
            />
          )}

          {activePatientTab === "settings" && (
            <SettingsPanel
              policyBundle={policyBundle}
              supportRequests={supportRequests}
              supportRequestDraft={supportRequestDraft}
              setSupportRequestDraft={setSupportRequestDraft}
              supportRequestStatus={supportRequestStatus}
              submitSupportRequest={submitSupportRequest}
              exportPrivacyData={exportPrivacyData}
              deleteMyData={deleteMyData}
              privacyActionStatus={privacyActionStatus}
            />
          )}
          </div>

          {cartOpen ? (
            <div className="modal-backdrop" onClick={() => setCartOpen(false)}>
              <div className="modal appointment-modal marketplace-checkout-modal-shell" onClick={(event) => event.stopPropagation()}>
                <div className="marketplace-checkout-hero">
                  <div>
                    <p className="eyebrow">Checkout</p>
                    <h2>Confirm your requests</h2>
                    <p className="panel-sub">
                      {cartItems.length} {cartItems.length === 1 ? "item" : "items"} ready for checkout
                    </p>
                  </div>
                  <button className="ghost" type="button" onClick={() => setCartOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="marketplace-checkout-shell">
                  <div className="marketplace-checkout-card">
                    <div className="marketplace-checkout-card-head">
                      <div>
                        <p className="eyebrow">Order summary</p>
                        <h3>Your cart</h3>
                      </div>
                      <div className="marketplace-checkout-total-pill">Rs {cartTotal}</div>
                    </div>

                    {cartItems.length === 0 ? (
                      <div className="marketplace-checkout-empty">
                        <p className="history-headline">Your cart is empty</p>
                        <p className="micro">Add a test or medicine request to continue.</p>
                      </div>
                    ) : (
                      <div className="marketplace-cart-list">
                        {cartItems.map((item) => (
                          <article key={`cart-${item.id}`} className="marketplace-cart-card">
                            <div className="marketplace-cart-card-head">
                              <div>
                                <p className="history-headline">{item.serviceName}</p>
                                <p className="micro">{item.partnerName || "Partner"}</p>
                              </div>
                              <strong className="marketplace-cart-price">Rs {item.listedPrice}</strong>
                            </div>
                            <div className="marketplace-cart-meta-row">
                              <span className="marketplace-cart-mode-pill">
                                {String(item.fulfillmentMode || "service").replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="marketplace-cart-card-footer">
                              <button type="button" className="ghost" onClick={() => removeCartItem(item.id)}>
                                Remove
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="marketplace-checkout-card">
                    <div className="marketplace-checkout-card-head">
                      <div>
                        <p className="eyebrow">Delivery details</p>
                        <h3>Where should we send the partner?</h3>
                      </div>
                    </div>

                    <div className="marketplace-checkout-fields marketplace-checkout-fields-strong">
                      <label className="block">
                        Delivery / visit address
                        <textarea
                          rows={4}
                          value={checkoutAddress}
                          onChange={(event) => setCheckoutAddress(event.target.value)}
                          placeholder="House, street, landmark, city"
                        />
                      </label>
                      <label className="block">
                        Notes for partner
                        <input
                          type="text"
                          value={checkoutNotes}
                          onChange={(event) => setCheckoutNotes(event.target.value)}
                          placeholder="Optional instructions"
                        />
                      </label>
                    </div>

                    <div className="marketplace-checkout-summary-box">
                      <div className="marketplace-checkout-summary-row">
                        <span>Items</span>
                        <strong>{cartItems.length}</strong>
                      </div>
                      <div className="marketplace-checkout-summary-row total">
                        <span>Total</span>
                        <strong>Rs {cartTotal}</strong>
                      </div>
                    </div>

                    <div className="marketplace-checkout-footer-strong">
                      <button
                        className="primary marketplace-checkout-submit"
                        type="button"
                        onClick={checkoutCart}
                        disabled={checkoutLoading || cartItems.length === 0}
                      >
                        {checkoutLoading ? "Processing..." : `Place order • Rs ${cartTotal}`}
                      </button>
                      {checkoutStatus ? <p className="micro marketplace-checkout-status">{checkoutStatus}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

      {appointmentDetail ? (
        <Suspense fallback={<AppSectionFallback compact />}>
        <AppointmentDetailModal
              appointmentDetail={appointmentDetail}
              closeAppointmentDetail={closeAppointmentDetail}
              appointmentRescheduleForm={appointmentRescheduleForm}
              setAppointmentRescheduleForm={setAppointmentRescheduleForm}
              rescheduleAppointmentFromDetail={rescheduleAppointmentFromDetail}
              cancelAppointmentFromDetail={cancelAppointmentFromDetail}
              appointmentActionStatus={appointmentActionStatus}
              appointmentTimeline={appointmentTimeline}
              paymentGatewayConfig={paymentGatewayConfig}
              payForAppointment={payForAppointment}
              paymentLoadingKey={paymentLoadingKey}
              consultPaymentStatus={consultPaymentStatus}
            />
        </Suspense>
      ) : null}

      {teleconsultRoomOpen && activeConsult ? (
        <Suspense fallback={<AppSectionFallback compact />}>
        <TeleconsultRoomModal
          consult={activeConsult}
          authToken={authToken}
          apiBase={API_BASE}
          currentUserId={user?.id}
          closeTeleconsultRoom={closeTeleconsultRoom}
          teleStatusLabel={teleStatusLabel}
          consultMessages={consultMessages}
          consultConsentSummary={consultConsentSummary}
          acceptConsultConsent={acceptConsultConsent}
          consultMessageText={consultMessageText}
          setConsultMessageText={setConsultMessageText}
          sendConsultMessage={sendConsultMessage}
          consultMessageStatus={consultMessageStatus}
        />
        </Suspense>
      ) : null}

        {profileEditMode && activePatientTab !== "profile" ? (
          <Suspense fallback={<AppSectionFallback compact />}>
          <ProfileEditModal
            user={user}
            setProfileEditMode={setProfileEditMode}
            saveProfile={saveProfile}
            profileWizardStep={profileWizardStep}
            setProfileWizardStep={setProfileWizardStep}
            profileForm={profileForm}
            updateProfileField={updateProfileField}
            setProfileForm={setProfileForm}
            departments={departments}
            profileDepartmentDoctors={profileDepartmentDoctors}
            profileValidationErrors={profileValidationErrors}
            profileStepReady={profileStepReady}
            profileStatus={profileStatus}
            t={t}
          />
          </Suspense>
        ) : null}
        </main>
        </Suspense>

        {uiToast ? (
          <div className={`patient-ui-toast is-${uiToast.tone}`} role="status" aria-live="polite">
            <span className="patient-ui-toast-dot" aria-hidden="true" />
            <span>{uiToast.message}</span>
          </div>
        ) : null}

        {/* ── Floating help / feedback button ── */}
        <button
          type="button"
          className="hf-trigger"
          aria-label={t("help_feedback")}
          onClick={() => setHelpSheetOpen(true)}
        >
          ?
        </button>

        <HelpAndFeedbackSheet
          open={helpSheetOpen}
          onClose={() => setHelpSheetOpen(false)}
          supportWhatsapp={policyBundle?.support?.whatsapp || ""}
          supportEmail={policyBundle?.support?.email || ""}
          activeScreen={activePatientTab}
          apiFetch={apiFetch}
          apiBase={API_BASE}
          authToken={authToken}
        />

        <nav className="patient-bottom-nav" style={{ "--patient-tab-count": primaryPatientTabs.length }}>
          {primaryPatientTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activePatientTab === tab.key ? "active" : ""}
              onClick={() => openPatientTab(tab.key)}
              title={tab.label}
              aria-label={tab.label}
            >
              <span className="tab-icon" aria-hidden="true">
                <PatientShellIcon name={tab.icon} />
              </span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  const legacyShellProps = {
    shell: {
      t,
      language,
      setLanguage,
      user,
      signOut,
      setAuthMode,
      scrollToSection,
    },
    heroTriage: {
      t,
      language,
      user,
      signOut,
      setAuthMode,
      scrollToSection,
      isOpsUser,
      profileSummary,
      profileCompletion,
      lastGuidance,
      sharePass,
      generateSharePass,
      openRecordUploader,
      triageType,
      setTriageType,
      submitTriage,
      triageForm,
      updateTriageField,
      dentalForm,
      updateDentalField,
      commonSymptoms,
      dentalSymptomsOptions,
      redFlagOptions,
      dentalRedFlagOptions,
      toggleArrayValue,
      toggleDentalArrayValue,
      translateSymptom,
      handlePhotoChange,
      removeTriagePhoto,
      triageLoading,
      triageError,
      triageResult,
      downloadVisitPdf,
      handleGuidanceFeedback,
      handleVisitFollowup,
      feedbackStatus,
      authMode,
      handleAuth,
      authForm,
      updateAuthField,
      authError,
      resetForm,
      setResetForm,
      requestPasswordReset,
      confirmPasswordReset,
      resetStatus,
    },
    adminFallback: {
      user,
      adminOpsStatus,
      opsQueueStatus,
      adminOps,
      opsQueue,
      updateAppointmentStatus,
      billingDrafts,
      updateBillingDraft,
      saveBillingForAppointment,
      viewReceipt,
      loadAdminOps,
      loadOpsQueue,
      adminUsersStatus,
      loadAdminUsers,
      adminUsers,
      updateAdminUserDraft,
      adminSavingUserId,
      saveAdminUser,
      departments,
    },
    patientFlows: {
      t,
      user,
      isOpsUser,
      profileEditMode,
      setProfileEditMode,
      profileForm,
      departments,
      profileDepartmentDoctors,
      saveProfile,
      updateProfileField,
      setProfileForm,
      profileStatus,
      history,
      visibleHistory,
      historyExpanded,
      setHistoryExpanded,
      historyStatus,
      memberForm,
      setMemberForm,
      saveFamilyMember,
      familyStatus,
      activeMemberId,
      setActiveMemberId,
      familyMembers,
      recordsInputRef,
      uploadRecord,
      recordStatus,
      records,
      deleteRecord,
      generateEmergencyCard,
      emergencyCard,
      sharePassStatus,
      sharePass,
      generateSharePass,
      shareQr,
      shareHistory,
      careRequestMode,
      setCareRequestMode,
      submitCareRequest,
      appointmentForm,
      setAppointmentForm,
      departmentDoctors,
      availableSlots,
      slotStatus,
      teleForm,
      updateTeleField,
      teleStatus,
      appointmentsStatus,
      teleLoading,
      teleconsults,
      appointments,
      activeConsultId,
      setActiveConsultId,
      teleStatusLabel,
      activeConsult,
      consultMessages,
      sendConsultMessage,
      consultMessageText,
      setConsultMessageText,
      consultMessageStatus,
      encounters,
      activeEncounterId,
      setActiveEncounterId,
      encounterDetail,
      encounterStatus,
    },
    publicInfo: {
      t,
      formatNumber,
      liveStats,
      showDisclaimer,
      acceptDisclaimer,
      chatOpen,
      setChatOpen,
      chatMessages,
      chatLoading,
      sendChatMessage,
      chatInput,
      setChatInput,
    },
  };

  return (
    <Suspense fallback={<AppSectionFallback />}>
      <LegacyPortalShell {...legacyShellProps} />
    </Suspense>
  );
}

export default App;
