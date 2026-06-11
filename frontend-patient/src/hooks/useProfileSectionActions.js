import { useCallback } from "react";

function firstValidationMessage(validationErrors = {}) {
  return Object.values(validationErrors || {}).find(Boolean) || "";
}

function isNetworkLikeError(error) {
  const message = String(error?.message || "");
  return (
    typeof navigator !== "undefined" && navigator.onLine === false ||
    error?.name === "TypeError" ||
    /network|fetch|failed to fetch|load failed|connection|offline/i.test(message)
  );
}

function humanizeRecordIssue(message, fallback) {
  const text = String(message || "");
  if (/timeout|timed out|gateway timeout|408|504/i.test(text)) {
    return "This is taking a little longer than expected. Please check again shortly.";
  }
  if (/extract|ocr|parse|unsupported|could not read|unable to read|no text/i.test(text)) {
    return "The report was uploaded, but we could not read enough clearly. Try a cleaner PDF or sharper image.";
  }
  return text || fallback;
}

const REPORT_UPLOAD_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"]);

function isSupportedReportFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return type === "application/pdf" || type.startsWith("image/") || REPORT_UPLOAD_EXTENSIONS.has(ext);
}

export function useProfileSectionActions({
  apiBase,
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
}) {
  const openRecordUploader = useCallback(() => {
    recordsInputRef.current?.click();
  }, [recordsInputRef]);

  const saveProfile = useCallback(
    async (event) => {
      event.preventDefault();
      setProfileStatus("");
      try {
        const normalizedPhone = String(profileForm.phone || "").replace(/\D/g, "");
        const normalizedAadhaar = String(profileForm.aadhaarNo || "").replace(/\D/g, "");
        const normalizedAbhaNumber = String(profileForm.abhaNumber || "").replace(/\D/g, "");
        const normalizedAbhaAddress = String(profileForm.abhaAddress || "").trim().toLowerCase();
        const normalizedPinCode = String(profileForm.pinCode || "").replace(/\D/g, "");
        const normalizedAddressLine1 = String(profileForm.addressLine1 || "").trim();
        const normalizedAddressLine2 = String(profileForm.addressLine2 || "").trim();
        const response = await apiFetch(`${apiBase}/api/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id,
            fullName: profileForm.fullName,
            email: profileForm.email,
            age: profileForm.age ? Number(profileForm.age) : null,
            weightKg: profileForm.weightKg ? Number(profileForm.weightKg) : null,
            heightCm: profileForm.heightCm ? Number(profileForm.heightCm) : null,
            sex: profileForm.sex,
            conditions: String(profileForm.conditions || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            allergies: String(profileForm.allergies || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            medications: String(profileForm.medications || profileForm.currentMedications || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            region: profileForm.region,
            phone: normalizedPhone,
            abhaNumber: normalizedAbhaNumber,
            abhaAddress: normalizedAbhaAddress,
            addressLine1: normalizedAddressLine1,
            addressLine2: normalizedAddressLine2,
            address: [normalizedAddressLine1, normalizedAddressLine2].filter(Boolean).join(", "),
            bloodGroup: profileForm.bloodGroup,
            dateOfBirth: profileForm.dateOfBirth,
            aadhaarNo: normalizedAadhaar,
            maritalStatus: profileForm.maritalStatus,
            city: profileForm.city,
            state: profileForm.state,
            country: profileForm.country || "India",
            pinCode: normalizedPinCode,
            // Patient profile editing no longer exposes unit assignment fields,
            // so do not re-submit hidden stale doctor/department ids.
            unitDepartmentId: null,
            unitDoctorId: null,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setProfileStatus(firstValidationMessage(data.validationErrors) || data.error || "Unable to save profile.");
          return false;
        }
        if (data.user) {
          setUser(data.user);
          localStorage.setItem("health_user", JSON.stringify(data.user));
        }
        if (data.profile) {
          setProfileForm(mapProfilePayloadToForm(data.profile, data.user || user));
        }
        await Promise.all([
          loadProfile(user?.id),
          loadAbhaHistory ? loadAbhaHistory() : Promise.resolve(),
          loadReportInsights ? loadReportInsights(activeMemberId) : Promise.resolve(),
        ]);
        setProfileStatus("Profile saved for your next visit.");
        setProfileEditMode(false);
        setActivePatientTab("home");
        return true;
      } catch (error) {
        setProfileStatus("Network error. Check backend connection.");
        return false;
      }
    },
    [
      apiBase,
      apiFetch,
      loadProfile,
      loadAbhaHistory,
      loadReportInsights,
      mapProfilePayloadToForm,
      profileForm,
      setProfileForm,
      setActivePatientTab,
      setProfileEditMode,
      setProfileStatus,
      setUser,
      activeMemberId,
      user?.id,
    ],
  );

  // ABHA live verification deferred — ABDM sandbox registration in progress.
  // Both functions are intentional no-ops for the pilot; the profile fields
  // still save abhaNumber / abhaAddress as self-reported text.
  const fetchAbhaProfile = useCallback(() => {
    setProfileStatus("Live ABHA fetch will be available in a future update.");
  }, [setProfileStatus]);

  const requestAbhaVerification = useCallback(() => {
    setProfileStatus("ABHA verification with ABDM is coming soon. Your details are saved.");
  }, [setProfileStatus]);

  const uploadRecord = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setRecordStatus("");
      if (!isSupportedReportFile(file)) {
        setRecordStatus("Unsupported format. Upload a PDF or clear image file (JPG, PNG, HEIC, WEBP).");
        if (event.target) event.target.value = "";
        return;
      }
      try {
        await trackAnalyticsEvent?.("report_upload_started", {
          memberId: activeMemberId || null,
          mimeType: file.type || "",
          fileSizeBytes: Number(file.size || 0),
          fileName: file.name || "",
        });
      setRecordStatus("Uploading report...");
        const formData = new FormData();
        formData.append("record", file);
        const response = await apiFetch(`${apiBase}/api/records`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          await trackDropOff?.("report_upload", {
            memberId: activeMemberId || null,
            reason: data.error || "upload_rejected",
            mimeType: file.type || "",
          });
          setRecordStatus(humanizeRecordIssue(data.error, "Unable to upload record."));
          return;
        }
        await trackAnalyticsEvent?.("report_upload_completed", {
          memberId: activeMemberId || null,
          mimeType: file.type || "",
          fileSizeBytes: Number(file.size || 0),
          fileName: file.name || "",
        });
        await loadRecords(activeMemberId);
        const insightsLoaded = await loadReportInsights(activeMemberId);
        if (insightsLoaded === false) {
          setRecordStatus("Report uploaded. The summary will appear shortly.");
          return;
        }
        setRecordStatus(data.message || "Report uploaded.");
      } catch (error) {
        await trackDropOff?.("report_upload", {
          memberId: activeMemberId || null,
          reason: error?.message || "upload_failed",
          networkLike: isNetworkLikeError(error),
          mimeType: file.type || "",
        });
        setRecordStatus(
          isNetworkLikeError(error)
            ? "Upload failed because the connection was interrupted. Please try again."
            : "Unable to upload record right now.",
        );
      } finally {
        if (event.target) {
          event.target.value = "";
        }
      }
    },
    [activeMemberId, apiBase, apiFetch, loadRecords, loadReportInsights, setRecordStatus],
  );

  const deleteRecord = useCallback(
    async (recordId) => {
      if (!recordId) return;
      setRecordStatus("");
      try {
        const response = await apiFetch(`${apiBase}/api/records/${recordId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          setRecordStatus(data.error || "Unable to delete record.");
          return;
        }
        setRecordStatus("Record deleted.");
        await Promise.all([loadRecords(activeMemberId), loadReportInsights(activeMemberId)]);
      } catch (error) {
        setRecordStatus("Network error. Check backend connection.");
      }
    },
    [activeMemberId, apiBase, apiFetch, loadRecords, loadReportInsights, setRecordStatus],
  );

  const generateSharePass = useCallback(async () => {
    if (!authToken || !user?.id) {
      setSharePassStatus("Sign in first.");
      return;
    }

    setSharePassStatus("");
    try {
      const response = await apiFetch(`${apiBase}/api/share-pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSharePassStatus(data.error || "Unable to generate health pass.");
        return;
      }

      const doctorUrl = data.doctorUrl ? `${window.location.origin}${data.doctorUrl}` : "";
      setSharePass({
        code: data.code,
        expiresAt: data.expiresAt,
        doctorUrl,
      });
      setShareQr(
        doctorUrl
          ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
              doctorUrl,
            )}`
          : "",
      );
      setSharePassStatus("Health pass generated.");
      await Promise.all([loadSharePasses(), loadShareHistory()]);
    } catch (error) {
      setSharePassStatus("Network error. Check backend connection.");
    }
  }, [
    apiBase,
    apiFetch,
    authToken,
    loadShareHistory,
    loadSharePasses,
    setSharePass,
    setSharePassStatus,
    setShareQr,
    user?.id,
  ]);

  return {
    openRecordUploader,
    saveProfile,
    uploadRecord,
    deleteRecord,
    generateSharePass,
    requestAbhaVerification,
    fetchAbhaProfile,
  };
}
