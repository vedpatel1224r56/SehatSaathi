const createPatientValidationService = ({ hospitalSettingsService }) => {
  const PATIENT_ALLOWED_SEX = new Set(["female", "male", "other", "prefer_not_to_say"]);
  const PATIENT_ALLOWED_MARITAL_STATUS = new Set(["single", "married", "widowed", "divorced"]);
  const PATIENT_ALLOWED_BLOOD_GROUP = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
  const APPOINTMENT_ALLOWED_STATUSES = new Set([
    "requested",
    "approved",
    "checked_in",
    "completed",
    "cancelled",
    "no_show",
  ]);
  const APPOINTMENT_TRANSITIONS = {
    requested: new Set(["approved", "cancelled"]),
    approved: new Set(["checked_in", "cancelled", "no_show"]),
    checked_in: new Set(["completed", "cancelled", "no_show"]),
    completed: new Set([]),
    cancelled: new Set([]),
    no_show: new Set([]),
  };

  const getAllowedVisitTypeCodes = async () => {
    const rows = await hospitalSettingsService.readVisitTypes({ activeOnly: true });
    if (!rows.length) return new Set(["OPD", "IPD"]);
    return new Set(rows.map((row) => hospitalSettingsService.normalizeVisitTypeCode(row.code)));
  };

  const validatePatientProfileCompleteness = (payload = {}) => {
    const errors = {};
    const requiredFields = [
      ["sex", "Sex is required."],
      ["phone", "Contact number is required."],
    ];
    for (const [key, message] of requiredFields) {
      const value = payload[key];
      if (value === undefined || value === null || String(value).trim() === "") {
        errors[key] = message;
      }
    }

    if (!payload.fullName || String(payload.fullName).trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters.";
    }
    if (!payload.email || !String(payload.email).trim().toLowerCase().includes("@")) {
      errors.email = "Valid email is required.";
    }

    const sex = String(payload.sex || "").trim().toLowerCase();
    if (sex && !PATIENT_ALLOWED_SEX.has(sex)) {
      errors.sex = "Invalid sex value.";
    }

    const maritalStatus = String(payload.maritalStatus || "").trim().toLowerCase();
    if (maritalStatus && !PATIENT_ALLOWED_MARITAL_STATUS.has(maritalStatus)) {
      errors.maritalStatus = "Invalid marital status.";
    }

    const bloodGroup = String(payload.bloodGroup || "").trim().toUpperCase();
    if (bloodGroup && !PATIENT_ALLOWED_BLOOD_GROUP.has(bloodGroup)) {
      errors.bloodGroup = "Invalid blood group.";
    }

    const normalizedPhone = String(payload.phone || "").replace(/\D/g, "");
    if (normalizedPhone && normalizedPhone.length !== 10) {
      errors.phone = "Contact number must be 10 digits.";
    }

    const normalizedAbhaNumber = String(payload.abhaNumber || "").replace(/\D/g, "");
    if (normalizedAbhaNumber && normalizedAbhaNumber.length !== 14) {
      errors.abhaNumber = "ABHA number must be 14 digits.";
    }

    const normalizedAbhaAddress = String(payload.abhaAddress || "").trim().toLowerCase();
    if (normalizedAbhaAddress) {
      const simpleAbhaAddressPattern = /^[a-z0-9][a-z0-9._-]{1,98}@[a-z][a-z0-9._-]{1,48}$/;
      if (!simpleAbhaAddressPattern.test(normalizedAbhaAddress)) {
        errors.abhaAddress = "ABHA address must look like name@abdm.";
      }
    }

    const normalizedPinCode = String(payload.pinCode || "").replace(/\D/g, "");
    if (normalizedPinCode && normalizedPinCode.length !== 6) {
      errors.pinCode = "PIN code must be 6 digits.";
    }

    const weightKg = payload.weightKg;
    if (weightKg !== undefined && weightKg !== null && String(weightKg).trim() !== "") {
      const numericWeight = Number(weightKg);
      if (Number.isNaN(numericWeight) || numericWeight <= 0 || numericWeight > 500) {
        errors.weightKg = "Weight must be a valid value in kg.";
      }
    }

    const heightCm = payload.heightCm;
    if (heightCm !== undefined && heightCm !== null && String(heightCm).trim() !== "") {
      const numericHeight = Number(heightCm);
      if (Number.isNaN(numericHeight) || numericHeight <= 0 || numericHeight > 300) {
        errors.heightCm = "Height must be a valid value in cm.";
      }
    }

    const dob = String(payload.dateOfBirth || "").trim();
    if (dob) {
      const parsed = new Date(dob);
      if (Number.isNaN(parsed.getTime())) {
        errors.dateOfBirth = "Date of birth is invalid.";
      } else if (parsed.getTime() > Date.now()) {
        errors.dateOfBirth = "Date of birth cannot be in the future.";
      }
    }

    return errors;
  };

  const normalizeAppointmentStatus = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "scheduled") return "approved";
    return normalized;
  };

  const canTransitionAppointmentStatus = ({ fromStatus, toStatus }) => {
    const from = normalizeAppointmentStatus(fromStatus);
    const to = normalizeAppointmentStatus(toStatus);
    if (!APPOINTMENT_ALLOWED_STATUSES.has(from) || !APPOINTMENT_ALLOWED_STATUSES.has(to)) return false;
    if (from === to) return true;
    const allowed = APPOINTMENT_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.has(to);
  };

  return {
    getAllowedVisitTypeCodes,
    validatePatientProfileCompleteness,
    normalizeAppointmentStatus,
    canTransitionAppointmentStatus,
  };
};

module.exports = { createPatientValidationService };
