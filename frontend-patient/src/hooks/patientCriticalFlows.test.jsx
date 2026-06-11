import { act, renderHook } from "@testing-library/react";
import { fallbackTriage } from "../patientOpsConfig";
import { useProfileSectionActions } from "./useProfileSectionActions";
import { useTriageSectionActions } from "./useTriageSectionActions";

describe("patient critical flow hooks", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves profile and refreshes user/profile state", async () => {
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 7, name: "Ved Patel", role: "patient" },
      }),
    });
    const setProfileStatus = vi.fn();
    const setUser = vi.fn();
    const setProfileEditMode = vi.fn();
    const loadProfile = vi.fn().mockResolvedValue();

    const { result } = renderHook(() =>
      useProfileSectionActions({
        apiBase: "http://localhost:8080",
        apiFetch,
        authToken: "token",
        user: { id: 7, name: "Ved Patel" },
        setProfileForm: vi.fn(),
        profileForm: {
          fullName: "Ved Patel",
          email: "ved@example.com",
          age: "22",
          sex: "Male",
          conditions: "none",
          allergies: "none",
          region: "Vadodara",
          phone: "9999999999",
          address: "Address",
          bloodGroup: "O+",
          dateOfBirth: "2004-01-01",
          emergencyContactName: "Parent",
          emergencyContactPhone: "8888888888",
          aadhaarNo: "123412341234",
          maritalStatus: "single",
          taluka: "Vadodara",
          district: "Vadodara",
          city: "Vadodara",
          state: "Gujarat",
          country: "India",
          pinCode: "390001",
          registrationMode: "opd",
          visitTime: "OPD",
          unitDepartmentId: "1",
          unitDoctorId: "2",
        },
        setProfileStatus,
        setUser,
        setProfileEditMode,
        setActivePatientTab: vi.fn(),
        loadProfile,
        activeMemberId: null,
        recordsInputRef: { current: null },
        loadRecords: vi.fn(),
        loadReportInsights: vi.fn(),
        setRecordStatus: vi.fn(),
        loadSharePasses: vi.fn(),
        loadShareHistory: vi.fn(),
        setSharePassStatus: vi.fn(),
        setSharePass: vi.fn(),
        setShareQr: vi.fn(),
        mapProfilePayloadToForm: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.saveProfile({ preventDefault: vi.fn() });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/profile",
      expect.objectContaining({ method: "POST" }),
    );
    expect(setUser).toHaveBeenCalledWith({ id: 7, name: "Ved Patel", role: "patient" });
    expect(setProfileEditMode).toHaveBeenCalledWith(false);
    expect(loadProfile).toHaveBeenCalledWith(7);
    expect(setProfileStatus).toHaveBeenLastCalledWith("Profile saved for your next visit.");
  });

  it("opens report uploader and uploads a record", async () => {
    const click = vi.fn();
    const setRecordStatus = vi.fn();
    const loadRecords = vi.fn().mockResolvedValue();
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    });

    const { result } = renderHook(() =>
      useProfileSectionActions({
        apiBase: "http://localhost:8080",
        apiFetch,
        authToken: "token",
        user: { id: 7 },
        profileForm: {},
        setProfileForm: vi.fn(),
        setProfileStatus: vi.fn(),
        setUser: vi.fn(),
        setProfileEditMode: vi.fn(),
        setActivePatientTab: vi.fn(),
        loadProfile: vi.fn(),
        activeMemberId: 4,
        recordsInputRef: { current: { click } },
        loadRecords,
        loadReportInsights: vi.fn().mockResolvedValue(),
        setRecordStatus,
        loadSharePasses: vi.fn(),
        loadShareHistory: vi.fn(),
        setSharePassStatus: vi.fn(),
        setSharePass: vi.fn(),
        setShareQr: vi.fn(),
        mapProfilePayloadToForm: vi.fn(),
      }),
    );

    result.current.openRecordUploader();
    expect(click).toHaveBeenCalled();

    const file = new File(["report"], "report.pdf", { type: "application/pdf" });
    const event = { target: { files: [file], value: "x" } };

    await act(async () => {
      await result.current.uploadRecord(event);
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/records",
      expect.objectContaining({ method: "POST" }),
    );
    expect(loadRecords).toHaveBeenCalledWith(4);
    expect(setRecordStatus).toHaveBeenLastCalledWith("Report uploaded.");
    expect(event.target.value).toBe("");
  });

  it("generates a health pass and QR link", async () => {
    const setSharePass = vi.fn();
    const setShareQr = vi.fn();
    const setSharePassStatus = vi.fn();
    const loadSharePasses = vi.fn().mockResolvedValue();
    const loadShareHistory = vi.fn().mockResolvedValue();
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "PASS1234",
        expiresAt: "2026-03-12T10:00:00.000Z",
        doctorUrl: "/doctor-view/PASS1234",
      }),
    });

    const { result } = renderHook(() =>
      useProfileSectionActions({
        apiBase: "http://localhost:8080",
        apiFetch,
        authToken: "token",
        user: { id: 7 },
        profileForm: {},
        setProfileForm: vi.fn(),
        setProfileStatus: vi.fn(),
        setUser: vi.fn(),
        setProfileEditMode: vi.fn(),
        setActivePatientTab: vi.fn(),
        loadProfile: vi.fn(),
        activeMemberId: null,
        recordsInputRef: { current: null },
        loadRecords: vi.fn(),
        loadReportInsights: vi.fn(),
        setRecordStatus: vi.fn(),
        loadSharePasses,
        loadShareHistory,
        setSharePassStatus,
        setSharePass,
        setShareQr,
        mapProfilePayloadToForm: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.generateSharePass();
    });

    expect(setSharePass).toHaveBeenCalledWith({
      code: "PASS1234",
      expiresAt: "2026-03-12T10:00:00.000Z",
      doctorUrl: `${window.location.origin}/doctor-view/PASS1234`,
    });
    expect(setShareQr).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(`${window.location.origin}/doctor-view/PASS1234`)),
    );
    expect(loadSharePasses).toHaveBeenCalled();
    expect(loadShareHistory).toHaveBeenCalled();
    expect(setSharePassStatus).toHaveBeenLastCalledWith("Health pass generated.");
  });

  it("submits triage and stores returned guidance", async () => {
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          level: "urgent",
          headline: "Talk to a clinician soon",
        },
      }),
    });
    const setTriageLoading = vi.fn();
    const setTriageError = vi.fn();
    const setTriageResult = vi.fn();
    const loadHistory = vi.fn().mockResolvedValue();

    const { result } = renderHook(() =>
      useTriageSectionActions({
        apiBase: "http://localhost:8080",
        apiFetch,
        triageType: "general",
        triageForm: {
          age: "22",
          sex: "Male",
          durationDays: "2",
          severity: "3",
          symptoms: ["Fever"],
          additionalSymptoms: "",
          redFlags: [],
        },
        dentalForm: {
          durationDays: 0,
          painScale: 0,
          symptoms: [],
          redFlags: [],
          hotColdTrigger: false,
          swelling: false,
        },
        setTriageForm: vi.fn(),
        setDentalForm: vi.fn(),
        setTriageType: vi.fn(),
        setTriageDraftStatus: vi.fn(),
        setTriageLoading,
        setTriageError,
        setTriageResult,
        loadHistory,
        user: { id: 7 },
        fallbackTriage,
      }),
    );

    await act(async () => {
      await result.current.submitTriage({ preventDefault: vi.fn() });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/triage",
      expect.objectContaining({ method: "POST" }),
    );
    expect(setTriageResult).toHaveBeenCalledWith({
      level: "urgent",
      headline: "Talk to a clinician soon",
    });
    expect(loadHistory).toHaveBeenCalledWith(7);
    expect(setTriageLoading).toHaveBeenNthCalledWith(1, true);
    expect(setTriageLoading).toHaveBeenLastCalledWith(false);
  });
});
