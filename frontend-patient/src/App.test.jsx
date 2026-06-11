import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import App from "./App";
import {
  computeProfileCompletion,
  formatMarketplaceStatus,
  sortLabs,
  sortPharmacies,
} from "./patientOpsUtils";
import { fallbackTriage } from "./patientOpsConfig";
import { LegacyPortalShell } from "./components/routes/LegacyPortalShell";

describe("patient ops utils", () => {
  it("computes profile completion", () => {
    const score = computeProfileCompletion({
      fullName: "Ved Patel",
      email: "ved@example.com",
      age: "22",
      sex: "Male",
      phone: "9999999999",
      abhaNumber: "12-3456-7890-1234",
    });
    expect(score).toBe(100);
  });

  it("does not mark the profile complete until ABHA is added", () => {
    const score = computeProfileCompletion({
      fullName: "Ved Patel",
      email: "ved@example.com",
      age: "22",
      sex: "Male",
      phone: "9999999999",
      abhaNumber: "",
      abhaAddress: "",
      dateOfBirth: "",
      bloodGroup: "",
    });
    expect(score).toBeLessThan(100);
  });

  it("formats marketplace status labels", () => {
    expect(formatMarketplaceStatus("out_for_delivery")).toBe("Out For Delivery");
    expect(formatMarketplaceStatus("requested")).toBe("Requested");
  });

  it("sorts labs and pharmacies by requested modes", () => {
    const labs = [
      { startingPrice: 300, homeStartingPrice: 500, etaMinutes: 40, distanceKm: 4 },
      { startingPrice: 250, homeStartingPrice: 450, etaMinutes: 20, distanceKm: 2 },
    ];
    const pharmacies = [
      { deliveryFee: 30, etaMinutes: 35, distanceKm: 3 },
      { deliveryFee: 10, etaMinutes: 15, distanceKm: 1 },
    ];
    expect(sortLabs(labs, "all", "cheapest")[0].startingPrice).toBe(250);
    expect(sortLabs(labs, "home", "cheapest")[0].startingPrice).toBe(250);
    expect(sortPharmacies(pharmacies, "cheapest")[0].deliveryFee).toBe(10);
  });

  it("handles null triage payloads safely", () => {
    const result = fallbackTriage(null);
    expect(result.level).toBe("self_care");
    expect(result.headline).toBe("Likely manageable with home care");
  });
});

describe("patient app guest shell", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });
  });

  it("renders upload-first landing and opens auth when requested", async () => {
    render(<App />);
    expect(screen.getAllByText(/Free · No account needed/)[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /upload your report/i })[0]).toBeInTheDocument();
    expect(screen.queryByText("Before we begin")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });
    expect(screen.getByText("Sign in to SehatSaathi")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });
    expect(screen.getByText("Save your report")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Patient" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Create account" }).at(-1));
    expect(await screen.findByText("What we collect")).toBeInTheDocument();
  });

  it("restores a saved session from localStorage on app reopen", async () => {
    localStorage.setItem("health_user", JSON.stringify({ id: 7, name: "Ved Patel", role: "patient" }));
    localStorage.setItem("health_token", "saved-token");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 7, name: "Ved Patel", role: "patient" } }),
    });

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/me"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer saved-token" }),
        }),
      );
    });
  });
});

describe("legacy portal shell", () => {
  const t = (key) =>
    ({
      brandTitle: "SehatSaathi",
      brandSubtitle: "Patient app",
      navCreate: "Create account",
      navSignOut: "Sign out",
      langComing: "Language",
      signIn: "Sign in",
      create: "Create",
      heroEyebrow: "Built for care",
      heroTitle: "Care access for every family",
      heroLead: "One patient app for continuity.",
      heroStart: "Start",
      heroHow: "How it works",
      heroNotice: "General guidance only.",
      safetyTitle: "Safety first",
      pillOffline: "Offline friendly",
      pillPrivacy: "Privacy focused",
      pillBharat: "Built for Bharat",
      statTime: "Avg time",
      statAccess: "Access",
      statSave: "Save",
      memberTitle: "Your care hub",
      memberSubtitle: "Everything in one place.",
      memberCardProfile: "Profile",
      memberCardLast: "Last guidance",
      memberCardPass: "Health pass",
      memberCardRecords: "Records",
      memberOpenProfile: "Open profile",
      memberOpenHistory: "Open history",
      memberOpenPass: "Open pass",
      memberUploadDocs: "Upload docs",
      memberNoTriage: "No guidance yet",
      historyTitle: "History",
      historyEmpty: "No history yet",
      familyTitle: "Family",
      name: "Name",
      relation: "Relation",
      age: "Age",
      sex: "Sex",
      bloodType: "Blood group",
      conditions: "Conditions",
      allergies: "Allergies",
      addMember: "Add member",
      recordsTitle: "Records",
      uploadRecord: "Upload record",
      removeRecord: "Remove",
      generateEmergencyCard: "Generate emergency card",
      openEmergencyCard: "Emergency card",
      healthPassTitle: "Health pass",
      healthPassBody: "Share with doctors.",
      generatePass: "Generate pass",
      passCode: "Code",
      passExpires: "Expires",
      oneTimeCodeNote: "One-time code",
      passOpenDoctorView: "Open doctor view",
      qrReady: "QR ready",
      shareHistory: "Share history",
      trustTitle: "Trust",
      howDecideBody: "How we decide",
      trustCard1: "Reviewed",
      trustCard1Desc: "Reviewed content",
      trustCard2: "Safe",
      trustCard2Desc: "Safe pathways",
      trustCard3: "Private",
      trustCard3Desc: "Private data",
      proofTitle: "Live proof",
      proofLiveNote: "Demo metrics",
      proofUsersLabel: "Users",
      proofTriageLabel: "Triage",
      proofDoctorViewsLabel: "Doctor views",
      advisorTitle: "Advisors",
      advisorRole1: "Clinical",
      advisorRole2: "Ops",
      advisorRole3: "Public health",
      directoryTitle: "Directory",
      directoryDesc: "Find care",
      directoryCard1: "Clinic",
      directoryCard1Desc: "Clinic route",
      directoryCard2: "Doctor",
      directoryCard2Desc: "Doctor route",
      directoryCard3: "Support",
      directoryCard3Desc: "Help",
      clinicTitle: "Clinic",
      doctorConsoleOpen: "Doctor console",
      howTitle: "How",
      howBody: "Workflow",
      designedTitle: "Designed",
      designedBody: "For India",
      complianceTitle: "Compliance",
      complianceBody: "General guidance",
      footer: "Footer",
      disclaimerTitle: "Disclaimer",
      disclaimerBody: "Body",
      disclaimerConfirm: "Confirm",
      disclaimerCta: "Accept",
      chatOpen: "Chat",
      chatTitle: "Help",
      chatThinking: "Thinking",
      chatPlaceholder: "Ask",
      chatSend: "Send",
    }[key] || key);

  const buildShellProps = (overrides = {}) => ({
    shell: {
      t,
      language: "en",
      setLanguage: vi.fn(),
      user: null,
      signOut: vi.fn(),
      setAuthMode: vi.fn(),
      scrollToSection: vi.fn(),
      ...overrides.shell,
    },
    heroTriage: {
      t,
      language: "en",
      user: null,
      signOut: vi.fn(),
      setAuthMode: vi.fn(),
      scrollToSection: vi.fn(),
      isOpsUser: false,
      profileSummary: "Profile summary",
      profileCompletion: 50,
      lastGuidance: null,
      sharePass: null,
      generateSharePass: vi.fn(),
      openRecordUploader: vi.fn(),
      triageType: "general",
      setTriageType: vi.fn(),
      submitTriage: vi.fn((event) => event?.preventDefault?.()),
      triageForm: { age: "", sex: "Female", durationDays: 1, severity: 3, symptoms: [], redFlags: [], additionalSymptoms: "", photoPreview: "" },
      updateTriageField: vi.fn(),
      dentalForm: { durationDays: 1, painScale: 3, symptoms: [], redFlags: [], hotColdTrigger: false, swelling: false },
      updateDentalField: vi.fn(),
      commonSymptoms: [],
      dentalSymptomsOptions: [],
      redFlagOptions: [],
      dentalRedFlagOptions: [],
      toggleArrayValue: vi.fn(),
      toggleDentalArrayValue: vi.fn(),
      translateSymptom: (value) => value,
      handlePhotoChange: vi.fn(),
      removeTriagePhoto: vi.fn(),
      triageLoading: false,
      triageError: "",
      triageResult: null,
      downloadVisitPdf: vi.fn(),
      handleGuidanceFeedback: vi.fn(),
      handleVisitFollowup: vi.fn(),
      feedbackStatus: "",
      authMode: "login",
      handleAuth: vi.fn((event) => event?.preventDefault?.()),
      authForm: { name: "", email: "", password: "" },
      updateAuthField: vi.fn(),
      authError: "",
      resetForm: { email: "" },
      setResetForm: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      resetStatus: "",
      ...overrides.heroTriage,
    },
    adminFallback: {
      user: null,
      adminOpsStatus: "",
      opsQueueStatus: "",
      adminOps: null,
      opsQueue: [],
      updateAppointmentStatus: vi.fn(),
      billingDrafts: {},
      updateBillingDraft: vi.fn(),
      saveBillingForAppointment: vi.fn(),
      viewReceipt: vi.fn(),
      loadAdminOps: vi.fn(),
      loadOpsQueue: vi.fn(),
      adminUsersStatus: "",
      loadAdminUsers: vi.fn(),
      adminUsers: [],
      updateAdminUserDraft: vi.fn(),
      adminSavingUserId: null,
      saveAdminUser: vi.fn(),
      departments: [],
      ...overrides.adminFallback,
    },
    patientFlows: {
      t,
      user: null,
      isOpsUser: false,
      profileEditMode: false,
      setProfileEditMode: vi.fn(),
      profileForm: {},
      departments: [],
      profileDepartmentDoctors: [],
      saveProfile: vi.fn(),
      updateProfileField: vi.fn(),
      setProfileForm: vi.fn(),
      profileStatus: "",
      history: [],
      visibleHistory: [],
      historyExpanded: false,
      setHistoryExpanded: vi.fn(),
      historyStatus: "",
      memberForm: { name: "", relation: "", age: "", sex: "Female", bloodType: "", conditions: "", allergies: "" },
      setMemberForm: vi.fn(),
      saveFamilyMember: vi.fn((event) => event?.preventDefault?.()),
      familyStatus: "",
      activeMemberId: null,
      setActiveMemberId: vi.fn(),
      familyMembers: [],
      recordsInputRef: { current: null },
      uploadRecord: vi.fn(),
      recordStatus: "",
      records: [],
      deleteRecord: vi.fn(),
      generateEmergencyCard: vi.fn(),
      emergencyCard: null,
      sharePassStatus: "",
      sharePass: null,
      generateSharePass: vi.fn(),
      shareQr: "",
      shareHistory: [],
      careRequestMode: "in_person",
      setCareRequestMode: vi.fn(),
      submitCareRequest: vi.fn((event) => event?.preventDefault?.()),
      appointmentForm: { departmentId: "", doctorId: "", slot: "", reason: "" },
      setAppointmentForm: vi.fn(),
      departmentDoctors: [],
      availableSlots: [],
      slotStatus: "",
      teleForm: { departmentId: "", mode: "video", concern: "" },
      updateTeleField: vi.fn(),
      teleStatus: "",
      appointmentsStatus: "",
      teleLoading: false,
      teleconsults: [],
      appointments: [],
      activeConsultId: null,
      setActiveConsultId: vi.fn(),
      teleStatusLabel: () => "Requested",
      activeConsult: null,
      consultMessages: [],
      sendConsultMessage: vi.fn((event) => event?.preventDefault?.()),
      consultMessageText: "",
      setConsultMessageText: vi.fn(),
      consultMessageStatus: "",
      encounters: [],
      activeEncounterId: null,
      setActiveEncounterId: vi.fn(),
      encounterDetail: null,
      encounterStatus: "",
      ...overrides.patientFlows,
    },
    publicInfo: {
      t,
      formatNumber: (value) => String(value),
      liveStats: { users: 0, triageCompleted: 0, doctorViews: 0 },
      showDisclaimer: false,
      acceptDisclaimer: vi.fn(),
      chatOpen: false,
      setChatOpen: vi.fn(),
      chatMessages: [],
      chatLoading: false,
      sendChatMessage: vi.fn((event) => event?.preventDefault?.()),
      chatInput: "",
      setChatInput: vi.fn(),
      ...overrides.publicInfo,
    },
  });

  it("renders guest legacy shell without crashing", () => {
    render(<LegacyPortalShell {...buildShellProps()} />);
    expect(screen.getByText("SehatSaathi")).toBeInTheDocument();
    expect(screen.getByText("Care access for every family")).toBeInTheDocument();
    expect(screen.getByText("Forgot password")).toBeInTheDocument();
  });

  it("renders patient health pass details from grouped props", () => {
    render(
      <LegacyPortalShell
        {...buildShellProps({
          shell: { user: { id: 1, role: "patient", name: "Ved" } },
          heroTriage: {
            user: { id: 1, role: "patient", name: "Ved" },
            sharePass: { code: "ABCD1234" },
          },
          patientFlows: {
            user: { id: 1, role: "patient", name: "Ved" },
            sharePass: {
              code: "ABCD1234",
              expiresAt: "2026-03-12T10:00:00.000Z",
              doctorUrl: "/doctor-view/ABCD1234",
            },
            shareQr: "https://example.com/qr.png",
          },
        })}
      />
    );
    expect(screen.getAllByText("ABCD1234").length).toBeGreaterThan(0);
    expect(screen.getByAltText("Health pass QR")).toBeInTheDocument();
  });
});
